# 0003. Deterministic core; local AI is an optional add-on
Date: 2026-11-14 · Status: Accepted

## Context
There is no budget for a paid model API. A local small model (`llama3.2:3b` via Ollama) is possible. The brief scores
the generated data, its validity, reproducibility and traceability; it does not require AI. All data is synthetic, so any
AI explanation would be explaining fabricated text.

## Decision
- Everything that matters is deterministic Python/SQL: data generation, IDs, threshold evaluation, reviewer conflict
  checks, state transitions, validation, the auditor. No model is ever used to generate data.
- A local-model "case brief" (flag explanation and appeal dossier) is an optional layer, built last, off by default
  (`AI_ENABLED=false`), read-only, labelled advisory, with a deterministic fallback in the same shape.
- Any AI output must pass a faithfulness check: every ID and number it cites must exist in that case's data, otherwise
  it is discarded in favour of the fallback.

## Why
- LLM output is not byte-stable even at temperature 0, which would break the reproducibility proof.
- Most "why was this flagged" content is already available as structured fields; a structured panel is clearer and safer.
- In a due-process setting the model must not judge, rank guilt or write state.

## Alternatives considered
No AI at all (valid, and the fallback if the spike test fails); an AI-driven reviewer assistant (rejected: judgement
and hallucination risk); natural-language search and learner notices (rejected: low value or wrong tool for fixed wording).

## Consequences / revisit when
Build the AI layer only after the core is verified. Report measured faithfulness and fallback rates honestly, including
when the template baseline does as well as the model. Drop it if the spike test is slow or unreliable.
