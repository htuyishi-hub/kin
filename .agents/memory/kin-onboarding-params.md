---
name: Kin onboarding route params
description: dateOfBirth and gender are not present on MyProfile type; must be passed as Expo Router params between onboarding screens.
---

`MyProfile` returned by `GET /me` does NOT include `dateOfBirth` (only `age: number | null`). But `OnboardingRequest` (POST /me/onboarding) requires `dateOfBirth: string` and `gender`.

**Rule:** Personal screen collects dateOfBirth + gender → saves via PATCH /me → then passes them as route params to occupation screen:
```ts
router.push({ pathname: "/(onboarding)/occupation", params: { dateOfBirth, gender } });
```

Occupation screen reads them via `useLocalSearchParams<{ dateOfBirth: string; gender: string }>()`.

**Why:** MyProfile type has no dateOfBirth field. The server stores it but doesn't expose it in the profile response.

**How to apply:** Any time you need to carry onboarding data between screens, use route params rather than trying to read from the profile.
