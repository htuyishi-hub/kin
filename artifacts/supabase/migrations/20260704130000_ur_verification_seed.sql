-- Kin — Supabase migration seed (UR verification)
-- Seeds student_registry data.
-- Idempotent: uses ON CONFLICT DO NOTHING.

-- Minimal sample dataset (replace/extend with real registry export)
-- Note: values must follow strict rules in the verification engine:
-- - registration_number must be 9 digits
-- - campus must be an exact match during strict campus verification

insert into student_registry (registration_number, campus, claimed, claimed_by_profile, created_at, updated_at)
values
  ('222012345', 'Huye', false, null, now(), now()),
  ('223045678', 'Nyarugenge', false, null, now(), now()),
  ('224078901', 'Remera', false, null, now(), now()),
  ('225028190', 'Huye', false, null, now(), now()),
  ('226099999', 'Gikondo', false, null, now(), now())
on conflict (registration_number) do nothing;


