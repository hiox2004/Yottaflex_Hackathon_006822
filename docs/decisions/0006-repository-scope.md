# 0006. What is and is not in the public repository
Date: 2026-11-14 · Status: Accepted

## Context
Development used a private working template (knowledge base, search and shrink tools, agent definitions, a starter
backend) and the organisers' problem statement text.

## Decision
The repository contains only submission-relevant material: source, schema, tests, CI, documentation, decision records,
requirements, generated seed data and the prompt log. It excludes (via `.gitignore`) the working template
(`kb/`, `tools/`, `research/`, `starter/`, `.claude/`, `CLAUDE.md`), the verbatim problem statement (`brief.md`), local
environments and secrets. The raw prompt export (`prompts/prompts.md`) is also ignored by default because pasted prompts
contain the problem statement; it is reviewed and added deliberately at the end.

## Why
Keeps the repo focused and reviewable, avoids republishing text that is not ours, and avoids committing machine-local
tooling or credentials. `requirements.md` records our interpretation of the brief.

## Consequences / revisit when
A fresh clone must run from the README alone, so no document may depend on an ignored path.
