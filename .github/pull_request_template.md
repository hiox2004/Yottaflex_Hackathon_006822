## What and why
<!-- One or two sentences. Link the requirement row(s) this closes, e.g. B3, G2. -->

## Checklist
- [ ] Simplest approach that meets the requirement; nothing speculative added
- [ ] No new dependency, or the reason is stated above
- [ ] Layers respected (`api → services → repositories → db`); no SQL outside repositories
- [ ] Tests are few and concise; checks run at this checkpoint (`ruff`, `mypy`, `pytest`)
- [ ] Docs updated in this change (README, `docs/`, decision record if a choice was non-obvious)
