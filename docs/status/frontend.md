# Frontend tab status

Updated: M2 done · Next: M3 (18:10), M4 (18:45 freeze)

## Done
- M1: router, actor picker, engine switch, fixture client, types, tokens (light + dark), Queue + Dismissed tab
- v1.2: tiles use `counts` from GET /queue; `needs_my_action` and status filters are sent to the server (client and fixtures)
- M2: Case page read-only (strip, gates, engine panel, journey rail, action list with reasons, record, timeline, eligible reviewers) and Rules page
- Visual check done with headless Chrome screenshots (Queue and Case, light and dark); fixed gate grid, journey rail "no appeal" state, actor select width
- Dependencies (exact): react-router-dom 6.28.0 (routes), @tanstack/react-query 5.62.7 (refetch after writes), lucide-react 0.468.0 (icons)

## Next
- M3 write actions from `action_checks`; M4 Audit page, live API, tests, build

## Blocked
- none

## Contract change requests
- Tiles "Under review", "Awaiting appeal" and "Decided" each span two statuses; the client sends `status=open,under_review` (comma-separated). Please accept a comma list on `GET /queue?status=`.
