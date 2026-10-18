CREATE TYPE "public"."lead_source" AS ENUM('contact_form', 'whatsapp', 'phone', 'manual');--> statement-breakpoint
CREATE TYPE "public"."lead_status" AS ENUM('new', 'contacted', 'qualified', 'won', 'lost');--> statement-breakpoint
CREATE TABLE "leads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"vehicle_id" uuid,
	"name" text,
	"phone" text,
	"email" text,
	"message" text,
	"source" "lead_source" DEFAULT 'contact_form' NOT NULL,
	"status" "lead_status" DEFAULT 'new' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "leads_tenant_id_idx" ON "leads" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "leads_status_idx" ON "leads" USING btree ("status");--> statement-breakpoint
CREATE INDEX "leads_vehicle_id_idx" ON "leads" USING btree ("vehicle_id");--> statement-breakpoint
-- Lead capture tenant isolation (F010) ---------------------------------------
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.leads FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS leads_tenant_isolation ON public.leads;
--> statement-breakpoint
CREATE POLICY leads_tenant_isolation ON public.leads
  FOR ALL
  USING (tenant_id = app.current_tenant_id() OR app.is_platform_admin())
  WITH CHECK (tenant_id = app.current_tenant_id() OR app.is_platform_admin());
