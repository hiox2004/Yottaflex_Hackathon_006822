# 0011. Parallel tabs and delegation policy
Date: 2026-11-14 · Status: Accepted

## Context
Frontend and backend can be built in parallel by separate sessions (tabs). Each session can also hand chunks to cheaper Haiku
subagents. We want speed and good code quality without burning tokens.

## Decision
- Two worker tabs (backend, frontend) plus an orchestrator tab, with strict folder ownership, one frozen API contract, status files
  and commits limited to a tab's own paths ([05-scope-and-workflow.md](../plans/05-scope-and-workflow.md)).
- In each worker tab the main model (Sonnet) leads. It designs, owns the contract and rules logic, integrates and reviews diffs.
- A tab may delegate to Haiku subagents only when the chunk is (1) large and mechanical (roughly 150+ lines), (2) described by a spec
  shorter than the work, (3) checkable by a command (tests, lint, typecheck, build), and (4) not a design or rules decision. At most two at a time.
- Delegate: dictionary and docs from the schema, plain read queries and endpoints from the contract table, export writers, UI pages
  from fixtures, unit tests for pure functions, the independent auditor written from the brief alone.
- Never delegate: schema design, rules and triage, generator quota and anomaly logic, transaction and guard logic, contract changes, integration.
- Haiku does not orchestrate: orchestration needs judgement about spec quality and diffs.

## Why
Observed in this session: Haiku agents passed lint, types and their own tests on well-specified chunks (frontend scaffold, validator, auditor,
dictionary) but each used 55k-97k tokens because a cold start re-reads files, and they missed cross-file consistency (fixtures, schema
details) that the lead had to fix. Delegation therefore saves cost only for large, verifiable chunks; for small ones the spec costs
about as much as the work. Parallel tabs save wall-clock time, not tokens.

## Alternatives considered
Haiku-led tabs (risk to rules and contract fidelity); everything inline in one Sonnet (slower, no independent auditor); no delegation at all.

## Consequences / revisit when
Lead reads diffs, not whole files, and runs checks only at checkpoints. Revisit if a delegated chunk needs more than one correction round.
