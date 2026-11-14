# Frontend tab status

Updated: M4 done (feature complete) · lint, typecheck, 8 tests, build green

## Done
- M1-M2: router, actor picker, engine switch, tokens (light + dark), Queue (v1.2 `counts`, server filters; the queue is now the Cases page), Case read-only, Rules; visual check in headless Chrome
- M3: write actions from `action_checks` (assign, evidence, decide, reopen, appeal, appeal reviewer and outcome, close) in a dialog; server refusals shown in the dialog; `simplify` applied
- M4: Audit page (findings link to cases, auditor P/R/F1, triage, validation, synthetic caveat), 8 Vitest tests
- Later redesign: sidebar pages Overview, Cases, Test Lab (`/lab`, calls `POST /api/lab/run`), Audit, Rules; the "Show the engine" switch is gone (decision trail always visible on a case); Tailwind v4 and Recharts added
- Live API is now the default; `VITE_USE_FIXTURES=true npm run dev` gives the offline fixture demo (tests set it themselves)
- Dependencies (exact): react-router-dom 6.28.0 (routes), @tanstack/react-query 5.62.7 (refetch after writes), lucide-react 0.468.0 (icons), @radix-ui/react-dialog 1.1.2 (accessible action dialogs)

## Not verified
- Live API: the backend was not running, so the switch and the real response shapes are untested. Writes in fixture mode answer 501 by design.
- Dialogs and the Audit page have no screenshot check yet.

## Blocked
- none

## Contract change requests
- `GET /queue?status=` must accept a comma list: tiles send `status=open,under_review`, `appealed,appeal_review`, `decided,appeal_decided`.
- `/audit/metrics` and `/audit/validation`: shapes in `frontend/src/api/types.ts` (AuditMetrics, ValidationSummary) are my guess; please send the final ones.
