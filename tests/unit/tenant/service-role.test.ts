// @vitest-environment node
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { assertServerOnly } from '@/lib/tenant/server'

const ROOT = process.cwd()
const SOURCE_DIRS = ['app', 'components', 'lib', 'tests']
const ROOT_FILES = ['proxy.ts', 'next.config.mjs', 'package.json', '.env.example']
const SKIP_DIRS = new Set(['node_modules', '.next', '.git', 'playwright-report', 'test-results'])

function walk(dir: string): string[] {
  const absolute = join(ROOT, dir)
  let entries: string[]
  try {
    entries = readdirSync(absolute)
  } catch {
    return []
  }

  const files: string[] = []
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry)) continue
    const path = join(dir, entry)
    const stat = statSync(join(ROOT, path))
    if (stat.isDirectory()) files.push(...walk(path))
    else if (/\.(ts|tsx|mjs|js|json)$/.test(entry)) files.push(path)
  }
  return files
}

function sourceFiles(): string[] {
  return [...SOURCE_DIRS.flatMap(walk), ...ROOT_FILES]
}

function read(path: string): string {
  return readFileSync(join(ROOT, path), 'utf8')
}

afterEach(() => {
  delete (globalThis as { window?: unknown }).window
})

describe('service-role boundary', () => {
  it('never exposes a service-role variable with a public prefix', () => {
    const offenders = sourceFiles().filter((path) =>
      /NEXT_PUBLIC_[A-Z0-9_]*SERVICE_ROLE/i.test(read(path)),
    )

    expect(offenders).toEqual([])
  })

  it('never commits a service-role JWT', () => {
    const offenders = sourceFiles().filter((path) => {
      const content = read(path)
      return /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/.test(content)
    })

    expect(offenders).toEqual([])
  })

  it('keeps .env.example free of any service-role assignment', () => {
    const example = read('.env.example')

    expect(example).not.toMatch(/SERVICE_ROLE/i)
    expect(example).not.toMatch(/eyJ[A-Za-z0-9_-]{10,}/)
  })

  it('does not import server-only tenant or database modules from browser code', () => {
    const clientFiles = sourceFiles().filter((path) => {
      const content = read(path)
      return /^['"]use client['"]/m.test(content)
    })

    const offenders = clientFiles.filter((path) => {
      const content = read(path)
      return /from ['"]@\/(?:lib\/tenant|db\/|lib\/auth\/(?:local|local-backend|server))/.test(content)
    })

    expect(offenders).toEqual([])
  })

  it('marks every tenant module as server-only by construction', () => {
    const tenantFiles = walk('lib/tenant')

    expect(tenantFiles.length).toBeGreaterThan(0)
    for (const path of tenantFiles) {
      expect(read(path), relative(ROOT, join(ROOT, path))).not.toMatch(/^['"]use client['"]/m)
    }
  })

  it('refuses to initialize tenant server code in a browser-like context', () => {
    ;(globalThis as { window?: unknown }).window = {}
    expect(() => assertServerOnly('lib/tenant')).toThrow(/server-only/)
  })
})
