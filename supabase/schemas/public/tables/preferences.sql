CREATE TABLE "public"."preferences" (
  "light_theme"         character varying      NOT NULL DEFAULT 'dexter'::character varying,
  "dark_theme"          character varying      NOT NULL DEFAULT 'dark'::character varying,
  "theme_mode"          smallint               NOT NULL DEFAULT '0'::smallint,
  "template_note"       text                   NOT NULL DEFAULT ''::text,
  "enable_notes"        boolean                NOT NULL DEFAULT true,
  "enable_journal"      boolean                NOT NULL DEFAULT true,
  "enable_habits"       boolean                NOT NULL DEFAULT true,
  "calendar_urls"       character varying[]    NOT NULL DEFAULT ARRAY[]::character varying[],
  "enable_calendar"     boolean                NOT NULL DEFAULT false,
  "calendar_start_time" time without time zone NOT NULL DEFAULT '06:00:00'::time WITHOUT time zone,
  "calendar_end_time"   time without time zone NOT NULL DEFAULT '20:00:00'::time WITHOUT time zone,
  "alarm_sound"         text                   NOT NULL DEFAULT 'echos'::text,
  "enable_horoscope"    boolean                NOT NULL DEFAULT true,
  "focus_block_minutes" integer                NOT NULL DEFAULT 25,
  "breath_count"        integer                NOT NULL DEFAULT 3,
  "breathing_technique" text                   NOT NULL DEFAULT 'shuffle'::text,
  "template_prompts"    jsonb
    NOT NULL DEFAULT
    jsonb_build_array(jsonb_build_object('id', (gen_random_uuid())::text, 'prompt', 'Today I am grateful for', 'period', 'am'), jsonb_build_object('id', (gen_random_uuid())::text,
    'prompt',
    'Today I am excited for',
    'period',
    'am'),
    jsonb_build_object('id', (gen_random_uuid())::text, 'prompt', 'What would make today great', 'period', 'am'),
    jsonb_build_object('id', (gen_random_uuid())::text, 'prompt', 'Today''s highlight', 'period', 'pm'),
    jsonb_build_object('id', (gen_random_uuid())::text, 'prompt', 'Today I learned', 'period', 'pm')),
  CONSTRAINT "preferences_template_prompts_is_array" CHECK ((jsonb_typeof(template_prompts) = 'array'::text)),
  "user_id"             uuid                   NOT NULL DEFAULT auth.uid(),
  CONSTRAINT "preferences_pkey" PRIMARY KEY (user_id),
  CONSTRAINT "preferences_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

ALTER TABLE "public"."preferences"
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."preferences"
  ADD COLUMN "sun_sign" public.sun_sign;

CREATE INDEX idx_preferences_user_id ON public.preferences USING btree (user_id);

CREATE POLICY "Users can delete their own preferences" ON "public"."preferences"
  FOR DELETE
  TO "authenticated"
  USING ((( SELECT auth.uid() AS uid) = user_id));

CREATE POLICY "Users can insert their own preferences" ON "public"."preferences"
  FOR INSERT
  TO "authenticated"
  WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));

CREATE POLICY "Users can read their own preferences" ON "public"."preferences"
  FOR SELECT
  TO "authenticated"
  USING ((( SELECT auth.uid() AS uid) = user_id));

CREATE POLICY "Users can update their own preferences" ON "public"."preferences"
  FOR UPDATE
  TO "authenticated"
  USING ((( SELECT auth.uid() AS uid) = user_id))
  WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));

REVOKE ALL ON TABLE "public"."preferences" FROM "anon";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."preferences" TO "anon";

REVOKE ALL ON TABLE "public"."preferences" FROM "authenticated";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."preferences" TO "authenticated";

REVOKE ALL ON TABLE "public"."preferences" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."preferences" TO "postgres";

REVOKE ALL ON TABLE "public"."preferences" FROM "service_role";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."preferences" TO "service_role";
