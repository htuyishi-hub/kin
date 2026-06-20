---
name: Kin API client setup
description: setBaseUrl must be called at module level in _layout.tsx; setAuthTokenGetter is called in AuthContext when the token changes.
---

**Base URL:** Call at module level (outside any component/hook) in `artifacts/kin/app/_layout.tsx`:
```ts
import { setBaseUrl } from "@workspace/api-client-react";
setBaseUrl(`https://${process.env.EXPO_PUBLIC_DOMAIN}`);
```
`EXPO_PUBLIC_DOMAIN` is set to `$REPLIT_DEV_DOMAIN` in the dev script.

**Auth token:** Call in `AuthContext` whenever the token changes:
```ts
setAuthTokenGetter(() => newToken);   // on sign-in
setAuthTokenGetter(null);              // on sign-out
```

**Why:** The custom-fetch.ts module has module-level state `_baseUrl` and `_authTokenGetter`. Setting them at module load time ensures all API calls get the correct base URL. Token getter is called lazily before each request.

**How to apply:** If you add a new Expo artifact that uses `@workspace/api-client-react`, use the same pattern.
