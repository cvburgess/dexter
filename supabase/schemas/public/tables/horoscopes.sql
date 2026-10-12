CREATE TABLE "public"."horoscopes" (
  "date"                 date                     NOT NULL,
  "text"                 text                     NOT NULL,
  "overall_rating"       smallint                 NOT NULL,
  "tips"                 text[]                   NOT NULL DEFAULT '{}'::text[],
  "rating_identity"      smallint                 NOT NULL,
  "rating_health"        smallint                 NOT NULL,
  "rating_finance"       smallint                 NOT NULL,
  "rating_career"        smallint                 NOT NULL,
  "rating_love"          smallint                 NOT NULL,
  "rating_relationships" smallint                 NOT NULL,
  "rating_creativity"    smallint                 NOT NULL,
  "rating_spirituality"  smallint                 NOT NULL,
  "rating_home"          smallint                 NOT NULL,
  "rating_learning"      smallint                 NOT NULL,
  "rating_communication" smallint                 NOT NULL,
  "rating_travel"        smallint                 NOT NULL,
  "created_at"           timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "horoscopes_overall_rating_check" CHECK (((overall_rating >= 1) AND (overall_rating <= 5))),
  CONSTRAINT "horoscopes_rating_career_check" CHECK (((rating_career >= 1) AND (rating_career <= 5))),
  CONSTRAINT "horoscopes_rating_communication_check" CHECK (((rating_communication >= 1) AND (rating_communication <= 5))),
  CONSTRAINT "horoscopes_rating_creativity_check" CHECK (((rating_creativity >= 1) AND (rating_creativity <= 5))),
  CONSTRAINT "horoscopes_rating_finance_check" CHECK (((rating_finance >= 1) AND (rating_finance <= 5))),
  CONSTRAINT "horoscopes_rating_health_check" CHECK (((rating_health >= 1) AND (rating_health <= 5))),
  CONSTRAINT "horoscopes_rating_home_check" CHECK (((rating_home >= 1) AND (rating_home <= 5))),
  CONSTRAINT "horoscopes_rating_identity_check" CHECK (((rating_identity >= 1) AND (rating_identity <= 5))),
  CONSTRAINT "horoscopes_rating_learning_check" CHECK (((rating_learning >= 1) AND (rating_learning <= 5))),
  CONSTRAINT "horoscopes_rating_love_check" CHECK (((rating_love >= 1) AND (rating_love <= 5))),
  CONSTRAINT "horoscopes_rating_relationships_check" CHECK (((rating_relationships >= 1) AND (rating_relationships <= 5))),
  CONSTRAINT "horoscopes_rating_spirituality_check" CHECK (((rating_spirituality >= 1) AND (rating_spirituality <= 5))),
  CONSTRAINT "horoscopes_rating_travel_check" CHECK (((rating_travel >= 1) AND (rating_travel <= 5)))
);

ALTER TABLE "public"."horoscopes"
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."horoscopes"
  ADD COLUMN "sun_sign" public.sun_sign NOT NULL;

ALTER TABLE "public"."horoscopes"
  ADD CONSTRAINT "horoscopes_pkey" PRIMARY KEY (sun_sign, date);

CREATE POLICY "Anyone signed in can read horoscopes" ON "public"."horoscopes"
  FOR SELECT
  TO "authenticated"
  USING (true);

ALTER TABLE "public"."horoscopes"
  ADD COLUMN "sentiment" public.horoscope_sentiment GENERATED ALWAYS AS
    (public.horoscope_sentiment_from_ratings(VARIADIC ARRAY[rating_identity, rating_health, rating_finance, rating_career, rating_love, rating_relationships, rating_creativity,
    rating_spirituality, rating_home, rating_learning, rating_communication, rating_travel])) STORED NOT NULL;

COMMENT ON TABLE "public"."horoscopes" IS 'DEX-145: one sun-sign horoscope per day from astrology-api.io v3. Global reference data, not user-owned: readable by any signed-in user, written only by the service role via the generate-horoscopes Edge Function.';

COMMENT ON COLUMN "public"."horoscopes"."sentiment" IS 'DEX-166: derived, never written. The most common bucket among the twelve rating_* columns; ties yield mixed. Was generated from overall_rating, which returned 3 nearly every day and tinted the ritual panel neutral almost unconditionally.';

REVOKE ALL ON TABLE "public"."horoscopes" FROM "authenticated";

GRANT SELECT ON TABLE "public"."horoscopes" TO "authenticated";

REVOKE ALL ON TABLE "public"."horoscopes" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."horoscopes" TO "postgres";

REVOKE ALL ON TABLE "public"."horoscopes" FROM "service_role";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."horoscopes" TO "service_role";

REVOKE ALL ON TABLE "public"."horoscopes" FROM "anon";
