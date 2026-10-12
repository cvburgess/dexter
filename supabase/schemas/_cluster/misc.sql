SELECT cron.schedule_in_database('dex84-generate-horoscopes', '0 6,7,8 * * *', 'select public.trigger_generate_horoscopes();', 'postgres', NULL, true);
