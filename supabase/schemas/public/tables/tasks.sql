CREATE TABLE "public"."tasks" (
  "id"            uuid                        NOT NULL DEFAULT gen_random_uuid(),
  "title"         character varying(100)      NOT NULL DEFAULT ''::character varying,
  "due_on"        date,
  "scheduled_for" date,
  "priority"      smallint                    NOT NULL DEFAULT 4,
  "status"        smallint                    NOT NULL DEFAULT '1'::smallint,
  "created_at"    timestamp without time zone NOT NULL DEFAULT now(),
  "list_id"       uuid,
  "goal_id"       uuid,
  "template_id"   uuid,
  "alarm_time"    time without time zone,
  "subtasks"      jsonb                       NOT NULL DEFAULT '[]'::jsonb,
  "url"           text,
  CONSTRAINT "task_pkey" PRIMARY KEY (id),
  CONSTRAINT "tasks_goal_id_fkey" FOREIGN KEY (goal_id) REFERENCES public.goals(id) ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT "tasks_list_id_fkey" FOREIGN KEY (list_id) REFERENCES public.lists(id) ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT "tasks_subtasks_is_array" CHECK ((jsonb_typeof(subtasks) = 'array'::text)),
  CONSTRAINT "tasks_template_id_fkey" FOREIGN KEY (template_id) REFERENCES public.repeat_task_templates(id) ON UPDATE CASCADE ON DELETE SET NULL,
  "user_id"       uuid                        NOT NULL DEFAULT auth.uid(),
  CONSTRAINT "tasks_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON UPDATE CASCADE ON DELETE CASCADE
);

ALTER TABLE "public"."tasks"
  ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_tasks_goal_id ON public.tasks USING btree (goal_id);

CREATE INDEX idx_tasks_list_id ON public.tasks USING btree (list_id);

CREATE INDEX idx_tasks_template_id ON public.tasks USING btree (template_id);

CREATE INDEX idx_tasks_user_id ON public.tasks USING btree (user_id);

CREATE POLICY "Users can delete their own tasks" ON "public"."tasks"
  FOR DELETE
  TO "authenticated"
  USING ((( SELECT auth.uid() AS uid) = user_id));

CREATE POLICY "Users can insert their own tasks" ON "public"."tasks"
  FOR INSERT
  TO "authenticated"
  WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));

CREATE POLICY "Users can read their own tasks" ON "public"."tasks"
  FOR SELECT
  TO "authenticated"
  USING ((( SELECT auth.uid() AS uid) = user_id));

CREATE POLICY "Users can update their own tasks" ON "public"."tasks"
  FOR UPDATE
  TO "authenticated"
  USING ((( SELECT auth.uid() AS uid) = user_id))
  WITH CHECK (((( SELECT auth.uid() AS uid) = user_id) AND ((list_id IS NULL) OR (EXISTS ( SELECT 1
   FROM public.lists l
  WHERE ((l.id = tasks.list_id) AND (l.user_id = ( SELECT auth.uid() AS uid)))))) AND ((goal_id IS NULL) OR (EXISTS ( SELECT 1
   FROM public.goals g
  WHERE ((g.id = tasks.goal_id) AND (g.user_id = ( SELECT auth.uid() AS uid)))))) AND ((template_id IS NULL) OR (EXISTS ( SELECT 1
   FROM public.repeat_task_templates t
  WHERE ((t.id = tasks.template_id) AND (t.user_id = ( SELECT auth.uid() AS uid))))))));

REVOKE ALL ON TABLE "public"."tasks" FROM "anon";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."tasks" TO "anon";

REVOKE ALL ON TABLE "public"."tasks" FROM "authenticated";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."tasks" TO "authenticated";

REVOKE ALL ON TABLE "public"."tasks" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."tasks" TO "postgres";

REVOKE ALL ON TABLE "public"."tasks" FROM "service_role";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."tasks" TO "service_role";
