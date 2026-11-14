# Why the product has no AI in the decision path

**Stance.** Every outcome that touches a learner's record is set by a plain, versioned rule; AI helps us build and test the product, and it never decides anything in it.

Full position: [docs/ai-position.md](ai-position.md). Decision record: [0012](decisions/0012-no-llm-in-the-decision-path.md).

**Due process needs a reason a person can read.** A finding against a learner must be explainable. "a raw score at or above 0.60 opens a review; the adjusted score sets the band" can be read, disputed and re-run. A model's answer gives the learner nothing to contest.

**Reproducibility is checkable.** The same seed gives byte-identical data, and the same input gives the same triage. We check this with sha256 hashes of the generated files (`data/full/metrics.json`) and with `python -m integrity.cli repro`. A model is not byte-stable across runs or vendor updates, so we cannot promise the same answer twice.

**Evaluation stays honest.** Our labels and our auditor are both derived from the rules and the planted scenarios. An LLM judge would grade the product with the same kind of process it is supposed to check, so the result would be circular, and it would not reproduce either. The current numbers (8,960 clean submissions not flagged; 360 quote-only and 310 template-only overlaps dismissed) prove rule coverage on synthetic data, not accuracy on real work.

**The harm of a wrong answer lands on the learner.** A similarity score is evidence, not a verdict. Our synthetic set has 90 legitimate submissions that score high. They are not dismissed; all 90 reach a human reviewer. Ambiguity goes to a person, and the only automatic dismissals (quote-only and template-only overlaps) favour the learner.

**Learner work stays inside the system.** Submissions and identities are personal data. Nothing is sent to a third-party model service, so no disclosure decision is made by a convenience feature.

## Where AI helps and how we constrained it

| Where | What AI does | Constraint |
|---|---|---|
| Development | Claude Code agents write and review code, docs and tests | Agents do not decide product behaviour; the brief, the requirements matrix and the decision records do. Every human prompt is exported to `prompts/prompts.md` by a script that calls no model. |
| Test Lab | An external chat model proposes test cases in a fixed JSON shape | The rules dispose: `POST /api/lab/run` is stateless and stores nothing. `POST /api/lab/import` is admin-only and only opens cases that await human review, so an imported case is never decided by the model. Expectations are written by the model, so a wrong expectation gives a wrong pass or fail; the README says so. |

## What we would add next

A plain-language case summary for the reviewer, assist-only. Each claim must cite an evidence or event id that exists in that case; if any id is unknown, the summary is dropped and the reviewer sees the structured panel only. It recommends no outcome and is never stored as evidence. Not built.

## Honest cost

- We give up the applied-AI credit a model in the product would earn. A grader who values AI inside the product may score this lower, and we accept that.
- What we built instead: a deterministic rule engine with named, versioned rules; an auditor that checks the workflow's own invariants; byte-reproducible synthetic data with hashes; a stateless Test Lab that lets an external model help write test cases while the rules give the verdicts; and an evaluation that reports misses as well as hits.
- Our scores prove rule coverage on synthetic data. They do not prove the rules generalise to real submissions.
