// @vitest-environment node
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const appDir = fileURLToPath(new URL('../../../app', import.meta.url))
const rootDir = fileURLToPath(new URL('../../..', import.meta.url))
const routeFiles = new Set(['page.tsx', 'page.ts', 'route.ts', 'route.tsx', 'route.js'])
const forbiddenSegment = /(^|\/)(register|signup|sign-up|daftar)(\/|$)/i

function collectRoutes(dir: string, base = ''): string[] {
  const entries = readdirSync(dir, { withFileTypes: true })
  const routes = entries.some((entry) => entry.isFile() && routeFiles.has(entry.name))
    ? [base || '/']
    : []

  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    if (entry.name === 'node_modules' || entry.name.startsWith('_')) continue
    routes.push(...collectRoutes(join(dir, entry.name), `${base}/${entry.name}`))
  }

  return routes
}

const authSourceFiles = [
  'app/login/page.tsx',
  'app/login/login-form.tsx',
  'app/forgot-password/page.tsx',
  'app/forgot-password/forgot-password-form.tsx',
  'app/reset-password/page.tsx',
  'app/reset-password/reset-password-form.tsx',
]

describe('no public registration', () => {
  it('has no registration/sign-up route in the app route tree', () => {
    const routes = collectRoutes(appDir)
    const registrationRoutes = routes.filter((route) => forbiddenSegment.test(route))

    expect(registrationRoutes).toEqual([])
  })

  it('exposes the required auth routes', () => {
    const routes = collectRoutes(appDir)

    expect(routes).toEqual(
      expect.arrayContaining(['/login', '/forgot-password', '/reset-password']),
    )
    expect(routes).not.toEqual(expect.arrayContaining(['/register', '/signup', '/sign-up']))
  })

  it('has no registration link in the auth screens', () => {
    const sources = authSourceFiles
      .filter((file) => existsSync(join(rootDir, file)))
      .map((file) => readFileSync(join(rootDir, file), 'utf8'))
      .join('\n')

    expect(sources).not.toMatch(/href=["']\/(register|signup|sign-up|daftar)/i)
    expect(sources).not.toMatch(/["']\/(register|signup|sign-up)["']/i)
  })
})
