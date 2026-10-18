CREATE TYPE "public"."tenant_domain_type" AS ENUM('platform_subdomain', 'custom_domain');--> statement-breakpoint
CREATE TYPE "public"."tenant_member_role" AS ENUM('platform_admin', 'owner', 'staff');--> statement-breakpoint
CREATE TYPE "public"."tenant_status" AS ENUM('active', 'suspended', 'trial', 'disabled');--> statement-breakpoint
CREATE TYPE "public"."vehicle_fuel_type" AS ENUM('bensin', 'diesel', 'hybrid', 'listrik');--> statement-breakpoint
CREATE TYPE "public"."vehicle_status" AS ENUM('draft', 'available', 'reserved', 'sold', 'archived');--> statement-breakpoint
CREATE TYPE "public"."vehicle_transmission" AS ENUM('AT', 'MT', 'CVT');--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"full_name" text,
	"avatar_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "showroom_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"display_name" text NOT NULL,
	"tagline" text,
	"description" text,
	"logo_url" text,
	"favicon_url" text,
	"hero_image_url" text,
	"primary_color" text,
	"secondary_color" text,
	"phone" text,
	"whatsapp" text,
	"email" text,
	"address" text,
	"city" text,
	"province" text,
	"postal_code" text,
	"google_maps_url" text,
	"instagram_url" text,
	"tiktok_url" text,
	"facebook_url" text,
	"opening_hours" text,
	"seo_title" text,
	"seo_description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "showroom_settings_tenant_id_unique" UNIQUE("tenant_id")
);
--> statement-breakpoint
CREATE TABLE "tenant_domains" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"hostname" text NOT NULL,
	"type" "tenant_domain_type" DEFAULT 'platform_subdomain' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tenant_domains_hostname_unique" UNIQUE("hostname")
);
--> statement-breakpoint
CREATE TABLE "tenant_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "tenant_member_role" DEFAULT 'staff' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"status" "tenant_status" DEFAULT 'trial' NOT NULL,
	"plan" text DEFAULT 'starter' NOT NULL,
	"theme" text DEFAULT 'premium' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tenants_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "vehicle_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"vehicle_id" uuid NOT NULL,
	"provider" text DEFAULT 'cloudinary' NOT NULL,
	"provider_asset_id" text,
	"url" text NOT NULL,
	"alt" text DEFAULT '' NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"is_cover" boolean DEFAULT false NOT NULL,
	"width" integer,
	"height" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vehicles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"brand" text NOT NULL,
	"model" text NOT NULL,
	"variant" text NOT NULL,
	"year" integer NOT NULL,
	"transmission" "vehicle_transmission" NOT NULL,
	"fuel_type" "vehicle_fuel_type" NOT NULL,
	"body_type" text NOT NULL,
	"engine_capacity" integer NOT NULL,
	"mileage" integer NOT NULL,
	"color" text NOT NULL,
	"price" bigint NOT NULL,
	"original_price" bigint,
	"plate_region" text NOT NULL,
	"tax_expiry_date" date NOT NULL,
	"description" text NOT NULL,
	"status" "vehicle_status" DEFAULT 'draft' NOT NULL,
	"featured" boolean DEFAULT false NOT NULL,
	"location" text NOT NULL,
	"features" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"owner_count" integer,
	"documents" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"published_at" timestamp with time zone,
	"reserved_at" timestamp with time zone,
	"sold_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "showroom_settings" ADD CONSTRAINT "showroom_settings_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_domains" ADD CONSTRAINT "tenant_domains_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_members" ADD CONSTRAINT "tenant_members_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_members" ADD CONSTRAINT "tenant_members_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_images" ADD CONSTRAINT "vehicle_images_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_images" ADD CONSTRAINT "vehicle_images_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "showroom_settings_tenant_id_idx" ON "showroom_settings" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "tenant_domains_tenant_id_idx" ON "tenant_domains" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tenant_members_tenant_user_unique" ON "tenant_members" USING btree ("tenant_id","user_id");--> statement-breakpoint
CREATE INDEX "tenant_members_tenant_id_idx" ON "tenant_members" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "tenants_status_idx" ON "tenants" USING btree ("status");--> statement-breakpoint
CREATE INDEX "vehicle_images_tenant_id_idx" ON "vehicle_images" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "vehicle_images_vehicle_id_idx" ON "vehicle_images" USING btree ("vehicle_id");--> statement-breakpoint
CREATE UNIQUE INDEX "vehicles_tenant_slug_unique" ON "vehicles" USING btree ("tenant_id","slug");--> statement-breakpoint
CREATE INDEX "vehicles_tenant_id_idx" ON "vehicles" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "vehicles_status_idx" ON "vehicles" USING btree ("status");