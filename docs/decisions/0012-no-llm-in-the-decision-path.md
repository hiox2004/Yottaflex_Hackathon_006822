# 0012. No LLM in the decision path
Date: 2026-11-14 · Status: Accepted

## Context
The brief is an academic-integrity case workflow. A similarity flag can end in a finding against a learner, so the
system must be explainable, contestable and reproducible. Language models are tempting for summaries and for judging
"is this really copying", and the brief rewards applied AI. The repository has no LLM SDK imports and no model calls.
`backend/src/integrity/ai/__init__.py` is a docstring-only stub for an optional, off-by-default local model. Decision
0003 already made AI optional and last.

## Decision
- No model reads, scores, ranks, classifies or decides anything about a submission, a flag, a case, a reviewer or an
  outcome. Triage, conflict checks, lifecycle rules, the decision guard, auto-dismissal and the auditor are
  deterministic Python and SQL.
- AI is used for development (Claude Code agents, logged in `prompts/prompts.md`) and for the Test Lab, where an
  external chat model proposes test cases that the stateless `POST /api/lab/run` checks against the pure rules.
- AI output is never stored as evidence, never becomes a flag or a decision, and never sets an outcome field.
  `POST /api/lab/import` (admin-only, one transaction) creates submissions, reports and opening cases only, never
  decision rows.
- Any AI assistance added later is assist-only and must follow the guardrails and evaluation in
  [docs/ai-position.md](../ai-position.md), section 5.

## Why
- Due process needs a reason a person can read, contest and reproduce. A rule with a dated threshold gives that. A
  model output does not.
- A similarity score is evidence, not a verdict. The system opens a review, and a human decides.
- Model output cannot be shown byte-stable across runs or vendors. The reproducibility requirement (same seed gives
  identical data, same input gives the same triage) is verified by `cli repro` and sha256 manifests, and we cannot
  make that check for a model.
- Bias and false-positive harm fall on the learner. The synthetic data has 90 false-positive submissions. All 90 open
  as cases for human review, because a score alone cannot dismiss them. Only quote-only and template-only overlaps
  are auto-dismissed, and only in the learner's favour.
- An LLM judge cannot be evaluated without circularity. Our labels are rule-derived, so a model graded on them is
  graded on agreement with the rules, not on truth.
- Learners' submissions should not go to a third party by default.

## Alternatives considered
- An LLM reviewer assistant that proposes outcomes: rejected. It moves judgement to a model that cannot be audited.
- A local model case brief (decision 0003): not built. It was scoped out to protect the deterministic core and time.
- A model-generated test set: allowed only in the Test Lab, where the rules, not the model, give the verdict.

## Consequences / revisit when
- The applied-AI part of the brief is met by assistive tooling and rigorous rule evaluation, not by a model in the
  decision. A grader who values AI in the product may score this lower. Section 6 of the position doc says so.
- The known false-negative cost (70 of 280 genuine copies not surfaced) is a policy choice, not a model choice.
- Any future AI feature needs its own record, a grounding check, a blind comparison against human output, and proof
  that outcomes are identical with and without it.
- Revisit if the brief asks for a model in the decision path, or if a local, versioned, byte-stable model can be
  shown to meet the reproducibility requirement.
