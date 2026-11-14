#!/usr/bin/env python
"""Export every human prompt from Claude Code session transcripts to prompts/prompts.md.

Costs zero model tokens: it only reads the local .jsonl transcripts that Claude Code
already writes to ~/.claude/projects/<workspace-slug>/.

Usage (run from repo root, any time, safe to re-run - it rewrites the output):
  python tools/export_prompts.py                 # all sessions of this workspace
  python tools/export_prompts.py --latest        # only the newest session
  python tools/export_prompts.py -o prompts/final.md
"""

import argparse
import json
import os
import re
import sys
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def project_dir() -> Path:
    slug = re.sub(r"[^A-Za-z0-9]", "-", str(ROOT))  # c:\CandidateWorkspace -> c--CandidateWorkspace
    base = Path.home() / ".claude" / "projects"
    for cand in (base / slug, *base.glob(slug.lower())):
        if cand.exists():
            return cand
    for d in base.iterdir():  # case-insensitive fallback
        if d.name.lower() == slug.lower():
            return d
    sys.exit(f"No transcript folder found under {base} for {ROOT}")


def prompts_from(path: Path):
    for line in path.open(encoding="utf-8", errors="replace"):
        try:
            o = json.loads(line)
        except ValueError:
            continue
        if o.get("type") != "user" or o.get("isSidechain"):
            continue
        if (o.get("origin") or {}).get("kind", "human") != "human":
            continue
        c = (o.get("message") or {}).get("content")
        if isinstance(c, list):
            c = "\n".join(b.get("text", "") for b in c if b.get("type") == "text")
        if not isinstance(c, str) or not c.strip():
            continue
        c = re.sub(r"<system-reminder>.*?</system-reminder>\s*", "", c, flags=re.S).strip()
        if c:
            yield o.get("timestamp", ""), c


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--latest", action="store_true")
    ap.add_argument("-o", "--out", default=str(ROOT / "prompts" / "prompts.md"))
    a = ap.parse_args()

    files = sorted(project_dir().glob("*.jsonl"), key=os.path.getmtime)
    if a.latest:
        files = files[-1:]

    stamp = f"{datetime.now():%Y-%m-%d %H:%M}"
    out = [f"# Prompt log\n\nExported {stamp} from {len(files)} session(s).\n"]
    n = 0
    for f in files:
        items = list(prompts_from(f))
        if not items:
            continue
        out.append(f"\n## Session {f.stem[:8]}\n")
        for ts, text in items:
            n += 1
            out.append(f"### {n}. {ts[:19].replace('T', ' ')} UTC\n\n{text}\n")
    Path(a.out).parent.mkdir(parents=True, exist_ok=True)
    Path(a.out).write_text("\n".join(out), encoding="utf-8")
    print(f"wrote {n} prompts -> {a.out}")


if __name__ == "__main__":
    main()
