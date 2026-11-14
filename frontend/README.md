# Frontend

React + Vite single-page app. Built after the data and rules are verified.

**Boundaries (keep the tiers separate):**
- Standalone project: its own `package.json`, lint config and tests. No Python or backend imports.
- Talks to the backend only over HTTP under `/api` (Vite dev proxy in development; static build served by the backend or any web server for the demo).
- API types are generated from the backend's OpenAPI schema, never hand-copied.

Planned layout:
```
src/
  api/          generated client + fetch wrapper
  features/     one folder per feature (queue, case-detail, timeline, appeals, audit)
  components/   shared UI
  routes/ lib/
```
