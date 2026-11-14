#!/usr/bin/env python
# ruff: noqa: E501, C901, PLR0912, PLR0915
r"""Export the typed user prompts of the hackathon project to prompts/prompts.md.

Zero model tokens: reads only local transcripts that already exist on disk, stdlib only.

Sources and sections (in this order in the output):
  1. Preparation tabs: the two sessions of the TemplateSetup project folder under ~/.claude/projects
     (they built the _template library and scaffolding that this workspace uses).
  2. Main log: every session of ~/.claude/projects/c--CandidateWorkspace (plus any other
     project folder whose recorded cwd is inside CandidateWorkspace, e.g. worktrees).
     The YottaFlex-ASG project folder is always excluded (separate earlier assignment).
  3. Antigravity (Gemini) history: USER_INPUT records of
     ~/.gemini/antigravity/brain/<conversation>/.system_generated/logs/transcript_full.jsonl
     for conversations that mention CandidateWorkspace. Plan/walkthrough files are listed by
     name only, not copied.

Filters: only human-typed user messages (type == "user", not a sub-agent sidechain, origin human
or absent, text/image blocks only). Excluded: tool results, system reminders, IDE context
injections, task notifications, sub-agent hand-backs, peer-session messages, command caveats
and command stdout. Slash commands keep their "/name args" line only.
Long pasted blocks are cut to the first 40 lines.
Redacted: e-mail addresses, API keys/tokens, and the Windows user name (C:\Users\<user>).

Deterministic: same inputs give byte-identical output (the header shows the date only).

Usage (from the repo root or any folder; rewrites the output):
  python prompts/export_prompts.py              # everything -> prompts/prompts.md
  python prompts/export_prompts.py --latest     # only the newest Claude Code session
  python prompts/export_prompts.py -o some.md
"""

import argparse
import json
import re
from datetime import UTC, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
HOME = Path.home()
USER = HOME.name  # the Windows user name, taken from the home folder
MATCH = "candidateworkspace"


def project_folder(*parts: str) -> str:
    """Claude Code's transcript folder name for a project path (drive and separators become '-')."""
    return re.sub(r"[:\\/]", "-", str(HOME.joinpath(*parts))).lower()


PREP_FOLDER = project_folder("Desktop", "TemplateSetup")
EXCLUDED_FOLDERS = {project_folder("Desktop", "YottaFlex-ASG")}
MAX_PASTE_LINES = 40
PLAN_FILES = ("implementation_plan.md", "walkthrough.md")

REDACTIONS = [
    (re.compile(r"[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}"), "<email>"),
    (re.compile(r"\bsk-[A-Za-z0-9_\-]{12,}"), "sk-<redacted>"),
    (re.compile(r"\bgh[pousr]_[A-Za-z0-9]{20,}"), "gh_<redacted>"),
    (re.compile(r"\bxox[baprs]-[A-Za-z0-9\-]{10,}"), "xox-<redacted>"),
    (re.compile(r"\bAKIA[0-9A-Z]{16}\b"), "AKIA<redacted>"),
    (re.compile(r"(?i)\bbearer\s+[A-Za-z0-9._\-]{20,}"), "Bearer <redacted>"),
    (
        re.compile(r"(?i)\b(password|passwd|pwd|secret|token|api[_-]?key|apikey)(\s*[=:]\s*)(\S+)"),
        r"\1\2<redacted>",
    ),
    # home folder, with any separators, becomes C:\Users\<user>; then the bare user name token
    (
        re.compile(
            r"(?i)" + r"[\\/]+".join(re.escape(part) for part in re.split(r"[\\/]+", str(HOME)))
        ),
        lambda _match: r"C:\Users\<user>",
    ),
    (re.compile(rf"(?i)\b{re.escape(USER)}\b"), "<user>"),
]

PASTE_RE = re.compile(r"<pasted_content[^>]*>(.*?)</pasted_content[^>]*>", re.S)
STRIP_RES = [
    re.compile(r"<system-reminder>.*?</system-reminder>\s*", re.S),
    re.compile(r"<ide_(opened_file|selection)>.*?</ide_\1>\s*", re.S),
    re.compile(r"<local-command-caveat>.*?</local-command-caveat>\s*", re.S),
    re.compile(r"<local-command-(stdout|stderr)>.*?</local-command-\1>\s*", re.S),
]


def redact(text: str) -> str:
    for pattern, repl in REDACTIONS:
        text = pattern.sub(repl, text)
    return text


def read_records(path: Path):
    for line in path.open(encoding="utf-8", errors="replace"):
        try:
            yield json.loads(line)
        except ValueError:
            continue


def clean_prompt(content) -> str | None:
    """Return the typed text of one user message, or None if it is not a prompt."""
    if isinstance(content, str):
        text = content
    else:
        parts = []
        for block in content or []:
            if not isinstance(block, dict):
                continue
            if block.get("type") == "text":
                parts.append(block.get("text", ""))
            elif block.get("type") == "image":
                parts.append("[image]")
        text = "\n".join(parts)

    text = text.strip()
    if not text or "<task-notification" in text[:40] or "[Subagent hand-back]" in text:
        return None
    if text.startswith("Another Claude session sent a message"):
        return None
    if text.startswith("This session is being continued from a previous conversation"):
        return None  # auto-generated compaction summary, not typed by the user
    for pattern in STRIP_RES:
        text = pattern.sub("", text)
    if "<command-name>" in text:  # slash command: keep "/name args", drop the boilerplate
        name = re.search(r"<command-name>(.*?)</command-name>", text, re.S)
        args = re.search(r"<command-args>(.*?)</command-args>", text, re.S)
        text = " ".join(
            s.strip()
            for s in ((name.group(1) if name else ""), (args.group(1) if args else ""))
            if s.strip()
        )
    text = re.sub(r"\[Image: source:[^\]]*\]", "[image]", text).strip()

    def collapse(match):
        lines = match.group(1).strip("\n").split("\n")
        if len(lines) > MAX_PASTE_LINES:
            extra = len(lines) - MAX_PASTE_LINES
            lines = [*lines[:MAX_PASTE_LINES], f"[... {extra} more lines]"]
        return "````text\n" + "\n".join(lines) + "\n````\n"

    text = PASTE_RE.sub(collapse, text).strip()
    return text or None


def claude_sessions():
    """Yield (group, session_id, folder_name, [(timestamp, text), ...]) for included sessions."""
    base = Path.home() / ".claude" / "projects"
    for folder in sorted(p for p in base.iterdir() if p.is_dir()):
        name = folder.name.lower()
        if name in EXCLUDED_FOLDERS:
            continue
        for path in sorted(folder.glob("*.jsonl")):
            records = list(read_records(path))
            if name == PREP_FOLDER:
                group = "prep"
            elif MATCH in name or any(MATCH in str(o.get("cwd") or "").lower() for o in records):
                group = "main"
            else:
                continue
            prompts = []
            for o in records:
                if o.get("type") != "user" or o.get("isSidechain"):
                    continue
                if (o.get("origin") or {}).get("kind", "human") != "human":
                    continue
                text = clean_prompt((o.get("message") or {}).get("content"))
                if text:
                    prompts.append((o.get("timestamp", ""), text))
            yield group, path.stem, folder.name, prompts


def antigravity_sessions():
    """Yield (conversation_id, plan_files, [(timestamp, text), ...]) for matching chats."""
    brain = Path.home() / ".gemini" / "antigravity" / "brain"
    if not brain.is_dir():
        return
    for conv in sorted(p for p in brain.iterdir() if p.is_dir()):
        logs = conv / ".system_generated" / "logs" / "transcript_full.jsonl"
        if not logs.is_file():
            continue
        records = list(read_records(logs))
        if not any(MATCH in json.dumps(o).lower() for o in records):
            continue
        prompts, seen = [], set()
        for o in records:
            if o.get("type") != "USER_INPUT" or not str(o.get("source", "")).startswith("USER"):
                continue
            content = str(o.get("content", ""))
            found = re.search(r"<USER_REQUEST>(.*?)</USER_REQUEST>", content, re.S)
            text = clean_prompt((found.group(1) if found else content).strip())
            if text and text not in seen:  # dedupe repeated steps
                seen.add(text)
                prompts.append((o.get("created_at", ""), text))
        plans = [f for f in PLAN_FILES if (conv / f).is_file()]
        yield conv.name, plans, prompts


def stamp(ts: str) -> str:
    return ts[:19].replace("T", " ") + " UTC" if ts else "unknown time"


def span(items) -> str:
    return f"{stamp(items[0][0])} to {stamp(items[-1][0])}" if items else "-"


def section(title: str, sessions, scanned_note: str, out: list, counter: list):
    """Append one section (summary + tab table + prompts). sessions: [(id, folder, items)]."""
    total = sum(len(s[2]) for s in sessions)
    out.append(f"\n## {title}\n")
    out.append(f"{redact(scanned_note)}\n")
    out.append(f"- Tabs/sessions: **{len(sessions)}**; prompts: **{total}**")
    if sessions:
        first = min(s[2][0][0] for s in sessions)
        last = max(s[2][-1][0] for s in sessions)
        out.append(f"- Date range: {stamp(first)} to {stamp(last)}\n")
    out.append("| # | Session | Folder | First prompt | Last prompt | Prompts |")
    out.append("|---|---|---|---|---|---|")
    for n, (sid, folder, items) in enumerate(sessions, 1):
        out.append(
            f"| {n} | `{sid[:8]}` | {redact(folder)} | {stamp(items[0][0])} | {stamp(items[-1][0])} | {len(items)} |"
        )
    events = sorted(
        ((ts, sid, i, text) for sid, _f, items in sessions for i, (ts, text) in enumerate(items)),
        key=lambda e: (e[0], e[1], e[2]),
    )
    out.append("")
    for ts, sid, _i, text in events:
        counter[0] += 1
        out.append(f"### {counter[0]}. {stamp(ts)} · tab `{sid[:8]}`\n\n{redact(text)}\n")
    return total


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--latest", action="store_true", help="only the newest Claude Code session")
    ap.add_argument("-o", "--out", default=str(ROOT / "prompts" / "prompts.md"))
    a = ap.parse_args()

    sessions = {"prep": [], "main": []}
    scanned = 0
    for group, sid, folder, items in claude_sessions():
        scanned += 1
        if items:
            sessions[group].append((sid, folder, items))
    if a.latest:
        pool = sessions["main"] + sessions["prep"]
        sessions = {"prep": [], "main": [max(pool, key=lambda s: s[2][-1][0])] if pool else []}
    for g in sessions:
        sessions[g].sort(key=lambda s: (s[2][0][0], s[0]))
    gemini = [(cid, plans, items) for cid, plans, items in antigravity_sessions() if items]

    out = [
        "# Prompt log\n",
        f"Generated {datetime.now(UTC):%Y-%m-%d} by `prompts/export_prompts.py` from local "
        "transcripts (no model calls). Assistant replies are not included.\n",
        "Sources and filters: Claude Code transcripts of the TemplateSetup preparation tabs and of the "
        "CandidateWorkspace project (sub-agent sidechains, tool results, system reminders, IDE context, "
        "task notifications and sub-agent hand-backs excluded; long pasted blocks cut to "
        f"{MAX_PASTE_LINES} lines). The YottaFlex-ASG project folder is excluded (separate earlier assignment). "
        "E-mail addresses, keys and the Windows user name are redacted.\n",
        "## Summary\n",
        "| Section | Tabs/sessions | Prompts | Date range (UTC) |",
        "|---|---|---|---|",
    ]
    counter = [0]
    prep_n = sum(len(s[2]) for s in sessions["prep"])
    main_n = sum(len(s[2]) for s in sessions["main"])
    gem_n = sum(len(s[2]) for s in gemini)
    rows = [
        ("1. Preparation tabs (TemplateSetup)", sessions["prep"]),
        ("2. Main log (CandidateWorkspace)", sessions["main"]),
    ]
    for label, group in rows:
        items = [it for s in group for it in s[2]]
        rng = (
            f"{stamp(min(i[0] for i in items))} to {stamp(max(i[0] for i in items))}"
            if items
            else "-"
        )
        out.append(f"| {label} | {len(group)} | {len(items)} | {rng} |")
    gem_items = [it for g in gemini for it in g[2]]
    gem_rng = (
        f"{stamp(min(i[0] for i in gem_items))} to {stamp(max(i[0] for i in gem_items))}"
        if gem_items
        else "-"
    )
    out.append(f"| 3. Antigravity (Gemini) history | {len(gemini)} | {gem_n} | {gem_rng} |")
    out.append(
        f"\nTotal prompts: **{prep_n + main_n + gem_n}**. Transcripts scanned: {scanned} (Claude Code)."
    )

    section(
        "1. Preparation tabs (TemplateSetup: built the _template library and scaffolding for this workspace)",
        sessions["prep"],
        f"Folder {PREP_FOLDER}, all top-level sessions.",
        out,
        counter,
    )
    section(
        "2. Main log (CandidateWorkspace)",
        sessions["main"],
        "Folder c--CandidateWorkspace (every session) plus any project whose cwd is inside CandidateWorkspace.",
        out,
        counter,
    )

    if gemini:
        out.append("\n## 3. Antigravity (Gemini) history\n")
        out.append(
            "Source: `~/.gemini/antigravity/brain/<conversation>/.system_generated/logs/transcript_full.jsonl` "
            "(USER_INPUT records, text inside `<USER_REQUEST>`, deduplicated). "
            "Plan and walkthrough files are referenced by name only.\n"
        )
        out.append(
            "| # | Conversation | Prompts | Date range (UTC) | Plan/walkthrough files (not copied) |"
        )
        out.append("|---|---|---|---|---|")
        for n, (cid, plans, items) in enumerate(gemini, 1):
            out.append(
                f"| {n} | `{cid[:8]}` | {len(items)} | {span(items)} | {', '.join(plans) or '-'} |"
            )
        out.append("")
        for cid, _plans, items in gemini:
            for ts, text in items:
                counter[0] += 1
                out.append(
                    f"### {counter[0]}. {stamp(ts)} · conversation `{cid[:8]}`\n\n{redact(text)}\n"
                )

    dest = Path(a.out)
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text("\n".join(out), encoding="utf-8", newline="\n")
    print(f"wrote {prep_n} preparation + {main_n} main + {gem_n} Antigravity prompts -> {dest}")


if __name__ == "__main__":
    main()
