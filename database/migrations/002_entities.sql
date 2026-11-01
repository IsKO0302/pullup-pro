-- PULLUP PRO 2.0 — relational model of the data entities (ЧАСТЬ 14).
--
-- Source of truth for user data is the local-first sync store: table `records` (one row per client record,
-- last-writer-wins by `u`, tombstones for deletions). The views below expose those records as the entities of
-- the data model — Profiles, WorkoutSessions, WorkoutSets, PersonalRecords, BodyMeasurements, ProgressPhotos,
-- Achievements, CalendarPlans, CustomWorkouts, UserGoals, Reminders — for the bot, reporting and SQL access.
-- Users are the `users` table. Exercises and WorkoutPrograms are the catalog shipped with the app
-- (packages/shared); the API mirrors it into the two catalog tables on every start (syncCatalog).
-- The views never fail on unexpected JSON: values of the wrong type become NULL.

-- ---------- safe JSON accessors ----------
CREATE FUNCTION pp_num(j jsonb) RETURNS numeric LANGUAGE sql IMMUTABLE AS
$$ SELECT CASE WHEN jsonb_typeof(j) = 'number' THEN (j #>> '{}')::numeric END $$;
CREATE FUNCTION pp_bool(j jsonb) RETURNS boolean LANGUAGE sql IMMUTABLE AS
$$ SELECT CASE WHEN jsonb_typeof(j) = 'boolean' THEN (j #>> '{}')::boolean END $$;
CREATE FUNCTION pp_arr(j jsonb) RETURNS jsonb LANGUAGE sql IMMUTABLE AS
$$ SELECT CASE WHEN jsonb_typeof(j) = 'array' THEN j ELSE '[]'::jsonb END $$;
CREATE FUNCTION pp_day(t text) RETURNS date LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  IF t IS NULL OR t !~ '^\d{4}-\d{2}-\d{2}$' THEN RETURN NULL; END IF;
  RETURN t::date;
EXCEPTION WHEN others THEN RETURN NULL;   -- e.g. 2026-02-30
END $$;
CREATE FUNCTION pp_ts(ms bigint) RETURNS timestamptz LANGUAGE sql IMMUTABLE AS
$$ SELECT to_timestamp(ms / 1000.0) $$;

-- ---------- catalog (mirrored from packages/shared on API start) ----------
CREATE TABLE exercises (
  id                text PRIMARY KEY,
  name              text NOT NULL,
  name_en           text,
  body_group        text NOT NULL,
  category          text NOT NULL,
  type              text NOT NULL,                     -- reps | time
  level             text,                              -- beginner | intermediate | advanced | elite
  difficulty        smallint,                          -- 1..5
  weighted          boolean NOT NULL DEFAULT false,
  primary_muscles   text[] NOT NULL DEFAULT '{}',
  secondary_muscles text[] NOT NULL DEFAULT '{}',
  equipment         text[] NOT NULL DEFAULT '{}',
  easier            text,
  harder            text,
  data              jsonb NOT NULL,                    -- full catalog entry (technique, mistakes, dose, …)
  updated_at        timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE workout_programs (
  id             text PRIMARY KEY,
  generation     smallint NOT NULL,                    -- 1 = pull-up programs of 1.0, 2 = training engine 2.0
  name           text NOT NULL,
  kind           text,                                 -- pullup | fullbody | split | focus | mu
  level          text,
  days_per_week  smallint,
  frequency      text,
  duration       text,
  goal           text,
  workouts_count smallint NOT NULL,
  data           jsonb NOT NULL,                       -- workouts with exercises and doses
  updated_at     timestamptz NOT NULL DEFAULT now()
);

-- ---------- user entities (views over synced records) ----------
CREATE VIEW v_profiles AS
SELECT r.user_id, r.d->>'name' AS name, pp_num(r.d->'bodyweight') AS bodyweight_kg, pp_num(r.d->'height') AS height_cm,
       r.d->>'level' AS level, r.d->>'program' AS pullup_program, r.d->>'split' AS split, r.d->>'format' AS training_format,
       r.d->>'experience' AS experience, r.d->>'timezone' AS timezone, pp_num(r.d->'maxPullups') AS max_pullups,
       COALESCE(pp_bool(r.d->'onboarded'), false) AS onboarded, pp_ts(r.u) AS updated_at
FROM records r WHERE r.c = 'profile' AND NOT r.del;

CREATE VIEW v_user_goals AS
SELECT r.user_id, g.goal, pp_num(r.d->'weeklyTarget') AS workouts_per_week, pp_num(r.d->'goalDaily') AS daily_pullups
FROM records r LEFT JOIN LATERAL jsonb_array_elements_text(pp_arr(r.d->'goals')) AS g(goal) ON true
WHERE r.c = 'profile' AND NOT r.del;

CREATE VIEW v_workout_sets AS
SELECT r.user_id, r.id AS session_id, pp_day(r.d->>'date') AS day, it.ord::int AS exercise_no, it.v->>'ex' AS exercise_id,
       s.ord::int AS set_no, pp_num(s.v->'reps') AS reps, pp_num(s.v->'time') AS time_sec,
       pp_num(COALESCE(s.v->'weight', s.v->'w')) AS extra_weight_kg, pp_num(s.v->'rir') AS rir, COALESCE(pp_bool(s.v->'done'), false) AS done
FROM records r
CROSS JOIN LATERAL jsonb_array_elements(pp_arr(r.d->'items')) WITH ORDINALITY AS it(v, ord)
CROSS JOIN LATERAL jsonb_array_elements(pp_arr(it.v->'sets')) WITH ORDINALITY AS s(v, ord)
WHERE r.c = 'sessions' AND NOT r.del;

CREATE VIEW v_workout_sessions AS
SELECT r.user_id, r.id, pp_day(r.d->>'date') AS day,
       CASE WHEN pp_num(r.d->'startedAt') > 0 THEN pp_ts(pp_num(r.d->'startedAt')::bigint) END AS started_at,
       r.d->>'title' AS title, r.d->>'source' AS source, pp_num(r.d->'durationSec') AS duration_sec,
       pp_num(r.d->'feel') AS feel, pp_num(r.d->'rpe') AS rpe, COALESCE(pp_bool(r.d->'pain'), false) AS pain,
       pp_bool(r.d->'completed') AS completed, r.d->>'notes' AS notes,
       (SELECT count(*) FROM jsonb_array_elements(pp_arr(r.d->'items')) i, jsonb_array_elements(pp_arr(i->'sets')) s)::int AS sets_total,
       (SELECT count(*) FROM jsonb_array_elements(pp_arr(r.d->'items')) i, jsonb_array_elements(pp_arr(i->'sets')) s WHERE s->'done' = 'true'::jsonb)::int AS sets_done,
       pp_ts(r.u) AS updated_at
FROM records r WHERE r.c = 'sessions' AND NOT r.del;

-- best logged result per exercise (completed sets) and the best pull-up test; earliest date wins a tie
CREATE VIEW v_personal_records AS
SELECT DISTINCT ON (user_id, exercise_id, metric) user_id, exercise_id, metric, value, day, session_id
FROM (
  SELECT user_id, exercise_id, 'reps'::text AS metric, reps AS value, day, session_id FROM v_workout_sets WHERE done AND reps > 0
  UNION ALL SELECT user_id, exercise_id, 'time_sec', time_sec, day, session_id FROM v_workout_sets WHERE done AND time_sec > 0
  UNION ALL SELECT user_id, exercise_id, 'extra_weight_kg', extra_weight_kg, day, session_id FROM v_workout_sets WHERE done AND extra_weight_kg > 0
  UNION ALL SELECT r.user_id, 'pullup', 'test_max_reps', pp_num(r.d->'pullups'), pp_day(r.d->>'date'), NULL FROM records r
            WHERE r.c = 'tests' AND NOT r.del AND pp_num(r.d->'pullups') > 0
) x
ORDER BY user_id, exercise_id, metric, value DESC, day ASC NULLS LAST;

CREATE VIEW v_body_measurements AS
SELECT r.user_id, r.id, pp_day(r.d->>'date') AS day, pp_num(r.d->'weight') AS weight_kg, pp_num(r.d->'chest') AS chest_cm,
       pp_num(r.d->'waist') AS waist_cm, pp_num(r.d->'shoulders') AS shoulders_cm, pp_num(r.d->'biceps') AS biceps_cm,
       pp_num(r.d->'forearm') AS forearm_cm, pp_num(r.d->'thigh') AS thigh_cm,
       CASE WHEN jsonb_typeof(r.d->'custom') = 'object' THEN r.d->'custom' END AS custom, r.d->>'note' AS note, pp_ts(r.u) AS updated_at
FROM records r WHERE r.c = 'body' AND NOT r.del;

-- photo metadata is synced; the image itself is on the server only with explicit consent (stored_on_server)
CREATE VIEW v_progress_photos AS
SELECT r.user_id, r.id, pp_day(r.d->>'date') AS day, r.d->>'pose' AS pose, pp_num(r.d->'w') AS width, pp_num(r.d->'h') AS height,
       pp_num(r.d->'size') AS size_bytes, r.d->>'mime' AS mime, (p.id IS NOT NULL) AS stored_on_server
FROM records r LEFT JOIN photos p ON p.user_id = r.user_id AND p.id = r.id
WHERE r.c = 'photos' AND NOT r.del;

CREATE VIEW v_achievements AS
SELECT r.user_id, r.id AS achievement_id, pp_day(r.d #>> '{}') AS earned_on
FROM records r WHERE r.c = 'ach' AND NOT r.del;

CREATE VIEW v_calendar_plans AS
SELECT r.user_id, pp_day(r.id) AS day, p.ord::int AS position, p.v->>'id' AS plan_id, p.v->>'kind' AS kind, p.v->>'title' AS title,
       COALESCE(pp_bool(p.v->'done'), false) AS done
FROM records r CROSS JOIN LATERAL jsonb_array_elements(pp_arr(r.d)) WITH ORDINALITY AS p(v, ord)
WHERE r.c = 'plan' AND NOT r.del;

CREATE VIEW v_custom_workouts AS
SELECT r.user_id, r.id, r.d->>'name' AS name, r.d->>'focus' AS focus, jsonb_array_length(pp_arr(r.d->'items')) AS exercises_count,
       pp_arr(r.d->'items') AS items, pp_ts(r.u) AS updated_at
FROM records r WHERE r.c = 'custom' AND NOT r.del;

CREATE VIEW v_reminders AS
SELECT r.user_id, r.id, r.d->>'kind' AS kind, r.d->>'time' AS local_time,
       ARRAY(SELECT x::int FROM jsonb_array_elements_text(pp_arr(r.d->'days')) AS x WHERE x ~ '^[0-6]$') AS weekdays,
       COALESCE(pp_bool(r.d->'enabled'), false) AS enabled
FROM records r WHERE r.c = 'reminders' AND NOT r.del;
