ALTER TABLE "tenant_domains" ADD COLUMN "verification_status" text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "tenant_domains" ADD COLUMN "verification_token" text;--> statement-breakpoint
ALTER TABLE "tenant_domains" ADD COLUMN "ssl_status" text DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE "tenant_domains" ADD COLUMN "ssl_provisioned_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "tenant_domains" ADD COLUMN "last_checked_at" timestamp with time zone;--> statement-breakpoint
-- Existing active, verified platform subdomains are already covered by the
-- platform wildcard certificate. Backfill their new state so the stricter
-- custom-domain contract does not change their routing behavior.
UPDATE "tenant_domains"
SET "verification_status" = 'verified',
    "ssl_status" = 'active',
    "ssl_provisioned_at" = "verified_at",
    "last_checked_at" = "verified_at"
WHERE "status" = 'active' AND "verified_at" IS NOT NULL;