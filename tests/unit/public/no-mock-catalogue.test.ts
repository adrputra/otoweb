// @vitest-environment node
import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

const PUBLIC_RUNTIME_FILES = [
  'app/page.tsx',
  'app/cars/page.tsx',
  'app/cars/[slug]/page.tsx',
  'components/showroom.tsx',
  'lib/repositories.ts',
  'lib/public/tenant.ts',
  'lib/public/queries.ts',
] as const

const FORBIDDEN_MOCK_IMPORTS = [
  /from\s+['"]@\/data(?:\/index)?['"]/,
  /from\s+['"]\.\.?\/data(?:\/index)?['"]/,
  /from\s+['"]data\/index['"]/,
  /require\(\s*['"]@\/data/,
]

describe('public runtime mock-catalogue boundary', () => {
  it.each(PUBLIC_RUNTIME_FILES)('%s does not import the legacy mock catalogue', (file) => {
    const source = readFileSync(file, 'utf8')

    for (const pattern of FORBIDDEN_MOCK_IMPORTS) {
      expect(source, `${file} must not match ${pattern}`).not.toMatch(pattern)
    }
  })

  it('keeps the legacy catalogue in the seed and test layer only', () => {
    const seed = readFileSync('db/seed-core.ts', 'utf8')
    const admin = readFileSync('app/admin/page.tsx', 'utf8')

    expect(seed).toMatch(/from\s+['"]\.\.\/data['"]/)

    // F010 replaced the mock admin lead/dashboard source with tenant-scoped
    // database reads.
    for (const pattern of FORBIDDEN_MOCK_IMPORTS) {
      expect(admin, `app/admin/page.tsx must not match ${pattern}`).not.toMatch(pattern)
    }
  })
})
