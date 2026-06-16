# Project Rules

## Git Workflow — MANDATORY

**After every code change**, automatically run the full commit + push cycle without asking:

1. `git add` the modified files (specific paths, never `git add -A`)
2. `git commit` with a descriptive message that explains the *why*
3. `git push origin <current-branch>` — push to the currently checked-out branch

Always commit and push as a final step. Do not leave uncommitted or unpushed changes when a task is complete.

When the current branch is `main`, the push triggers Vercel production deployment via the GitHub integration. There is no need to invoke `vercel` CLI separately.

## Data Completeness — History APIs

When adding or modifying any time-series source under `app/api/`:

- Any external API with per-request record limits (OKX Rubik, OKX market candles, OKX funding rate, Yahoo Finance, etc.) **must paginate** when the requested range exceeds a single page.
- Do not silently truncate longer ranges (`Math.min(300, …)` style caps are a bug, not a feature).
- Verify left-edge coverage at `1y`, `5y`, `10y`, and `max` ranges — every enabled series should have data at the earliest timestamp, not just the most recent 300 points.

## Code Style

- Avoid adding comments that describe *what* the code does — names should do that.
- Add comments only for *why*: hidden constraints, workarounds, surprising invariants.
- No `// removed`, `// TODO once we …`, or other rot-prone notes.
