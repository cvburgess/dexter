CREATE TABLE "public"."repeat_task_templates" (
  "id"         uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "schedule"   character varying,
  "title"      character varying        NOT NULL DEFAULT ''::character varying,
  "priority"   smallint                 NOT NULL DEFAULT '4'::smallint,
  "list_id"    uuid,
  "goal_id"    uuid,
  "alarm_time" time without time zone,
  "subtasks"   jsonb                    NOT NULL DEFAULT '[]'::jsonb,
  CONSTRAINT "repeat_task_templates_goal_id_fkey" FOREIGN KEY (goal_id) REFERENCES public.goals(id) ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT "repeat_task_templates_list_id_fkey" FOREIGN KEY (list_id) REFERENCES public.lists(id) ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT "repeat_task_templates_pkey" PRIMARY KEY (id),
  CONSTRAINT "repeat_task_templates_subtasks_is_array" CHECK ((jsonb_typeof(subtasks) = 'array'::text)),
  "user_id"    uuid                     NOT NULL DEFAULT auth.uid(),
  CONSTRAINT "repeat_task_templates_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON UPDATE CASCADE ON DELETE CASCADE
);

ALTER TABLE "public"."repeat_task_templates"
  ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_repeat_task_templates_goal_id ON public.repeat_task_templates USING btree (goal_id);

CREATE INDEX idx_repeat_task_templates_list_id ON public.repeat_task_templates USING btree (list_id);

CREATE INDEX idx_repeat_task_templates_user_id ON public.repeat_task_templates USING btree (user_id);

CREATE POLICY "Users can delete their own repeat_task_templates" ON "public"."repeat_task_templates"
  FOR DELETE
  TO "authenticated"
  USING ((( SELECT auth.uid() AS uid) = user_id));

CREATE POLICY "Users can insert their own valid repeat task templates" ON "public"."repeat_task_templates"
  FOR INSERT
  TO "authenticated"
  WITH
    CHECK
    (((( SELECT auth.uid() AS uid) = user_id) AND ((schedule IS NULL) OR ((schedule)::text ~
    '^0 0 (\*|([1-9]|1[0-9]|2[0-9]|3[0-1])|\*/[0-9]+|[0-9]+-[0-9]+|[0-9]+(,[0-9]+)*) (\*|([1-9]|1[0-2])|\*/[0-9]+|[0-9]+-[0-9]+|[0-9]+(,[0-9]+)*) (\*|([0-7])|\*/[0-9]+|[0-9]+-[0-9]+|[0-9]+(,[0-9]+)*)$'::text))));

CREATE POLICY "Users can read their own repeat task templates" ON "public"."repeat_task_templates"
  FOR SELECT
  TO "authenticated"
  USING ((( SELECT auth.uid() AS uid) = user_id));

CREATE POLICY "Users can update their own valid repeat task templates" ON "public"."repeat_task_templates"
  FOR UPDATE
  TO "authenticated"
  USING ((( SELECT auth.uid() AS uid) = user_id))
  WITH
    CHECK
    (((( SELECT auth.uid() AS uid) = user_id) AND ((schedule IS NULL) OR ((schedule)::text ~
    '^0 0 (\*|([1-9]|1[0-9]|2[0-9]|3[0-1])|\*/[0-9]+|[0-9]+-[0-9]+|[0-9]+(,[0-9]+)*) (\*|([1-9]|1[0-2])|\*/[0-9]+|[0-9]+-[0-9]+|[0-9]+(,[0-9]+)*) (\*|([0-7])|\*/[0-9]+|[0-9]+-[0-9]+|[0-9]+(,[0-9]+)*)$'::text)) AND ((list_id IS NULL) OR (EXISTS ( SELECT 1
   FROM public.lists l
  WHERE ((l.id = repeat_task_templates.list_id) AND (l.user_id = ( SELECT auth.uid() AS uid)))))) AND ((goal_id IS NULL) OR (EXISTS ( SELECT 1
   FROM public.goals g
  WHERE ((g.id = repeat_task_templates.goal_id) AND (g.user_id = ( SELECT auth.uid() AS uid))))))));

REVOKE ALL ON TABLE "public"."repeat_task_templates" FROM "anon";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."repeat_task_templates" TO "anon";

REVOKE ALL ON TABLE "public"."repeat_task_templates" FROM "authenticated";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."repeat_task_templates" TO "authenticated";

REVOKE ALL ON TABLE "public"."repeat_task_templates" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."repeat_task_templates" TO "postgres";

REVOKE ALL ON TABLE "public"."repeat_task_templates" FROM "service_role";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."repeat_task_templates" TO "service_role";
