# Frontend tab status

Updated: M1 done · Milestone: M2 next (M2 17:20, M3 18:10, M4 18:45 freeze)

## Done (M1)
- Router (Queue live; Case, Rules, Audit are placeholders), actor picker (localStorage, `X-Actor-Id`), "Show the engine" switch (state only; panels in M2)
- API client with fixture mode (`VITE_USE_FIXTURES`, default on), `ApiError` from the envelope, hand-written types, design tokens (light + dark)
- Queue: "Needs you" default, tiles, band and "assigned to me" filters, Dismissed-flags tab, Load more; typecheck, lint and 2 tests green
- Dependencies (exact): `react-router-dom` 6.28.0 (routes, deep links), `@tanstack/react-query` 5.62.7 (refetch after writes), `lucide-react` 0.468.0 (icons)

## Next
- M2: Case page read-only (strip, gates, engine panel, journey rail, action list, timeline) and Rules page

## Blocked / needs from another tab
- none

## Contract change requests
- none (note: tiles count the loaded rows, newest 200, because `needs_my_action` is not a server filter)
