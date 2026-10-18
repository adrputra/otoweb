# F004 Authentication — Visual QA Report

- **Date:** 2026-10-19 (Asia/Jakarta)
- **Feature:** F004 — Authentication
- **Spec dir:** `specs/003-authentication`
- **Surfaces:** `/login`, `/forgot-password`, `/reset-password` (invalid-link state)
- **Viewports:** desktop 1440×900, mobile 390×844
- **Capture command:** `pnpm visual:qa`
- **Detector command:** `impeccable detect --json app/login app/forgot-password app/reset-password components/auth components/admin-shell.tsx app/admin/layout.tsx`

## Verdict: PASS

## Capture evidence

`pnpm visual:qa` ran fresh at 2026-10-19T00:30:44+07:00 (capture file timestamp
2026-10-19T00:30:44+07:00, after the final Prettier pass) and wrote
`.visual-qa/reports/capture.json`.

| Viewport | Route | Heading visible | Horizontal overflow | Registration links |
|---|---|---|---|---|
| desktop 1440×900 | `/login` | yes | none | 0 |
| desktop 1440×900 | `/forgot-password` | yes | none | 0 |
| desktop 1440×900 | `/reset-password` | yes | none | 0 |
| mobile 390×844 | `/login` | yes | none | 0 |
| mobile 390×844 | `/forgot-password` | yes | none | 0 |
| mobile 390×844 | `/reset-password` | yes | none | 0 |

`capture.json` reports `"failures": []` and `"verdict": "PASS"`.

Screenshots inspected:

- `.visual-qa/screenshots/desktop/login.png`
- `.visual-qa/screenshots/desktop/forgot-password.png`
- `.visual-qa/screenshots/desktop/reset-password-invalid.png`
- `.visual-qa/screenshots/mobile/login.png`
- `.visual-qa/screenshots/mobile/forgot-password.png`
- `.visual-qa/screenshots/mobile/reset-password-invalid.png`

## Manual inspection

- The split brand/form layout holds at desktop; the brand panel collapses above
  the form at mobile with no clipping, overlap, or horizontal scroll.
- Typography hierarchy is clear: one page heading per surface, supporting copy,
  labeled fields, and a single primary action.
- Form fields, labels, password reveal control, and inline link ("Lupa kata
  sandi?") are aligned and legible at both viewports.
- Invalid reset-link state communicates the state and offers one clear recovery
  action.
- No registration or sign-up link/copy appears on any captured surface.
- Focus/hover affordances on inputs, buttons, and text links are visible.

## Detector output

`impeccable detect` exited 0 and returned an empty findings array:

```json
[]
```

Raw output: `.visual-qa/reports/impeccable-detect.json` (stderr:
`.visual-qa/reports/impeccable-detect.stderr.txt`, empty).

## Fixes

No visual defects were found, so no UI code was changed for this pass.
