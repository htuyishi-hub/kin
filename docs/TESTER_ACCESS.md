# Tester Account Activation (SQL Guide)

This guide documents the SQL query to run by hand in the Supabase SQL Editor to grant early access and activate a tester account by email.

> [!CAUTION]
> **Do NOT run automated migrations or scripts against production.**
> Run this query manually in your Supabase Dashboard SQL Editor for authorized tester emails only.

---

## 1. Activate Tester Account by Email

Replace `'tester@example.com'` with the tester's actual email address.

```sql
-- Step 1: Find and activate the profile in public.profiles matching the tester's email
UPDATE public.profiles
SET
  account_status = 'active',
  is_verified = true,
  profile_active = true,
  verification_method = 'invite',
  trust_score = GREATEST(trust_score, 85),
  updated_at = NOW()
WHERE id IN (
  SELECT id FROM auth.users WHERE email = LOWER('tester@example.com')
)
OR email = LOWER('tester@example.com');
```

---

## 2. Option A: Complete Bypass (Bypasses Waiting Room & Onboarding)

If the tester needs immediate access to Discover, Matches, and Profile tabs without completing onboarding:

```sql
UPDATE public.profiles
SET
  account_status = 'active',
  is_verified = true,
  profile_active = true,
  onboarding_complete = true,
  verification_method = 'invite',
  trust_score = 100,
  updated_at = NOW()
WHERE id IN (
  SELECT id FROM auth.users WHERE email = LOWER('tester@example.com')
)
OR email = LOWER('tester@example.com');
```

---

## 3. Option B: Test Onboarding Flow (Bypasses Waiting Room Only)

If the tester needs to test the onboarding steps (name, DOB, occupation, intent) while being guaranteed immediate entry into the app without being waitlisted:

```sql
UPDATE public.profiles
SET
  account_status = 'active',
  is_verified = true,
  profile_active = true,
  onboarding_complete = false,
  verification_method = 'invite',
  trust_score = 80,
  updated_at = NOW()
WHERE id IN (
  SELECT id FROM auth.users WHERE email = LOWER('tester@example.com')
)
OR email = LOWER('tester@example.com');
```

---

## 4. Verification Check

Run this query to verify the tester's status after running the update:

```sql
SELECT
  p.id,
  u.email,
  p.full_name,
  p.account_status,
  p.is_verified,
  p.onboarding_complete,
  p.verification_method,
  p.trust_score
FROM public.profiles p
JOIN auth.users u ON u.id = p.id
WHERE u.email = LOWER('tester@example.com');
```

Expected result:
- `account_status`: `'active'`
- `is_verified`: `true`
- `verification_method`: `'invite'`
