# Agent Guidelines — kinn Monorepo

## Core Product Rule: The UI Never Explains Steps

**Allowed in the UI:**
- Screen titles
- Field labels
- Placeholders
- Button text
- Short validation errors
- Short status messages (e.g., "Code sent")
- Empty-state titles
- Progress indicators

**NOT allowed in the UI:**
- Any sentence that explains what will happen next
- Why we need something
- How a feature works
- What a step is for
- Marketing or helper paragraphs under titles or fields

> **Principle:** Users must understand by doing, not by reading. Keep screens minimal, actionable, and uncluttered.

---

## Security Rules (Always Enforced)
- Never print, log, write to files, or commit any token, key, secret, or password.
- If a credential is missing, STOP and ask the user. Do not search files, shell history, processes, or scratch files for credentials.
- Do not run SQL or migrations against production without showing the user the SQL first and receiving explicit approval.

---

## Architecture & Internationalization (i18n)
- **App Name:** `kinn` (APP_NAME configured in a single place).
- **Languages:** Exactly two supported UI languages: Kinyarwanda (`rw`) and English (`en`).
- **No Dual-Language Text:** A user sees only ONE language at a time, never both side-by-side (e.g. no "Kinyarwanda · English" headers).
- **First-Screen Selection:** Language choice is made on the welcome screen before authentication, and can be toggled in the Profile tab at any time without restarting the app.
- **Shared Translations:** All user-visible strings must be retrieved via `t('key')` from `@workspace/i18n` (`lib/i18n/src/locales/en.json` and `rw.json`). Never hardcode English or Kinyarwanda strings directly in JSX or Alert calls.
- **Dynamic Content:** Always use translation variables (e.g. `{{name}}`, `{{count}}`) instead of string concatenation (e.g. `"Hello " + name`).
- **Push & SMS:** API server notifications must respect the recipient profile's language preference (`recipient.language`).

---

## Workspace Structure
- `artifacts/kin`: Expo React Native mobile application.
- `artifacts/kin-web`: Vite / React web application mirroring mobile UI.
- `artifacts/api-server`: Express REST API & WebSocket server.
- `lib/i18n`: Shared i18next localization library and translations (`en.json`, `rw.json`).
- `lib/api-client-react`: Generated React Query API client.
- `lib/api-spec`: OpenAPI specification and codegen.

---

## Quality Gate
- Run `pnpm run typecheck` after every change to ensure 0 TypeScript errors across all workspace packages.
- Commit frequently with small, focused commits.
- Do not push directly to `main` without explicit approval.
