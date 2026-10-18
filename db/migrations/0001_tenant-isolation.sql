-- Multi-tenant row-level security (F005)
--
-- The application sets these values transaction-locally before tenant-scoped
-- work:
--   select set_config('app.tenant_id', '<uuid>', true);
--   select set_config('app.user_id', '<uuid>', true);
--   select set_config('app.is_platform_admin', 'true'|'false', true);
--
-- Missing or malformed values resolve to null/false, so an unscoped connection
-- sees no tenant rows instead of falling back to "all tenants".

CREATE SCHEMA IF NOT EXISTS app;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION app.current_tenant_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT CASE
    WHEN current_setting('app.tenant_id', true) ~*
      '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    THEN current_setting('app.tenant_id', true)::uuid
    ELSE NULL
  END
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION app.current_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT CASE
    WHEN current_setting('app.user_id', true) ~*
      '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    THEN current_setting('app.user_id', true)::uuid
    ELSE NULL
  END
$$;
--> statement-breakpoint
-- The setting alone is not enough: a direct database caller cannot promote
-- itself by setting app.is_platform_admin. The user must actually hold an
-- active platform_admin membership. SECURITY DEFINER avoids recursive RLS.
CREATE OR REPLACE FUNCTION app.is_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT coalesce(current_setting('app.is_platform_admin', true) = 'true', false)
    AND EXISTS (
      SELECT 1
      FROM public.tenant_members m
      WHERE m.user_id = app.current_user_id()
        AND m.role = 'platform_admin'
        AND m.status = 'active'
    )
$$;
--> statement-breakpoint
-- SECURITY DEFINER avoids recursive row-level-security evaluation when a policy
-- on tenant_members needs to know whether the current user owns the tenant.
CREATE OR REPLACE FUNCTION app.is_tenant_owner()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.tenant_members m
    WHERE m.tenant_id = app.current_tenant_id()
      AND m.user_id = app.current_user_id()
      AND m.role = 'owner'
      AND m.status = 'active'
  )
$$;
--> statement-breakpoint
GRANT USAGE ON SCHEMA app TO PUBLIC;
--> statement-breakpoint
-- tenants -------------------------------------------------------------------
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.tenants FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS tenants_select ON public.tenants;
--> statement-breakpoint
CREATE POLICY tenants_select ON public.tenants
  FOR SELECT
  USING (id = app.current_tenant_id() OR app.is_platform_admin());
--> statement-breakpoint
DROP POLICY IF EXISTS tenants_insert ON public.tenants;
--> statement-breakpoint
CREATE POLICY tenants_insert ON public.tenants
  FOR INSERT
  WITH CHECK (app.is_platform_admin());
--> statement-breakpoint
DROP POLICY IF EXISTS tenants_update ON public.tenants;
--> statement-breakpoint
CREATE POLICY tenants_update ON public.tenants
  FOR UPDATE
  USING (app.is_platform_admin())
  WITH CHECK (app.is_platform_admin());
--> statement-breakpoint
DROP POLICY IF EXISTS tenants_delete ON public.tenants;
--> statement-breakpoint
CREATE POLICY tenants_delete ON public.tenants
  FOR DELETE
  USING (app.is_platform_admin());
--> statement-breakpoint
-- tenant_domains ------------------------------------------------------------
ALTER TABLE public.tenant_domains ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.tenant_domains FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS tenant_domains_select ON public.tenant_domains;
--> statement-breakpoint
CREATE POLICY tenant_domains_select ON public.tenant_domains
  FOR SELECT
  USING (tenant_id = app.current_tenant_id() OR app.is_platform_admin());
--> statement-breakpoint
DROP POLICY IF EXISTS tenant_domains_write ON public.tenant_domains;
--> statement-breakpoint
CREATE POLICY tenant_domains_write ON public.tenant_domains
  FOR ALL
  USING (app.is_platform_admin())
  WITH CHECK (app.is_platform_admin());
--> statement-breakpoint
-- profiles ------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.profiles FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS profiles_select ON public.profiles;
--> statement-breakpoint
CREATE POLICY profiles_select ON public.profiles
  FOR SELECT
  USING (
    id = app.current_user_id()
    OR app.is_platform_admin()
    OR EXISTS (
      SELECT 1
      FROM public.tenant_members m
      WHERE m.user_id = public.profiles.id
        AND m.tenant_id = app.current_tenant_id()
    )
  );
--> statement-breakpoint
DROP POLICY IF EXISTS profiles_insert ON public.profiles;
--> statement-breakpoint
CREATE POLICY profiles_insert ON public.profiles
  FOR INSERT
  WITH CHECK (id = app.current_user_id() OR app.is_platform_admin());
--> statement-breakpoint
DROP POLICY IF EXISTS profiles_update ON public.profiles;
--> statement-breakpoint
CREATE POLICY profiles_update ON public.profiles
  FOR UPDATE
  USING (id = app.current_user_id() OR app.is_platform_admin())
  WITH CHECK (id = app.current_user_id() OR app.is_platform_admin());
--> statement-breakpoint
DROP POLICY IF EXISTS profiles_delete ON public.profiles;
--> statement-breakpoint
CREATE POLICY profiles_delete ON public.profiles
  FOR DELETE
  USING (app.is_platform_admin());
--> statement-breakpoint
-- tenant_members ------------------------------------------------------------
ALTER TABLE public.tenant_members ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.tenant_members FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS tenant_members_select ON public.tenant_members;
--> statement-breakpoint
CREATE POLICY tenant_members_select ON public.tenant_members
  FOR SELECT
  USING (
    tenant_id = app.current_tenant_id()
    OR user_id = app.current_user_id()
    OR app.is_platform_admin()
  );
--> statement-breakpoint
DROP POLICY IF EXISTS tenant_members_insert ON public.tenant_members;
--> statement-breakpoint
CREATE POLICY tenant_members_insert ON public.tenant_members
  FOR INSERT
  WITH CHECK (
    tenant_id = app.current_tenant_id()
    AND (app.is_platform_admin() OR app.is_tenant_owner())
  );
--> statement-breakpoint
DROP POLICY IF EXISTS tenant_members_update ON public.tenant_members;
--> statement-breakpoint
CREATE POLICY tenant_members_update ON public.tenant_members
  FOR UPDATE
  USING (
    tenant_id = app.current_tenant_id()
    AND (app.is_platform_admin() OR app.is_tenant_owner())
  )
  WITH CHECK (
    tenant_id = app.current_tenant_id()
    AND (app.is_platform_admin() OR app.is_tenant_owner())
  );
--> statement-breakpoint
DROP POLICY IF EXISTS tenant_members_delete ON public.tenant_members;
--> statement-breakpoint
CREATE POLICY tenant_members_delete ON public.tenant_members
  FOR DELETE
  USING (
    tenant_id = app.current_tenant_id()
    AND (app.is_platform_admin() OR app.is_tenant_owner())
  );
--> statement-breakpoint
-- showroom_settings ---------------------------------------------------------
ALTER TABLE public.showroom_settings ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.showroom_settings FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS showroom_settings_tenant_isolation ON public.showroom_settings;
--> statement-breakpoint
CREATE POLICY showroom_settings_tenant_isolation ON public.showroom_settings
  FOR ALL
  USING (tenant_id = app.current_tenant_id() OR app.is_platform_admin())
  WITH CHECK (tenant_id = app.current_tenant_id() OR app.is_platform_admin());
--> statement-breakpoint
-- vehicles ------------------------------------------------------------------
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.vehicles FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS vehicles_tenant_isolation ON public.vehicles;
--> statement-breakpoint
CREATE POLICY vehicles_tenant_isolation ON public.vehicles
  FOR ALL
  USING (tenant_id = app.current_tenant_id() OR app.is_platform_admin())
  WITH CHECK (tenant_id = app.current_tenant_id() OR app.is_platform_admin());
--> statement-breakpoint
-- vehicle_images ------------------------------------------------------------
ALTER TABLE public.vehicle_images ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.vehicle_images FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS vehicle_images_tenant_isolation ON public.vehicle_images;
--> statement-breakpoint
CREATE POLICY vehicle_images_tenant_isolation ON public.vehicle_images
  FOR ALL
  USING (tenant_id = app.current_tenant_id() OR app.is_platform_admin())
  WITH CHECK (tenant_id = app.current_tenant_id() OR app.is_platform_admin());
