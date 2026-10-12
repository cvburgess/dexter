CREATE TABLE "public"."goals" (
  "id"          uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "created_at"  timestamp with time zone NOT NULL DEFAULT now(),
  "title"       character varying        DEFAULT ''::character varying,
  "is_archived" boolean                  NOT NULL DEFAULT false,
  CONSTRAINT "goal_pkey" PRIMARY KEY (id),
  "user_id"     uuid                     NOT NULL DEFAULT auth.uid(),
  CONSTRAINT "goal_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON UPDATE CASCADE ON DELETE CASCADE
);

ALTER TABLE "public"."goals"
  ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER after_goal_archive
  AFTER UPDATE ON public.goals
  FOR EACH ROW
  EXECUTE FUNCTION public.update_tasks_on_goal_archive();

CREATE INDEX idx_goals_user_id ON public.goals USING btree (user_id);

CREATE POLICY "Users can delete their own goals" ON "public"."goals"
  FOR DELETE
  TO "authenticated"
  USING ((( SELECT auth.uid() AS uid) = user_id));

CREATE POLICY "Users can insert their own goals" ON "public"."goals"
  FOR INSERT
  TO "authenticated"
  WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));

CREATE POLICY "Users can select their own goals" ON "public"."goals"
  FOR SELECT
  TO "authenticated"
  USING ((( SELECT auth.uid() AS uid) = user_id));

CREATE POLICY "Users can update their own goals" ON "public"."goals"
  FOR UPDATE
  TO "authenticated"
  USING ((( SELECT auth.uid() AS uid) = user_id))
  WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));

REVOKE ALL ON TABLE "public"."goals" FROM "anon";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."goals" TO "anon";

REVOKE ALL ON TABLE "public"."goals" FROM "authenticated";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."goals" TO "authenticated";

REVOKE ALL ON TABLE "public"."goals" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."goals" TO "postgres";

REVOKE ALL ON TABLE "public"."goals" FROM "service_role";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."goals" TO "service_role";
