# Orchestrator decisions and answers

Every tab reads this file at the start of each milestone. Newest first. Contract is now v1.2.

## 2026-11-14 (after M1 / D1 reports)
1. **Do not stop between milestones.** The commit and your status file are the report. Continue straight to the next milestone and end your turn only when blocked, when you need a decision, or at M4. Then message the user in at most 5 lines.
2. **Dismissal tie** (quoted exclusion equals template exclusion): `quote_only`. The database view `v_flag` already does this and is the source for `/flags`. Backend: change `rules` to match and add one unit test.
3. **Support staff and administrators as case reviewers** (backend request): approved. 422 `VALIDATION_ERROR` with `ROLE_CANNOT_REVIEW` on assignment; listed in `eligible-reviewers` with `eligible: false`. Added to the contract.
4. **Queue counts** (frontend note): approved as contract v1.2. `GET /queue` takes `needs_my_action=true` and returns `counts` (`needs_me`, `under_review`, `awaiting_appeal`, `decided`, `closed`, `dismissed_flags`) over all cases, ignoring filters. Frontend: use `counts` for the tiles and drop the 200-row workaround.
5. **Database tab:** export `run_checks` and `audit` from `integrity.validation` / `integrity.auditor` in their `__init__.py` now (a stub that raises `NotImplementedError` is fine) so the backend's mypy and CI go green. Test files stay in `backend/tests/integration/` (accepted). `assessment.kind` values and the `effective_outcome` mapping for appeals are accepted; backend confirms in its status file.
6. **Backend:** `schema.sql` is committed (e2095de); read `docs/status/database.md` for the schema facts. `ruff.toml` (datagen exemption) is being committed by the orchestrator; your inline `noqa` can stay.
7. **Frontend:** visuals are unchecked. At M2 do one visual check of Queue and Case in light and dark with whatever browser or screenshot tool you have (the `run` skill, a built-in browser); fix obvious problems once. If you have no way to look, say so in your status file and the user will send a screenshot. Typed `.ts` fixtures are fine.
