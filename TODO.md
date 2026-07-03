# TODO

## Step 1 — Minimal instrumentation for /api/auth/auth0
- [ ] Wrap the handler in a single outer try/catch.
- [ ] Add structured `req.log.info()` markers before each major operation.
- [ ] Add elapsed time (`durationMs`) per operation.
- [ ] Add `req.log.error()` with the caught error (full object) when failures occur.
- [ ] Avoid introducing a reusable tracing abstraction (e.g. `traceStep`).
- [ ] Avoid logging PII (no raw email); log booleans/derived provider info instead.

## Step 2 — Reproduce & confirm
- [ ] Run api server.
- [ ] Trigger one failing auth0 login.
- [ ] Confirm logs identify the exact failing operation/statement that causes HTTP 500.

