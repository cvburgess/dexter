CREATE TABLE "public"."notes" (
  "date"       date                     NOT NULL,
  "content"    text                     NOT NULL DEFAULT ''::text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "user_id"    uuid                     NOT NULL DEFAULT auth.uid(),
  CONSTRAINT "notes_pkey" PRIMARY KEY (user_id, date),
  CONSTRAINT "notes_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

ALTER TABLE "public"."notes"
  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can delete their own notes" ON "public"."notes"
  FOR DELETE
  TO "authenticated"
  USING ((( SELECT auth.uid() AS uid) = user_id));

CREATE POLICY "Users can insert their own notes" ON "public"."notes"
  FOR INSERT
  TO "authenticated"
  WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));

CREATE POLICY "Users can select their own notes" ON "public"."notes"
  FOR SELECT
  TO "authenticated"
  USING ((( SELECT auth.uid() AS uid) = user_id));

CREATE POLICY "Users can update their own notes" ON "public"."notes"
  FOR UPDATE
  TO "authenticated"
  USING ((( SELECT auth.uid() AS uid) = user_id))
  WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));

REVOKE ALL ON TABLE "public"."notes" FROM "anon";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."notes" TO "anon";

REVOKE ALL ON TABLE "public"."notes" FROM "authenticated";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."notes" TO "authenticated";

REVOKE ALL ON TABLE "public"."notes" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."notes" TO "postgres";

REVOKE ALL ON TABLE "public"."notes" FROM "service_role";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."notes" TO "service_role";
