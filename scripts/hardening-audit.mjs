#!/usr/bin/env node
/**
 * F016 production-hardening audit.
 *
 * Deterministic, offline checks that complement the network dependency audit:
 * - every tenant-scoped table is RLS-enabled, forced, and has a policy;
 * - the application config ships the documented hardening headers;
 * - no service-role/private key material or unexpected raw-HTML sink exists;
 * - both showrooms are seeded as realistic tenants.
 *
 * The script prints a JSON summary and writes it to
 * `.visual-qa/reports/f016-hardening-audit.json`.
 */
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const ROOT = process.cwd()

const TENANT_TABLES = [
  'tenants',
  'tenant_domains',
  'profiles',
  'tenant_members',
  'showroom_settings',
  'vehicles',
  'vehicle_images',
  'leads',
  'analytics_events',
]

const REQUIRED_HEADERS = [
  'X-Content-Type-Options',
  'Referrer-Policy',
  'X-Frame-Options',
  'Permissions-Policy',
  'Cross-Origin-Opener-Policy',
  'Content-Security-Policy',
  'Strict-Transport-Security',
]

const EXPECTED_RAW_HTML_SINKS = new Set(['components/seo/json-ld.tsx'])

const SECRET_PATTERNS = [
  { name: 'database url with inline password', pattern: /DATABASE_URL\s*=\s*['"]?postgres(?:ql)?:\/\/[^:\s]+:[^@\s]+@/ },
  { name: 'stripe live secret', pattern: /sk_live_[A-Za-z0-9]{8,}/ },
  { name: 'private key block', pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
  { name: 'cloudinary secret assignment', pattern: /CLOUDINARY_API_SECRET\s*=\s*['"]?[A-Za-z0-9._-]{8,}/ },
]

async function listFiles(dir, filter, base = ROOT) {
  const absolute = join(base, dir)
  let entries
  try {
    entries = await readdir(absolute, { withFileTypes: true })
  } catch {
    return []
  }

  const files = []
  for (const entry of entries) {
    const relative = join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await listFiles(relative, filter, base)))
    } else if (entry.isFile() && filter(relative)) {
      files.push(relative)
    }
  }
  return files
}

async function auditRls() {
  const migrationDir = 'db/migrations'
  const files = (await readdir(join(ROOT, migrationDir)))
    .filter((name) => name.endsWith('.sql'))
    .sort()
  const sql = (await Promise.all(files.map((name) => readFile(join(ROOT, migrationDir, name), 'utf8')))).join('\n')

  const tables = TENANT_TABLES.map((table) => {
    const enable = new RegExp(`ALTER TABLE public\\.${table} ENABLE ROW LEVEL SECURITY`, 'i').test(sql)
    const force = new RegExp(`ALTER TABLE public\\.${table} FORCE ROW LEVEL SECURITY`, 'i').test(sql)
    const policy = new RegExp(`CREATE POLICY [^;]* ON public\\.${table}`, 'i').test(sql)
    return { table, enable, force, policy, ok: enable && force && policy }
  })

  return {
    ok: tables.every((table) => table.ok),
    tables,
  }
}

async function auditHeaders() {
  const config = await readFile(join(ROOT, 'next.config.mjs'), 'utf8')
  const headerSource = await readFile(join(ROOT, 'lib/security/headers.mjs'), 'utf8')
  const combined = `${config}\n${headerSource}`
  const headers = REQUIRED_HEADERS.map((header) => ({
    header,
    present: combined.includes(header),
  }))
  const poweredByHidden = /poweredByHeader\s*:\s*false/.test(config)
  const hstsProductionOnly =
    /NODE_ENV\s*===?\s*['"]production['"]/.test(config) &&
    /if\s*\(isProduction\)/.test(headerSource)

  return {
    ok: headers.every((entry) => entry.present) && poweredByHidden && hstsProductionOnly,
    headers,
    poweredByHidden,
    hstsProductionOnly,
  }
}

async function auditSources() {
  const sourceFiles = [
    ...(await listFiles('app', (file) => /\.(ts|tsx|mjs)$/.test(file))),
    ...(await listFiles('components', (file) => /\.(ts|tsx)$/.test(file))),
    ...(await listFiles('lib', (file) => /\.(ts|tsx)$/.test(file))),
    ...(await listFiles('db', (file) => /\.(ts|tsx|sql)$/.test(file))),
    ...(await listFiles('scripts', (file) => /\.(mjs|ts)$/.test(file))),
    '.env.example',
    'next.config.mjs',
    'proxy.ts',
  ]

  const secrets = []
  const rawHtmlSinks = []
  const dynamicCode = []

  for (const file of sourceFiles) {
    const source = await readFile(join(ROOT, file), 'utf8')

    // `.env.example` intentionally contains placeholder names such as
    // "your-api-secret"; it is documentation, not a secret source.
    if (file !== '.env.example') {
      for (const rule of SECRET_PATTERNS) {
        if (rule.pattern.test(source)) secrets.push({ file, rule: rule.name })
      }
    }
    if (
      file !== 'scripts/hardening-audit.mjs' &&
      source.includes('dangerouslySetInnerHTML') &&
      !EXPECTED_RAW_HTML_SINKS.has(file)
    ) {
      rawHtmlSinks.push(file)
    }
    if (/\beval\s*\(|new Function\s*\(/.test(source)) dynamicCode.push(file)
  }

  return {
    ok: secrets.length === 0 && rawHtmlSinks.length === 0 && dynamicCode.length === 0,
    scannedFiles: sourceFiles.length,
    secrets,
    rawHtmlSinks,
    dynamicCode,
    expectedRawHtmlSinks: [...EXPECTED_RAW_HTML_SINKS],
  }
}

async function auditShowrooms() {
  const seed = await readFile(join(ROOT, 'db/seed-core.ts'), 'utf8')
  const checks = {
    primaTenant: seed.includes("name: 'Prima Auto Gallery'"),
    tenantBTenant: seed.includes("name: 'Tenant B Test Showroom'"),
    primaDomain: seed.includes('prima.otoweb.id'),
    tenantBDomain: seed.includes('tenant-b.otoweb.id'),
    tenantBVehicles: /TENANT_B_VEHICLE/.test(seed),
    tenantBImages: /tenantBVehicleImageRows/.test(seed),
  }

  return { ok: Object.values(checks).every(Boolean), checks }
}

async function main() {
  const report = {
    feature: 'F016',
    generatedAt: new Date().toISOString(),
    checks: {
      rls: await auditRls(),
      headers: await auditHeaders(),
      sources: await auditSources(),
      showrooms: await auditShowrooms(),
    },
  }

  report.verdict = Object.values(report.checks).every((check) => check.ok) ? 'PASS' : 'FAIL'

  await mkdir(join(ROOT, '.visual-qa/reports'), { recursive: true })
  const output = `${JSON.stringify(report, null, 2)}\n`
  await writeFile(join(ROOT, '.visual-qa/reports/f016-hardening-audit.json'), output)
  process.stdout.write(output)

  if (report.verdict !== 'PASS') process.exitCode = 1
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
