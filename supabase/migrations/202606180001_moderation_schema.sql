-- Sentinel AI — content moderation pipeline schema (idempotent).
-- Harm taxonomy: hate_speech, harassment, spam, misinformation,
-- graphic_violence, adult_content, self_harm.

create extension if not exists "pgcrypto";

create table if not exists public.platform_policies (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  review_threshold double precision not null check (review_threshold between 0 and 1),
  reject_threshold double precision not null check (reject_threshold between 0 and 1),
  settings_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint thresholds_ordered check (review_threshold < reject_threshold)
);

create table if not exists public.moderation_results (
  id uuid primary key default gen_random_uuid(),
  content text not null,
  context text not null default '',
  user_history_summary text not null default '',
  conversation_thread jsonb not null default '[]'::jsonb,
  platform_id uuid not null references public.platform_policies(id),
  scores_json jsonb not null,
  top_category text not null check (
    top_category in ('hate_speech', 'harassment', 'spam', 'misinformation',
                     'graphic_violence', 'adult_content', 'self_harm')
  ),
  routed_category text check (
    routed_category is null or routed_category in
    ('hate_speech', 'harassment', 'spam', 'misinformation',
     'graphic_violence', 'adult_content', 'self_harm')
  ),
  raw_confidence double precision not null check (raw_confidence between 0 and 1),
  confidence double precision not null check (confidence between 0 and 1),
  trigger_segment text not null default '',
  reasoning text not null,
  decision text not null check (
    decision in ('AUTO_APPROVE', 'HUMAN_REVIEW', 'AUTO_REJECT')
  ),
  generated_prompt text not null,
  raw_model_response jsonb not null,
  policy_snapshot jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists moderation_results_created_idx
  on public.moderation_results(created_at desc);
create index if not exists moderation_results_decision_idx
  on public.moderation_results(decision);
create index if not exists moderation_results_platform_idx
  on public.moderation_results(platform_id);

create table if not exists public.review_queue (
  id uuid primary key default gen_random_uuid(),
  moderation_result_id uuid not null unique
    references public.moderation_results(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  human_decision text check (human_decision in ('approved', 'rejected')),
  override_category text check (
    override_category is null or override_category in
    ('hate_speech', 'harassment', 'spam', 'misinformation',
     'graphic_violence', 'adult_content', 'self_harm')
  ),
  reviewer_notes text not null default '',
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists review_queue_status_idx on public.review_queue(status);

create table if not exists public.feedback_stats (
  category text primary key check (
    category in ('hate_speech', 'harassment', 'spam', 'misinformation',
                 'graphic_violence', 'adult_content', 'self_harm')
  ),
  total_reviews integer not null default 0 check (total_reviews >= 0),
  overrides integer not null default 0 check (overrides >= 0 and overrides <= total_reviews),
  accuracy double precision not null default 1 check (accuracy between 0 and 1)
);

create table if not exists public.dataset_samples (
  id uuid primary key default gen_random_uuid(),
  text text not null,
  context text not null default '',
  ground_truth_category text not null check (
    ground_truth_category in
    ('hate_speech', 'harassment', 'spam', 'misinformation',
     'graphic_violence', 'adult_content', 'self_harm')
  )
);

create index if not exists dataset_samples_category_idx
  on public.dataset_samples(ground_truth_category);

-- ----------------------------------------------------------------------------
-- Four platforms with deliberately different definitions of acceptable content.
-- category_toggles switch a harm type off entirely; a disabled category is never
-- actioned (e.g. the adult platform permits adult_content). Multipliers tune
-- sensitivity per category; custom_rules are injected into the classifier prompt.
-- ----------------------------------------------------------------------------
insert into public.platform_policies
  (slug, name, review_threshold, reject_threshold, settings_json)
values
  (
    'kids',
    'Kids Platform',
    0.35,
    0.60,
    '{
      "description": "Strict protection for an under-13 audience. Nothing mature is tolerated.",
      "allow_violence_context": false,
      "custom_rules": [
        "Treat any sexual, violent, or self-harm reference as a violation regardless of framing.",
        "Block profanity, bullying, and mature themes even when quoted or fictional."
      ],
      "category_toggles": {
        "hate_speech": true, "harassment": true, "spam": true, "misinformation": true,
        "graphic_violence": true, "adult_content": true, "self_harm": true
      },
      "category_threshold_multipliers": {
        "hate_speech": 1.3, "harassment": 1.3, "spam": 1.1, "misinformation": 1.2,
        "graphic_violence": 1.4, "adult_content": 1.5, "self_harm": 1.3
      }
    }'::jsonb
  ),
  (
    'social',
    'Social Media Platform',
    0.50,
    0.80,
    '{
      "description": "Balanced general-purpose community. Allows debate, acts on real harm.",
      "allow_violence_context": false,
      "custom_rules": [
        "Allow heated political and social debate.",
        "Act decisively on targeted harassment, threats, and coordinated hate."
      ],
      "category_toggles": {
        "hate_speech": true, "harassment": true, "spam": true, "misinformation": true,
        "graphic_violence": true, "adult_content": true, "self_harm": true
      },
      "category_threshold_multipliers": {
        "hate_speech": 1.15, "harassment": 1.1, "spam": 1.0, "misinformation": 1.05,
        "graphic_violence": 1.1, "adult_content": 1.1, "self_harm": 1.2
      }
    }'::jsonb
  ),
  (
    'gaming',
    'Gaming Platform',
    0.60,
    0.85,
    '{
      "description": "Competitive gaming community. Trash talk and fictional combat are expected.",
      "allow_violence_context": true,
      "custom_rules": [
        "In-match trash talk and fictional/in-game combat language are acceptable.",
        "Still enforce hate speech, real-world threats, and self-harm strictly."
      ],
      "category_toggles": {
        "hate_speech": true, "harassment": true, "spam": true, "misinformation": true,
        "graphic_violence": true, "adult_content": true, "self_harm": true
      },
      "category_threshold_multipliers": {
        "hate_speech": 1.2, "harassment": 0.8, "spam": 1.0, "misinformation": 0.9,
        "graphic_violence": 0.6, "adult_content": 1.1, "self_harm": 1.2
      }
    }'::jsonb
  ),
  (
    'adult',
    'Adult Platform (18+)',
    0.55,
    0.82,
    '{
      "description": "Age-verified 18+ platform. Adult content is permitted; real harm is not.",
      "allow_violence_context": false,
      "custom_rules": [
        "Consensual adult sexual content is permitted for verified 18+ users.",
        "Zero tolerance for hate speech, self-harm, real-world violence, and scams."
      ],
      "category_toggles": {
        "hate_speech": true, "harassment": true, "spam": true, "misinformation": true,
        "graphic_violence": true, "adult_content": false, "self_harm": true
      },
      "category_threshold_multipliers": {
        "hate_speech": 1.2, "harassment": 1.05, "spam": 1.1, "misinformation": 1.0,
        "graphic_violence": 1.15, "adult_content": 1.0, "self_harm": 1.25
      }
    }'::jsonb
  )
on conflict (slug) do update set
  name = excluded.name,
  review_threshold = excluded.review_threshold,
  reject_threshold = excluded.reject_threshold,
  settings_json = excluded.settings_json,
  updated_at = now();

insert into public.feedback_stats (category)
values
  ('hate_speech'), ('harassment'), ('spam'), ('misinformation'),
  ('graphic_violence'), ('adult_content'), ('self_harm')
on conflict (category) do nothing;

-- ----------------------------------------------------------------------------
-- 100-sample labelled evaluation set across all seven categories.
-- ----------------------------------------------------------------------------
insert into public.dataset_samples (text, context, ground_truth_category)
select v.text, v.context, v.category
from (values
  -- hate_speech (14)
  ('People of that religion are inferior and should be removed.', 'Public post', 'hate_speech'),
  ('Immigrants are vermin who ruin every neighborhood.', 'Comment thread', 'hate_speech'),
  ('Go back to where you came from, you do not belong here.', 'Reply', 'hate_speech'),
  ('I despise people because of their religion.', 'Forum post', 'hate_speech'),
  ('Those subhuman degenerates should not exist.', 'Public post', 'hate_speech'),
  ('That gender is inferior to the rest of us.', 'Comment', 'hate_speech'),
  ('Members of that race are subhuman and worthless.', 'Public post', 'hate_speech'),
  ('Muslims should not exist in this country.', 'Comment thread', 'hate_speech'),
  ('I hate gay people and everything about them.', 'Reply', 'hate_speech'),
  ('Trans people are inferior and unwelcome here.', 'Public post', 'hate_speech'),
  ('Jews are vermin controlling everything.', 'Comment', 'hate_speech'),
  ('Christians are subhuman and should be silenced.', 'Forum post', 'hate_speech'),
  ('Go back to your country, immigrants are inferior.', 'Reply', 'hate_speech'),
  ('I despise that race and want them gone.', 'Public post', 'hate_speech'),
  -- harassment (14)
  ('I am going to find you and ruin your life.', 'Direct message', 'harassment'),
  ('You are pathetic and worthless, just give up.', 'Reply to a user', 'harassment'),
  ('Shut up, nobody likes you here.', 'Community reply', 'harassment'),
  ('I will get you for this, watch your back.', 'Direct message', 'harassment'),
  ('You are disgusting and everyone agrees with me.', 'Comment', 'harassment'),
  ('I will destroy you online piece by piece.', 'Direct message', 'harassment'),
  ('You are trash and do not deserve to post here.', 'Reply', 'harassment'),
  ('Nobody likes you, just leave already.', 'Community reply', 'harassment'),
  ('I am going to end you, you absolute loser.', 'Direct message', 'harassment'),
  ('You are a loser and always will be.', 'Reply', 'harassment'),
  ('I will find you and make your life hell.', 'Direct message', 'harassment'),
  ('You are pathetic, delete your account now.', 'Comment', 'harassment'),
  ('I am going to ruin you and your reputation.', 'Direct message', 'harassment'),
  ('Shut up, you worthless waste of space.', 'Reply', 'harassment'),
  -- spam (14)
  ('Buy now and get 90% off, limited offer ends today!', 'Comment', 'spam'),
  ('Click here to claim your free money: http://scam.example', 'Reply', 'spam'),
  ('Earn $5000 a week working from home, DM me to start.', 'Comment', 'spam'),
  ('Crypto giveaway! Send 1 ETH get 2 back, click here.', 'Reply', 'spam'),
  ('Visit www.totally-legit-deals.example for free prizes.', 'Comment', 'spam'),
  ('Limited offer: free money for the first 100 users only.', 'Reply', 'spam'),
  ('DM me to make money fast, no experience needed.', 'Comment', 'spam'),
  ('Free money!!! Click here now http://bit.example/win', 'Reply', 'spam'),
  ('Work from home and earn $300 daily, link www.x.example', 'Comment', 'spam'),
  ('Buy now! Best crypto giveaway of the year, limited offer.', 'Reply', 'spam'),
  ('Click here for a free iPhone http://prize.example', 'Comment', 'spam'),
  ('Earn $ thousands monthly, just DM me to learn how.', 'Reply', 'spam'),
  ('Limited offer on followers, buy now at www.bots.example', 'Comment', 'spam'),
  ('Free money giveaway, click here before it ends!', 'Reply', 'spam'),
  -- misinformation (14)
  ('Vaccines cause autism and the government hides it.', 'Health post', 'misinformation'),
  ('The earth is flat and NASA lies to everyone.', 'Science forum', 'misinformation'),
  ('The election was stolen and the proof is suppressed.', 'Politics post', 'misinformation'),
  ('5G causes the virus to spread through the air.', 'Health post', 'misinformation'),
  ('This miracle cure dissolves any tumor in days.', 'Health post', 'misinformation'),
  ('Drink bleach to flush out the infection safely.', 'Health post', 'misinformation'),
  ('Covid is a hoax invented to control the population.', 'Comment', 'misinformation'),
  ('Doctors confirm vaccines cause infertility.', 'Health post', 'misinformation'),
  ('The election was stolen by rigged machines overnight.', 'Politics post', 'misinformation'),
  ('A miracle cure they do not want you to know about.', 'Health post', 'misinformation'),
  ('5G causes cancer in everyone living nearby.', 'Comment', 'misinformation'),
  ('The earth is flat, gravity is a government lie.', 'Science forum', 'misinformation'),
  ('Drink bleach daily, it is a miracle cure.', 'Health post', 'misinformation'),
  ('Covid is a hoax and vaccines cause more deaths.', 'Comment', 'misinformation'),
  -- graphic_violence (15)
  ('He stabbed the man repeatedly until the floor was covered in blood.', 'Post', 'graphic_violence'),
  ('I will shoot everyone in that building tomorrow.', 'Direct message', 'graphic_violence'),
  ('They slaughtered the prisoners and filmed the gore.', 'Video description', 'graphic_violence'),
  ('Detailed plan to bomb the station at rush hour.', 'Post', 'graphic_violence'),
  ('Watch him get beheaded in this video.', 'Video description', 'graphic_violence'),
  ('I am going to murder you and dump the body.', 'Direct message', 'graphic_violence'),
  ('The massacre left blood across the whole square.', 'News comment', 'graphic_violence'),
  ('He will shoot up the school, he said so.', 'Report', 'graphic_violence'),
  ('Graphic footage of the stabbing, so much blood.', 'Video description', 'graphic_violence'),
  ('Plans to massacre the crowd with a bomb.', 'Post', 'graphic_violence'),
  ('I will stab anyone who comes near the gate.', 'Direct message', 'graphic_violence'),
  ('They beheaded the hostage on camera.', 'Video description', 'graphic_violence'),
  ('Going to shoot the place up this weekend.', 'Post', 'graphic_violence'),
  ('The gore from the slaughter was everywhere.', 'Comment', 'graphic_violence'),
  ('He murdered them and showed the blood proudly.', 'Post', 'graphic_violence'),
  -- adult_content (14)
  ('Check out my explicit nudes, link in my bio.', 'Post', 'adult_content'),
  ('Full porn video available now on my page.', 'Comment', 'adult_content'),
  ('Subscribe to my OnlyFans for explicit sex content.', 'Post', 'adult_content'),
  ('XXX hardcore scenes, completely uncensored.', 'Comment', 'adult_content'),
  ('Sexual content not suitable for any minors.', 'Post', 'adult_content'),
  ('Nude photoshoot, very explicit and detailed.', 'Comment', 'adult_content'),
  ('Watch full XXX porn on my channel.', 'Post', 'adult_content'),
  ('Explicit sexual roleplay in graphic detail.', 'Comment', 'adult_content'),
  ('My nudes are available for subscribers only.', 'Post', 'adult_content'),
  ('OnlyFans exclusive nude content posted daily.', 'Comment', 'adult_content'),
  ('Hot XXX nudes, message me for more.', 'Post', 'adult_content'),
  ('Explicit sex tape leaked, watch the porn here.', 'Comment', 'adult_content'),
  ('Sexual and nude photos for my OnlyFans fans.', 'Post', 'adult_content'),
  ('Uncensored porn and nudes, link below.', 'Comment', 'adult_content'),
  -- self_harm (15)
  ('I want to kill myself tonight, I cannot go on.', 'Direct message', 'self_harm'),
  ('I have been cutting myself to cope lately.', 'Post', 'self_harm'),
  ('Thinking about suicide every single day now.', 'Post', 'self_harm'),
  ('I want to die and finally end my life.', 'Direct message', 'self_harm'),
  ('Here is how to end my life painlessly.', 'Post', 'self_harm'),
  ('I self-harm whenever things get bad.', 'Post', 'self_harm'),
  ('Nobody would care if I committed suicide.', 'Direct message', 'self_harm'),
  ('I keep thinking I want to die.', 'Post', 'self_harm'),
  ('Looking for instructions to end my life quietly.', 'Post', 'self_harm'),
  ('I cut myself again last night.', 'Direct message', 'self_harm'),
  ('I want to kill myself and stop the pain.', 'Post', 'self_harm'),
  ('Planning my suicide for the weekend.', 'Direct message', 'self_harm'),
  ('I cannot stop cutting myself.', 'Post', 'self_harm'),
  ('I want to die, nothing matters anymore.', 'Post', 'self_harm'),
  ('Suicide feels like the only way out for me.', 'Direct message', 'self_harm')
) as v(text, context, category)
where not exists (select 1 from public.dataset_samples);

alter table public.platform_policies enable row level security;
alter table public.moderation_results enable row level security;
alter table public.review_queue enable row level security;
alter table public.feedback_stats enable row level security;
alter table public.dataset_samples enable row level security;

-- The backend connects with a trusted database role. No public policies are created,
-- so browser clients cannot bypass the FastAPI policy and audit layers.
