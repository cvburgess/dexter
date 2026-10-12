CREATE TABLE "public"."journals" (
  "date"       date                     NOT NULL,
  "prompts"    jsonb                    NOT NULL DEFAULT '[]'::jsonb,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "mood"       smallint,
  CONSTRAINT "journals_mood_range" CHECK (((mood IS NULL) OR ((mood >= 1) AND (mood <= 5)))),
  CONSTRAINT "journals_prompts_is_array" CHECK ((jsonb_typeof(prompts) = 'array'::text)),
  "user_id"    uuid                     NOT NULL DEFAULT auth.uid(),
  CONSTRAINT "journals_pkey" PRIMARY KEY (user_id, date),
  CONSTRAINT "journals_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

ALTER TABLE "public"."journals"
  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can delete their own journals" ON "public"."journals"
  FOR DELETE
  TO "authenticated"
  USING ((( SELECT auth.uid() AS uid) = user_id));

CREATE POLICY "Users can insert their own journals" ON "public"."journals"
  FOR INSERT
  TO "authenticated"
  WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));

CREATE POLICY "Users can select their own journals" ON "public"."journals"
  FOR SELECT
  TO "authenticated"
  USING ((( SELECT auth.uid() AS uid) = user_id));

CREATE POLICY "Users can update their own journals" ON "public"."journals"
  FOR UPDATE
  TO "authenticated"
  USING ((( SELECT auth.uid() AS uid) = user_id))
  WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));

REVOKE ALL ON TABLE "public"."journals" FROM "anon";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."journals" TO "anon";

REVOKE ALL ON TABLE "public"."journals" FROM "authenticated";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."journals" TO "authenticated";

REVOKE ALL ON TABLE "public"."journals" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."journals" TO "postgres";

REVOKE ALL ON TABLE "public"."journals" FROM "service_role";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."journals" TO "service_role";
