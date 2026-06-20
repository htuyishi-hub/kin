---
name: Kin RQ5 query options cast
description: React Query v5 UseQueryOptions requires queryKey but Orval auto-generates it — use `as any` cast on inline query option objects.
---

In RQ v5, `UseQueryOptions` has `queryKey` as a required field. Orval-generated hooks accept an options arg of `{ query?: UseQueryOptions<...> }`, which means TypeScript will complain when you pass `{ enabled, retry, refetchInterval }` without `queryKey`.

**Rule:** Always cast inline query option objects with `as any`:
```ts
useGetMe({ query: { enabled: !!token, retry: false } as any })
useGetMatches({ query: { refetchInterval: 15000 } as any })
```

**Why:** The hook itself calls `getGetMeQueryOptions(options)` which injects the queryKey. The typing is overly strict — it's a known Orval + RQ v5 interop issue.

**How to apply:** Every time you write a `useGet*` hook call with inline query options in any Expo screen.
