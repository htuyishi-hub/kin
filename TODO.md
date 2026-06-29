# TODO - Auth0 redirect URI fix

## Plan steps
1. Locate all Auth0 redirectUri / callback / localhost hardcodes in the Expo app code.
2. Update/introduce a single redirectUri helper using `Platform.select`:
   - web: `${window.location.origin}/callback`
   - native: `AuthSession.makeRedirectUri({ scheme:'kin', path:'callback' })`
3. Ensure the same redirectUri value is used for:
   - Auth request (useAuthRequest)
   - Auth code exchange (exchangeCodeAsync)
4. Remove any remaining `https://localhost/callback` references.
5. Verify build/typecheck and runtime considerations.

