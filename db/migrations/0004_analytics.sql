CREATE TYPE "public"."analytics_event_type" AS ENUM('vehicle_view', 'inventory_search', 'filter_use', 'whatsapp_click', 'contact_submit', 'vehicle_share');--> statement-breakpoint
CREATE TABLE "analytics_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"event_type" "analytics_event_type" NOT NULL,
	"vehicle_id" uuid,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"path" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "analytics_events_tenant_type_created_idx" ON "analytics_events" USING btree ("tenant_id","event_type","created_at");--> statement-breakpoint
CREATE INDEX "analytics_events_tenant_vehicle_idx" ON "analytics_events" USING btree ("tenant_id","vehicle_id");--> statement-breakpoint
CREATE INDEX "analytics_events_tenant_created_idx" ON "analytics_events" USING btree ("tenant_id","created_at");--> statement-breakpoint
-- Analytics tenant isolation (F015) -----------------------------------------
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.analytics_events FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS analytics_events_tenant_isolation ON public.analytics_events;
--> statement-breakpoint
CREATE POLICY analytics_events_tenant_isolation ON public.analytics_events
  FOR ALL
  USING (tenant_id = app.current_tenant_id() OR app.is_platform_admin())
  WITH CHECK (tenant_id = app.current_tenant_id() OR app.is_platform_admin());
