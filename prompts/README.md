# prompts/

Record of the prompts used on this project (for the write-up / demo).

**Do not hand-log prompts in chat; it costs tokens.** Claude Code already saves every session
as a local transcript, so export at the end (or any time) at zero token cost:

    python prompts/export_prompts.py            # all sessions -> prompts/prompts.md
    python prompts/export_prompts.py --latest   # newest session only

Optional: add notes by hand in `prompts/notes.md` (what worked, what you changed and why).
