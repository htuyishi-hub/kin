-- Kin — Supabase migration seed (idempotent)
-- Run from Supabase SQL editor OR via migrations.
-- This file focuses on seeding prompt_definitions (micro-prompt system).

-- Enable extensions required by schema defaults
create extension if not exists "pgcrypto";

-- Seed prompt definitions
insert into prompt_definitions (key, prompt_text, prompt_rw, tier, intent) values
-- Universal prompts (all tiers, all intents)
('family_role',
 'What role does family play in your life decisions?',
 'Umuryango ufite uruhare rungana iki mu mwanzuro wawe?',
 null, null),

('values_guide',
 'What values guide how you treat people?',
 'Ni ikihe gitekerezo cyagufasha gukoranya n''abandi?',
 null, null),

('community_means',
 'What does community mean to you?',
 'Umuryango bisobanura iki kuri wewe?',
 null, null),

('free_time',
 'How do you spend a peaceful weekend?',
 'Wikend y''amahoro uyimanagira gute?',
 null, null),

('growth_edge',
 'What are you working on growing in yourself right now?',
 'None uri gukoraho iki kugirango ukure nk''umuntu?',
 null, null),

('admire_others',
 'What quality do you most admire in others?',
 'Ni ikihe gitangaza ukunda cyane mu bantu?',
 null, null),

('faith_practice',
 'How does faith or spirituality show up in your daily life?',
 'Ukwizera cyangwa umwuka biragaragara gute mu buzima bwawe bwa buri munsi?',
 null, null),

('conflict_style',
 'How do you handle disagreement in a relationship?',
 'Ugaragaza gute impaka mu isano?',
 null, null),

('partner_words',
 'In three words, describe your ideal partner.',
 'Sobanura inshuti y''amoro yawe nziza mu magambo atatu.',
 null, null),

('deal_breaker',
 'What is the one thing you cannot compromise on in a partner?',
 'Ni ikihe kintu utashobora guha inshuti yawe uruhushya?',
 null, null),

-- Student-tier prompts
('campus_vibe',
 'What gets you out of bed on a heavy exam week?',
 'Ni ikihe gituma ubyuka mu cyumweru gikomeye cy''ibizamini?',
 1, null),

('future_vision',
 'Where do you picture yourself five years after graduating?',
 'Wimba ute inyuma y''imyaka itanu urangije?',
 1, null),

('study_balance',
 'How do you balance ambition with the rest of your life?',
 'Uhuza gute impano n''ubuzima busigaye?',
 1, null),

-- Employed / Professional prompts
('work_meaning',
 'What part of your work gives you the most meaning?',
 'Ni ikihe gice cy''akazi kawe giha agaciro kenshi?',
 2, null),

('weekend_project',
 'What project or passion do you pursue outside of work?',
 'Ni iki ukora cyangwa ukunda hanze y''akazi?',
 2, null),

('leadership_lesson',
 'What leadership lesson took you the longest to learn?',
 'Ni ikihe somo ry''ubuyobozi wagize igihe kinini wiga?',
 3, null),

('purpose_beyond',
 'What are you building that goes beyond a career?',
 'Uri kubaka iki kirenze akazi?',
 3, null),

-- Marriage-intent prompts
('marriage_model',
 'What did your parents'' relationship teach you about marriage?',
 'Isano y''ababyeyi bawe yigishije iki ku bushingwe?',
 null, 'Marriage'),

('family_size',
 'How do you think about building a family together?',
 'Ubona gute kubaka umuryango hamwe?',
 null, 'Marriage'),

('in_laws',
 'How important is it to you that your partner gets along with your family?',
 'Ni iki bigufasha cyane ko mukundana n''umuryango wawe?',
 null, 'Marriage'),

-- Serious-relationship prompts
('quality_time',
 'What does quality time together look like to you?',
 'Igihe cyiza hamwe kigaragara gute kuri wewe?',
 null, 'Serious'),

('support_style',
 'How do you show up for someone you care about when things are hard?',
 'Ugaragaza gute ko uwitwararika umuntu mugihe bigoye?',
 null, 'Serious')

ON CONFLICT (key) DO NOTHING;

