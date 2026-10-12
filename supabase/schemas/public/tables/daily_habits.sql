CREATE TABLE "public"."daily_habits" (
  "date"           date     NOT NULL,
  "habit_id"       uuid     NOT NULL,
  "steps"          smallint NOT NULL,
  "steps_complete" smallint NOT NULL DEFAULT '0'::smallint,
  CONSTRAINT "daily_habits_pkey" PRIMARY KEY (date, habit_id),
  CONSTRAINT "daily_habits_habit_id_fkey" FOREIGN KEY (habit_id) REFERENCES public.habits(id) ON UPDATE CASCADE ON DELETE CASCADE,
  "user_id"        uuid     NOT NULL DEFAULT auth.uid(),
  CONSTRAINT "daily_habits_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

ALTER TABLE "public"."daily_habits"
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."daily_habits"
  ADD COLUMN "percent_complete" integer GENERATED ALWAYS AS (((100)::numeric * ((steps_complete)::numeric / (steps)::numeric))) STORED;

CREATE INDEX idx_daily_habits_habit_id ON public.daily_habits USING btree (habit_id);

CREATE INDEX idx_daily_habits_user_id ON public.daily_habits USING btree (user_id);

CREATE POLICY "Users can delete their own daily habits" ON "public"."daily_habits"
  FOR DELETE
  TO "authenticated"
  USING ((( SELECT auth.uid() AS uid) = user_id));

CREATE POLICY "Users can insert their own daily habits" ON "public"."daily_habits"
  FOR INSERT
  TO "authenticated"
  WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));

CREATE POLICY "Users can read their own daily habits" ON "public"."daily_habits"
  FOR SELECT
  TO "authenticated"
  USING ((( SELECT auth.uid() AS uid) = user_id));

CREATE POLICY "Users can update their own daily habits" ON "public"."daily_habits"
  FOR UPDATE
  TO "authenticated"
  USING ((( SELECT auth.uid() AS uid) = user_id))
  WITH CHECK (((( SELECT auth.uid() AS uid) = user_id) AND (EXISTS ( SELECT 1
   FROM public.habits h
  WHERE ((h.id = daily_habits.habit_id) AND (h.user_id = ( SELECT auth.uid() AS uid)))))));

REVOKE ALL ON TABLE "public"."daily_habits" FROM "anon";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."daily_habits" TO "anon";

REVOKE ALL ON TABLE "public"."daily_habits" FROM "authenticated";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."daily_habits" TO "authenticated";

REVOKE ALL ON TABLE "public"."daily_habits" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."daily_habits" TO "postgres";

REVOKE ALL ON TABLE "public"."daily_habits" FROM "service_role";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."daily_habits" TO "service_role";
