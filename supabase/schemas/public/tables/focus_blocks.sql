CREATE TABLE "public"."focus_blocks" (
  "id"                uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "task_id"           uuid                     NOT NULL,
  "date"              date                     NOT NULL,
  "total_seconds"     integer                  NOT NULL,
  "remaining_seconds" integer                  NOT NULL,
  "resumed_at"        timestamp with time zone,
  "created_at"        timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "focus_blocks_pkey" PRIMARY KEY (id),
  CONSTRAINT "focus_blocks_remaining_seconds_in_range" CHECK (((remaining_seconds >= 0) AND (remaining_seconds <= total_seconds))),
  CONSTRAINT "focus_blocks_total_seconds_positive" CHECK ((total_seconds > 0)),
  CONSTRAINT "focus_blocks_task_id_fkey" FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON UPDATE CASCADE ON DELETE CASCADE,
  "user_id"           uuid                     NOT NULL DEFAULT auth.uid(),
  CONSTRAINT "focus_blocks_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON UPDATE CASCADE ON DELETE CASCADE
);

ALTER TABLE "public"."focus_blocks"
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."focus_blocks"
  ADD COLUMN "status" public.focus_block_status NOT NULL DEFAULT 'active'::public.focus_block_status;

ALTER TABLE "public"."focus_blocks"
  ADD CONSTRAINT "focus_blocks_resumed_at_iff_active" CHECK (((status = 'active'::public.focus_block_status) = (resumed_at IS NOT NULL)));

CREATE INDEX idx_focus_blocks_task_id ON public.focus_blocks USING btree (task_id);

CREATE UNIQUE INDEX idx_focus_blocks_one_live_per_user ON public.focus_blocks USING btree (user_id)
  WHERE (status = ANY (ARRAY['active'::public.focus_block_status, 'paused'::public.focus_block_status]));

CREATE INDEX idx_focus_blocks_user_id ON public.focus_blocks USING btree (user_id);

CREATE POLICY "Users can delete their own focus blocks" ON "public"."focus_blocks"
  FOR DELETE
  TO "authenticated"
  USING ((( SELECT auth.uid() AS uid) = user_id));

CREATE POLICY "Users can select their own focus blocks" ON "public"."focus_blocks"
  FOR SELECT
  TO "authenticated"
  USING ((( SELECT auth.uid() AS uid) = user_id));

CREATE POLICY "Users can insert their own focus blocks" ON "public"."focus_blocks"
  FOR INSERT
  TO "authenticated"
  WITH CHECK (((( SELECT auth.uid() AS uid) = user_id) AND (EXISTS ( SELECT 1
   FROM public.tasks t
  WHERE ((t.id = focus_blocks.task_id) AND (t.user_id = ( SELECT auth.uid() AS uid)))))));

CREATE POLICY "Users can update their own focus blocks" ON "public"."focus_blocks"
  FOR UPDATE
  TO "authenticated"
  USING ((( SELECT auth.uid() AS uid) = user_id))
  WITH CHECK (((( SELECT auth.uid() AS uid) = user_id) AND (EXISTS ( SELECT 1
   FROM public.tasks t
  WHERE ((t.id = focus_blocks.task_id) AND (t.user_id = ( SELECT auth.uid() AS uid)))))));

COMMENT ON TABLE "public"."focus_blocks" IS 'DEX-49: one Pomodoro-style timer per row, always tied to a task. Stores an anchor (remaining_seconds + resumed_at) rather than per-second ticks; clients derive live remaining time. `date` is the local day the block belongs to, which is what the ritual Review step counts by.';

REVOKE ALL ON TABLE "public"."focus_blocks" FROM "authenticated";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "public"."focus_blocks" TO "authenticated";

REVOKE ALL ON TABLE "public"."focus_blocks" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."focus_blocks" TO "postgres";

REVOKE ALL ON TABLE "public"."focus_blocks" FROM "service_role";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."focus_blocks" TO "service_role";

REVOKE ALL ON TABLE "public"."focus_blocks" FROM "anon";
