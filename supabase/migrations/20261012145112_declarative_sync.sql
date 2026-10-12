-- DEX-227: one-time convergence of migration history with the declarative schema
-- tree exported from production. A semantic no-op on prod, which already matches.

SET local check_function_bodies = off;

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" REVOKE ALL ON TABLES FROM "anon";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" REVOKE ALL ON TABLES FROM "authenticated";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" REVOKE ALL ON TABLES FROM "service_role";

COMMENT ON EXTENSION "pg_net" IS NULL;

DROP EXTENSION "pg_net";

CREATE EXTENSION "pg_net" SCHEMA "public";

COMMENT ON EXTENSION "pg_net" IS 'Async HTTP';

REVOKE ALL ON TABLE "public"."daily_habits" FROM "anon";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."daily_habits" TO "anon";

REVOKE ALL ON TABLE "public"."daily_habits" FROM "authenticated";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."daily_habits" TO "authenticated";

REVOKE ALL ON TABLE "public"."daily_habits" FROM "service_role";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."daily_habits" TO "service_role";

REVOKE ALL ON TABLE "public"."focus_blocks" FROM "service_role";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."focus_blocks" TO "service_role";

REVOKE ALL ON TABLE "public"."goals" FROM "anon";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."goals" TO "anon";

REVOKE ALL ON TABLE "public"."goals" FROM "authenticated";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."goals" TO "authenticated";

REVOKE ALL ON TABLE "public"."goals" FROM "service_role";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."goals" TO "service_role";

REVOKE ALL ON TABLE "public"."habits" FROM "anon";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."habits" TO "anon";

REVOKE ALL ON TABLE "public"."habits" FROM "authenticated";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."habits" TO "authenticated";

REVOKE ALL ON TABLE "public"."habits" FROM "service_role";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."habits" TO "service_role";

REVOKE ALL ON TABLE "public"."horoscopes" FROM "service_role";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."horoscopes" TO "service_role";

REVOKE ALL ON TABLE "public"."journals" FROM "anon";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."journals" TO "anon";

REVOKE ALL ON TABLE "public"."journals" FROM "authenticated";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."journals" TO "authenticated";

REVOKE ALL ON TABLE "public"."journals" FROM "service_role";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."journals" TO "service_role";

REVOKE ALL ON TABLE "public"."lists" FROM "anon";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."lists" TO "anon";

REVOKE ALL ON TABLE "public"."lists" FROM "authenticated";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."lists" TO "authenticated";

REVOKE ALL ON TABLE "public"."lists" FROM "service_role";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."lists" TO "service_role";

REVOKE ALL ON TABLE "public"."notes" FROM "anon";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."notes" TO "anon";

REVOKE ALL ON TABLE "public"."notes" FROM "authenticated";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."notes" TO "authenticated";

REVOKE ALL ON TABLE "public"."notes" FROM "service_role";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."notes" TO "service_role";

REVOKE ALL ON TABLE "public"."preferences" FROM "anon";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."preferences" TO "anon";

REVOKE ALL ON TABLE "public"."preferences" FROM "authenticated";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."preferences" TO "authenticated";

REVOKE ALL ON TABLE "public"."preferences" FROM "service_role";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."preferences" TO "service_role";

REVOKE ALL ON TABLE "public"."repeat_task_templates" FROM "anon";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."repeat_task_templates" TO "anon";

REVOKE ALL ON TABLE "public"."repeat_task_templates" FROM "authenticated";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."repeat_task_templates" TO "authenticated";

REVOKE ALL ON TABLE "public"."repeat_task_templates" FROM "service_role";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."repeat_task_templates" TO "service_role";

REVOKE ALL ON TABLE "public"."tasks" FROM "anon";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."tasks" TO "anon";

REVOKE ALL ON TABLE "public"."tasks" FROM "authenticated";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."tasks" TO "authenticated";

REVOKE ALL ON TABLE "public"."tasks" FROM "service_role";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."tasks" TO "service_role";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLES TO "anon";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLES TO "authenticated";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLES TO "service_role";
