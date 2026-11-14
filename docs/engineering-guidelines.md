# Engineering guidelines

Goal: code and docs a new person can read in one sitting. When in doubt, choose the simpler option.
Checked by `ruff.toml` and `mypy` where possible; the rest is the review checklist in `.github/pull_request_template.md`.

## Keep it simple
- **Build only what a requirement needs.** Every feature traces to a row in [requirements.md](requirements.md). No speculative options, hooks or "future-proofing".
- **Plain beats clever.** Functions and Pydantic models first. No class hierarchies, abstract base classes, factories, plugin systems, decorators-that-hide-logic or metaprogramming.
- **Rule of three.** Duplicate twice; abstract only when a third real use appears.
- **Few dependencies.** Standard library and the stack already chosen. A new dependency needs a one-line reason in the PR.
- **Plain SQL** in repositories. No ORM, no query builders.
- **Delete before adding.** If something can be removed without losing a requirement, remove it.

## Readable code
- Small functions that do one thing (about 30 lines at most), shallow nesting, early returns.
- Names say what a thing is. No abbreviations a newcomer must decode.
- Type hints everywhere (`mypy --strict` runs in CI).
- Comments explain **why**, never what. One-line docstring on every module and public function. No commented-out code.
- Name constants and thresholds; no unexplained numbers in logic.
- Fail loudly. No bare `except`, no swallowed errors. One error format across the API.
- Respect the layers: `api → services → repositories → db`; rules are pure functions. See [backend/README.md](../backend/README.md).

## Tests
Few, short, behaviour-focused, with obvious names. Cover rules, boundaries and the four negative scenarios rather than
every line. Run at checkpoints, not after each edit ([decision 0007](decisions/0007-repository-structure.md)); CI runs them on every push.

## Documentation
- Every top-level folder has a short README: what it is, how to use it.
- Change the docs in the same commit as the code. Link instead of repeating facts.
- Write plainly: short sentences, concrete commands, no marketing language.
- Record non-obvious choices as a decision record in `docs/decisions/` (what, why, alternatives, when to revisit).
- Keep the README quick start working from a fresh clone.

## Limits that the tooling enforces
Cyclomatic complexity ≤ 8, ≤ 5 arguments, ≤ 10 branches, ≤ 30 statements per function, no `print` or commented-out code in
the backend, source files ≤ 300 lines. If a limit hurts, the code usually wants splitting, not the limit raising.
