# Academic Integrity Workflow frontend

React + TypeScript + Vite single-page app. It shows the app title and whether the backend answers `/api/health`.

Rule: this app talks to the backend only over HTTP under `/api` and never imports backend code.

## Commands

```
npm install
npm run dev        # dev server; /api is proxied to http://localhost:8000
npm run build      # typecheck + production build to dist/
npm run lint       # ESLint
npm run typecheck  # tsc --noEmit
npm run test       # Vitest (jsdom)
```
