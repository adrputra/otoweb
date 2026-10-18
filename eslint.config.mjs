import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'
import eslintConfigPrettier from 'eslint-config-prettier/flat'

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  eslintConfigPrettier,
  {
    // The v0 vehicle form is a known legacy component scheduled for the
    // component-cleanup/CRUD phase. Do not refactor the UI in the tooling
    // feature; keep its known React Compiler and typing findings non-blocking.
    files: ['components/vehicle-form.tsx'],
    rules: {
      'react-hooks/refs': 'off',
      'react-hooks/static-components': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  globalIgnores([
    'node_modules/**',
    '.next/**',
    'coverage/**',
    'playwright-report/**',
    'test-results/**',
    '.specify/**',
    'specs/**',
    '.sdd-toolbox/**',
    '.visual-qa/**',
    'public/**',
    'next-env.d.ts',
  ]),
])

export default eslintConfig
