# Frontend plan (React + Vite + TypeScript)

Serves the 5-minute demo and the due-process story in the [HLD](00-hld.md); API in the [backend plan](02-backend-plan.md).
Keep the current Vite shell tooling; replace the content.

## 1. Users and goals
| Persona (actor picker) | Goal |
|---|---|
| Academic reviewer / instructor | Work the queue, review evidence, record a reasoned decision |
| Academic administrator | Assign conflict-free reviewers and independent appeal reviewers, close cases |
| Support staff | Add a learner statement, file an appeal on the learner's behalf |
| Auditor / judge (any actor) | See rules, audit findings, metrics and validation summary |
Learners exist only as data in a case (no learner login).

## 2. Screens (four, mapped to the demo)
| Route | Content | Requirements |
|---|---|---|
| `/` Queue | Cases: id, learner, assessment, adjusted score, band, status, assignees, age. Filters: status, band, assigned to me. "Load more" (keyset). Tab **Dismissed flags**: read-only rows with raw/quoted/template scores and the dismissal reason. | A1, E3, F4 |
| `/cases/:id` Case | Header (status, version, effective outcome); **Flag panel** (raw - quoted - template = adjusted, thresholds, band, rule id and version, "a flag is not a finding"); **Evidence** list + add; **Reviewers** with eligible list and plain-language conflict reasons; **Decision** form (outcome, rationale, cited evidence); **Appeal** (grounds, independent reviewer, outcome + rationale); **Timeline** (append-only, actor or "system", reason) | A2, A3, E4-E7, G1-G4 |
| `/rules` Rules | Rule versions with effective dates, thresholds, bands, appeal window, worked triage example | E3 |
| `/audit` Audit | Live auditor findings (linked to cases), P/R/F1 per issue type, triage and decision metrics, validation summary with counts and distributions, dataset hash, synthetic-data caveat | A4, H3, L1 |
Header: actor picker (id, name, role) stored in `localStorage` (try/catch) and sent as `X-Actor-Id`.

## 3. Stack
React 18, Vite, TypeScript strict, Vitest + Testing Library, ESLint. Added only with a reason:
- `react-router-dom`: four routes, deep links to cases (DEMO.md links straight to pinned cases).
- `@tanstack/react-query`: refetch after mutation keeps version and `allowed_actions` in sync; avoids hand-rolled fetch state.
Plain CSS (one file, CSS variables). No UI kit, state library, chart library (bars are CSS) or form library.

## 4. Structure
```
frontend/src/
  api/        client.ts (fetch, ApiError from envelope, X-Actor-Id) types.ts (hand mirror of backend models) hooks.ts
  pages/      QueuePage CasePage RulesPage AuditPage
  components/ FlagPanel EvidenceList DecisionForm ReviewerPicker AppealPanel Timeline Badge ErrorBanner ActorPicker
  labels.ts   display text keyed by server enum values
  main.tsx App.tsx styles.css
```
Files <= 300 lines, small single-purpose components, about 15 hand-written interfaces.

## 5. Key behaviours
- **Server decides legality.** Action buttons render only from `allowed_actions` in the case detail; the UI never re-implements rules.
  Rejections show the server message in `ErrorBanner` (conflict reasons, window still open, etc.).
- **Concurrency.** Mutations send `expected_version`; on 409 `STALE_VERSION` refetch and show "case changed, review again".
- **Explainability.** Score breakdown against threshold markers; band text says what happens next ("goes to human review").
- **Due-process wording.** Say "flagged for review", never "guilty", "cheater" or "plagiarised". Outcome label: "violation confirmed by reviewer".
- **Conflict UX.** Picker lists everyone with a verdict; conflicted or non-independent staff shown disabled with the reason.
- **Timeline.** Read-only; system actor shown as "system (triage)".
- **States.** Loading text, empty queue message, error banner with request id; a "metrics file missing or stale" notice on `/audit`.
- **Accessibility.** Labelled inputs, keyboard-reachable actions, focus moves to the error banner, status as text badge plus colour.

## 6. Data and API contract
Only `/api/*`; Vite dev proxy to `localhost:8000`; `VITE_API_BASE` default `/api`. Shapes (queue row, dismissed flag, case detail with
`allowed_actions`, timeline event, rule, finding, metrics) are defined by the backend models and mirrored in `types.ts`.

## 7. Testing (about 6)
Vitest: queue renders rows and filters; only `allowed_actions` buttons render; decision form blocks empty rationale; conflicted reviewer
disabled with reason; error envelope shows message and request id; stale version triggers refetch. `npm run build` and lint at
checkpoints. Manual demo checklist in `DEMO.md`.

## 8. Build order
Client, types, actor picker -> Queue -> Case read-only (flag panel, timeline) -> assign + decide -> evidence, reopen, appeal, close ->
Rules -> Audit -> copy, empty and error states. Freeze with the backend at the 85% mark.

## 9. Not doing
Auth screens, learner portal, websockets, i18n, dark mode, chart library, mobile layout beyond not breaking, client-side rules,
state library, storybook, OpenAPI type generation (hand mirror is enough for ~15 types).

## 10. Open questions
Resolved: actor picker is acceptable if the README states it is an authentication stub with server-side role checks; Audit is its own
route (a demo beat); dismissed flags are a tab on the queue; `allowed_actions` from the server is the right coupling (one source of rules).
Open: none for the frontend.
