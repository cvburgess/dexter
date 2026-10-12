CREATE TABLE "public"."habits" (
  "id"          uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "created_at"  timestamp with time zone NOT NULL DEFAULT now(),
  "title"       character varying        NOT NULL,
  "emoji"       character varying        NOT NULL,
  "steps"       smallint                 NOT NULL,
  "days_active" smallint[]               NOT NULL,
  "is_archived" boolean                  NOT NULL DEFAULT false,
  "is_paused"   boolean                  NOT NULL DEFAULT false,
  CONSTRAINT "habits_pkey" PRIMARY KEY (id),
  "user_id"     uuid                     NOT NULL DEFAULT auth.uid(),
  CONSTRAINT "habits_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

ALTER TABLE "public"."habits"
  ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER habits_changes_trigger
  AFTER UPDATE ON public.habits
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_habits_changes();

CREATE INDEX idx_habits_user_id ON public.habits USING btree (user_id);

CREATE POLICY "Users can delete their own habits" ON "public"."habits"
  FOR DELETE
  TO "authenticated"
  USING ((( SELECT auth.uid() AS uid) = user_id));

CREATE POLICY "Users can insert their own habits" ON "public"."habits"
  FOR INSERT
  TO "authenticated"
  WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));

CREATE POLICY "Users can read their own habits" ON "public"."habits"
  FOR SELECT
  TO "authenticated"
  USING ((( SELECT auth.uid() AS uid) = user_id));

CREATE POLICY "Users can update their own habits" ON "public"."habits"
  FOR UPDATE
  TO "authenticated"
  USING ((( SELECT auth.uid() AS uid) = user_id))
  WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));

REVOKE ALL ON TABLE "public"."habits" FROM "anon";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."habits" TO "anon";

REVOKE ALL ON TABLE "public"."habits" FROM "authenticated";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."habits" TO "authenticated";

REVOKE ALL ON TABLE "public"."habits" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."habits" TO "postgres";

REVOKE ALL ON TABLE "public"."habits" FROM "service_role";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."habits" TO "service_role";
