# AI position: why the decision path has no AI

Audience: hackathon judges and academic-integrity staff.
Decision record: [0012](decisions/0012-no-llm-in-the-decision-path.md). Related: [0003](decisions/0003-deterministic-core-optional-ai.md).

Every number below was read from a file in this repo on 2026-11-14. Paths are relative to the repo root.

## 0. The position in 5 lines

1. No model reads, scores, ranks or decides anything about a submission, flag, case, reviewer or outcome.
2. Triage, conflict checks, lifecycle rules, the decision guard, auto-dismissal and the auditor are plain, deterministic code.
3. AI helps us build the product (Claude Code agents) and helps us test it (an external model proposes Test Lab cases).
4. AI output never touches the case database and never becomes evidence, a flag or a decision.
5. Any AI assistance we add later is optional, assist-only, guarded and evaluated before anyone trusts it.

## 1. Decision-by-decision map

Every automated decision or step in the product, and what an LLM would change there.

| Step | What decides (code) | Why a deterministic rule is right here | What an LLM would add | What it would break |
|---|---|---|---|---|
| Triage band | `backend/src/integrity/rules/triage.py` `band_for()` and `triage()`. Thresholds in `data/full/integrity_rule.csv`: log 0.30, review gate 0.60; priority 0.80 (v1) and 0.85 (v2, from 2026-06-01). | A threshold is a sentence a learner can read and dispute. A change of threshold is a new, dated rule version (validation check `rule_in_force`). | A judgement of "is this copying", which is the thing we cannot check. | Reproducibility (same report, same band). Explanation (no threshold to cite). Evaluation (no fixed labels to score against). Privacy (submission text sent out). |
| Auto-dismissal when quotes or templates explain the overlap | `triage.py` `triage()` and `dismissal_reason()`: a flag whose adjusted score falls below the gate is dismissed, and the larger exclusion is named. | The exclusions only lower a score, so a dismissal can only favour the learner. A dismissal is recorded with its reason. | Could spot a quote that the matcher missed. | Could dismiss real copying with no traceable reason. The current rule already dismisses 30 genuine copies this way (section 7, Q3), so a model would have to be right more often than the rule, and we could not show that. |
| Conflict-of-interest check on case reviewers | `backend/src/integrity/rules/conflicts.py` `conflict_reasons()`: role, instructor of the assessment, same department, reviewed this learner before, already on the case. | Each reason is a fact in the database, and each has its own message. The facts are organisational data, not judgement. | Nothing useful. The inputs are already facts. | Explanation ("why can't I assign X?" becomes "the model thought so"). Also a wrong refusal would have no fix. |
| Independence check for appeal reviewers | `conflicts.py` `independence_reasons()` (conflict check plus "decided this case"); `is_independent()`. | Same as above. An appeal reviewer who decided the case is a fact, not a guess. | Nothing. | Same. The auditor's `APPEAL_CLOSED_NO_INDEPENDENT_REVIEW` check depends on exact facts. |
| Decision guard for a confirmed violation | `backend/src/integrity/rules/lifecycle.py` `guard_confirmed_violation()` and `guard_cited_evidence()`. A confirmed violation needs a rationale of at least 20 characters and at least one matched passage or source reference. Quotes, templates and learner statements alone are refused. A decision may cite only evidence of its own case. | This is the rule that stops a score from becoming a finding. It is a checkable list of evidence kinds. | A drafted rationale, which is the text the learner reads. | Grounding. A model can write a fluent rationale that cites nothing real. The guard would then pass on text, not on evidence. |
| Appeal window | `lifecycle.py` `_window_end()` and `_specific_reasons()`. `appeal_window_days` = 14 in `integrity_rule.csv`. An appeal is refused after the window; a close is refused while an adverse decision's window is open, unless an administrator records a waiver. | A date rule. Time is data, and the rule can be read in one line. | Nothing. | A model could invent a date or a deadline. |
| Close rule | `lifecycle.py` `TRANSITIONS` (the legal status changes) and `APPEAL_UNRESOLVED`. Mirrored in SQL in `backend/src/integrity/validation/checks.py`. | A transition table is exhaustively testable. The validator replays every case event against it. | Nothing. | The replay check (`lifecycle_replay`, `transition_table_matches`) would have no fixed oracle. |
| Audit findings (independent auditor) | `backend/src/integrity/auditor/findings.py`: SQL detectors for four issue types (`AUTO_GUILT_WITHOUT_REVIEW`, `REVIEWER_CONFLICT`, `EVIDENCE_AFTER_DECISION_NO_HISTORY`, `APPEAL_CLOSED_NO_INDEPENDENT_REVIEW`). | Each finding is a query that anyone can run and check. | A model reviewing other decisions for due-process failure. | The auditor would be the least checkable part of the system: it is the one that judges the others. |
| Explanations shown to the user | `triage.py` `explain_triage()` returns ordered steps (raw score, exclusions, adjusted score, band, outcome) built from the same numbers. | The explanation is the rule, printed. It cannot disagree with the rule. | A fluent paraphrase. | Drift. A paraphrase can say something the rule did not do, and nobody can check it against the rule. |
| Validation | `backend/src/integrity/validation/` and `data/full/validation.json`: 19 checks, 0 violations on the full dataset (`result: PASS` in `data/full/validation_summary.md`). | Validation is only useful if it is exact. | Nothing. | A validator that can say "probably fine" is not a validator. |

Test Lab (AI proposes test cases, rules dispose) is not a product decision. It is covered in section 4.

## 2. Evaluation argument

**Why our evaluation works.** Our labels come from documented rules, and the auditor re-derives its findings from the database with fixed queries. That gives us a check we can run and re-run:

- The generator writes the labels with the scenarios (`data/ground_truth/full/ground_truth.csv`, 10,211 rows). They cover 10,000 latent scenarios, one per submission (`false_positive` 90, `genuine_copy` 280, `legitimate_quote` 360, `shared_template` 310, `clean` 8,960), 32 injected anomalies, 32 decoys (legitimate cases that look like an anomaly) and 147 expected decisions (109 `violation_confirmed`, 28 `no_violation`, 10 `inconclusive`).
- The auditor has no access to the labels. `backend/tests/unit/test_no_ground_truth_leak.py` fails if any application, API, validator or auditor file mentions the ground truth. Only `datagen` and `eval` may.
- Scores on the labelled set (`data/full/metrics.json`): precision, recall and F1 of 1.0 for all four issue types (found 8/8, 10/10, 8/8, 6/6). Triage by scenario has a hit rate of 1.0 for `clean`, `legitimate_quote`, `shared_template` and `false_positive`, and 0.75 for `genuine_copy` (70 misses; see section 7, Q3).

**Why an LLM judge cannot be evaluated the same way.**

1. *Circularity.* To grade a model's "copied or not" call we need labels. Our labels are rule-derived: the generator and the rules were written from the same spec. A model graded on rule-derived labels is graded on agreement with the rules, not on truth. A model graded on human labels needs human labels we do not have.
2. *No stable oracle.* A model answer on the same input can change with the vendor's model version, and we cannot fix it with a seed we can rely on (verify against the vendor's current API documentation before stating this in a talk). Then the same evaluation gives a different score on a different day, and a regression has no clear cause.
3. *The metric hides the problem.* A model could score well on our synthetic scenarios, which are generated from templates. That would say nothing about real writing.

**What we do require, and check.**

- Same seed, same bytes. The seed is `20261022` (`data/full/manifest.json`, `generator_version` 1). The manifest holds a SHA-256 for every generated file. `python -m integrity.cli repro --scale full` (`backend/src/integrity/datagen/paths.py` `reproduce()`) generates the dataset twice into temporary folders and fails unless the counts and checksums match.
- Same input, same triage. `dataset_hash` (`750df00c...` in `data/full/metrics.json`) ties the metrics to the data, and `flag_agreement` in the validator checks that the Python triage matches the `v_flag` SQL view.
- Limits we state: the labels are only as good as the spec, and F1 of 1.0 is partly circular. `docs/DEMO.md` (beat 5) says so, because the rules and the auditor were written together.

## 3. Harm model

**Who is hurt by a wrong automated outcome.** The learner. A false positive opens a case against a person who did nothing wrong. Other harms exist: reviewer time spent on a false case, and a reviewer who over-trusts a number. The learner carries the cost of the case, and they usually cannot see the data that produced it.

**The cost is asymmetric, and our design leans toward the learner.**

- A false positive (a legitimate submission that scores high) harms a learner directly.
- A false negative (real copying that is not surfaced) harms the integrity of the assessment and other learners. It is also a real failure that we report.
- Our design pushes ambiguity to a human, and exclusions only ever lower a score. A quote or a template can dismiss a flag but can never raise one. The appeal window (14 days), the independent appeal reviewer and the rule that a confirmed violation needs incriminating evidence all sit on the learner's side.

**Our own data point.** The seed contains 90 `false_positive` submissions: legitimate work that scores high. Verified against `data/full/similarity_report.csv`, `data/full/flags.csv` and the ground truth:

- raw score 0.600 to 0.830, adjusted score 0.600 to 0.799;
- all 90 open as cases for human review (`outcome` = `case_opened`, `band` = `review`);
- none of them is auto-dismissed, because nothing in the rules can tell them apart from genuine copying by score.

This is the failure we most want a human to catch, and the design does that: the case exists, and a person decides. A model that judged "copied or not" would produce the same 90 cases, with a confident paragraph attached to each one, and the learner would have to argue against the paragraph.

**Nothing lets a score alone become a finding.** A flag is "a case may be opened for review" (`triage.py` docstring: "Never a finding of guilt"). A confirmed violation needs a rationale of at least 20 characters and an incriminating evidence kind (`lifecycle.py` `guard_confirmed_violation()`). Quotes, templates and learner statements are refused as proof.

## 4. Where AI is used, honestly

**a) Development.** Claude Code agents write and review code, docs and tests under our rules (`docs/engineering-guidelines.md`, decision 0008). Every human prompt is exported from the local session transcripts with `python prompts/export_prompts.py` into `prompts/prompts.md` (about 550 lines at time of writing). The export reads local files only and costs no model tokens. Agents do not decide product behaviour. The brief, the requirements matrix (`docs/requirements.md`) and the decision records do.

**b) The Test Lab (AI proposes, rules dispose).** The Lab page gives the user a copy-paste prompt (`frontend/src/lib/labPrompt.ts`). The user takes it to any external chat model, which writes cases in a fixed JSON shape: scores, reviewer facts, decisions, late evidence and an `expect` block. The user pastes the result back.

- `POST /api/lab/run` (`backend/src/integrity/services/lab_service.py`, "Stateless, never writes") validates the shape (`extra="forbid"`, scores between 0 and 1), runs each case through the same pure rules the product uses, and compares the result with `expect`. It reads the active rule and stores nothing.
- `POST /api/lab/import` (`backend/src/integrity/services/lab_import_service.py`) is admin-only (`ADMIN_ONLY`, tested in `backend/tests/api/test_lab_import.py`). It runs as one transaction, so a bad case fails the whole batch (`test_one_bad_learner_fails_the_whole_batch`). It triages each case with the real `triage()`. It creates submissions and similarity reports, and for cases that open, an integrity case with its evidence and timeline events. It writes no decision rows and no outcome fields. The model's `reviewer`, `decision`, `late_evidence` and `expect` are ignored on import.

Limits we accept: the model writes the expectations, so a wrong `expect` gives a wrong pass or fail. The Lab tests the rules against a stated expectation, not against truth. A Lab case carries scores and facts, not learner text (`lab_import_service.py` docstring: "a Test Lab case has no document").

## 5. What we would build next, and how we would evaluate it

None of these is built. The first is the one we would build with another day.

**The case summary assistant (assist-only).** It restates the facts already in the case file for the reviewer, with each claim citing an evidence or event id.

- *Grounding check.* Every claim must cite an id that exists in that case. Any unknown or uncited id drops the summary, and the reviewer sees only the structured panel. We measure the share of summaries that pass.
- *Blind comparison.* Two reviewers see the model summary and a human-written summary for the same cases, without knowing which is which. We measure whether the model summary is accurate and complete. We report cases where the human or template summary does as well.
- *No change to outcomes.* On the same seeded cases, the decisions and the audit trail must be identical with and without the summary. If they differ, the feature is off.
- *Replay.* Every prompt and output is logged with a timestamp, model id and prompt hash. A stored response is replayed for demos and reruns, so results are reproducible. (Planned. The config has no model setting today.)
- *Redaction.* Learner identifiers are replaced by ids before anything leaves our system, and only the text needed is sent.

**Non-goals for every AI feature.**

- No outcome, band, status, dismissal, close or reviewer-assignment field, written by a model or read from one.
- No AI output stored as evidence, a flag, a case field or a decision. It is shown, never saved as a record.
- No learner-facing text generated by a model without a human reading it first.
- No model in triage, conflicts, the decision guard, the lifecycle or the auditor.
- No sending of learner submissions to a third party by default. That is an institutional decision.
- No replacing the rule with the model "because it scores better" until the blind comparison and the outcome-identity check pass on the same cases.

## 6. Honest costs of this choice

- **Graders may value applied AI.** We expect some judges to read "no AI in the decision" as a gap. The product does not use a model to make a judgement, and the only model use in the product is the optional Test Lab workflow, which is out of band. We say so rather than hide it.
- **We chose depth over a feature that is hard to check.** What we built instead: a rule engine with versioned thresholds (`integrity_rule.csv`), a conflict and independence check with a message per reason, a lifecycle with a legal-transition table and a 14-day appeal window, the decision guard, an independent auditor with four detectors, 19 validation checks (0 violations), an evaluation with labelled negatives (32 decoys against 32 anomalies), a Test Lab that checks the rules against stated expectations, and end-to-end tests (`e2e/`, Playwright).
- **Our evaluation is partly circular.** The rules and the auditor were written together, so F1 of 1.0 shows that the implementation matches the spec, not that the spec is right on real submissions.
- **The synthetic data proves coverage, not generalisation.** Every metric in `data/full/metrics.json` carries the caveat "synthetic data: scores show rule coverage, not generalisation".
- **The false-negative cost is real.** 70 of 280 genuine copies are not surfaced (section 7, Q3). The rules are more lenient than a strict integrity office might want, and that is a policy choice we make visible.
- **The actor header is a stub, not authentication.** Roles are a development convenience, not a security control.

## 7. Questions a judge may ask

**Q1. Isn't this just a rules engine?**
A. For the decisions, yes, and that is the point. A rules engine with dated thresholds, a conflict check with a reason for each refusal, a lifecycle replay and an independent auditor is what due process can read, dispute and re-run. It is less impressive than a model, and it is checkable.

**Q2. Why not use an LLM to explain decisions?**
A. The product already produces its explanations from the rule: `explain_triage()` prints the raw score, the exclusions, the adjusted score, the band and the outcome from the same numbers. An LLM paraphrase could drift from the rule, and nobody could verify the drift. If we add a model summary later, it is assist-only, cites evidence ids, and is checked against the case before a reviewer sees it (section 5).

**Q3. What about the false negatives: 70 of 280 genuine copies not surfaced?**
A. The split is exact. 40 are never flagged, because their raw score is below the 0.60 review gate (`genuine_copy` with raw < 0.60: 40). 30 are auto-dismissed, because quotes or templates explain the overlap. That is a real miss, and we report it. The gate and the exclusions are a policy decision with a learner-protective default: a score alone must not open a case against a learner, and a quote alone must not look like copying. Changing the gate is a rule-version change, not something to delegate to a model. We have not yet run a threshold sweep that shows the trade-off for an institution. That is the next step, and the result would go to the policy owner, not into a model.

**Q4. Could an LLM help reviewers?**
A. Yes, in principle, and that is the honest answer. A grounded, assist-only case summary is the lowest-risk use. It is not built. Section 5 lists the grounding check, the blind comparison, the outcome-identity check and the non-goals we would hold it to.

**Q5. Isn't your evaluation circular?**
A. Partly, and we say so. The labels come from the same spec as the rules, so 1.0 precision and recall show that the implementation matches the spec. They do not show that the spec is right on real submissions. The decoys make the test harder: a rule that flagged everything would fail on the 32 legitimate cases.

**Q6. Is your data realistic?**
A. It is synthetic, from a seeded generator, and the README and metrics say so. It proves rule coverage. It does not prove accuracy or fairness on real writing. A pilot on consented, anonymised institutional data would be the next evaluation, and it would need a data-protection review first (verify the applicable policy for the institution).

**Q7. Where does learner data go? Does a model see it?**
A. No model call exists in the product. The Test Lab is an optional, out-of-band workflow where a user pastes cases into a chat model of their choice, and a Lab case carries scores and facts, not learner text. A future assistant would use local or approved models only, with redaction, and only after the institution decides.

**Q8. What stops a score alone from becoming a finding?**
A. The decision guard. A confirmed violation needs a rationale of at least 20 characters and at least one matched passage or source reference, and the cited evidence must belong to the case (`lifecycle.py` `guard_confirmed_violation()`, `guard_cited_evidence()`). A high score opens a case for review. It cannot close one with a finding, and an appeal is decided by a reviewer who did not decide the case (`conflicts.py` `independence_reasons()`).

## Other limits

- Synthetic data proves that the rules cover the injected cases. It does not prove accuracy on real submissions.
- The Test Lab expectations come from whichever model wrote the cases.
- The actor header is a stub, not authentication.
