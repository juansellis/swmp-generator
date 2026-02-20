# SWMP Generator

Next.js + Supabase app to generate NZ-first Site Waste Management Plans (SWMPs).

## Setup
1. Copy `.env.example` to `.env.local` and fill values
2. `npm install` (runs `playwright install chromium` via postinstall for PDF export)
3. `npm run dev`

### PDF export (Report → Download PDF)
- **Default:** "Download PDF" opens the Print View in a new tab and triggers the browser print dialog. Use **Print → Save as PDF** (or the "Print / Save as PDF" button) to get a PDF. Works on Vercel and local dev without any server-side PDF engine.
- **Print View route:** `/projects/[id]/report/print` — report-only layout, no app chrome; supports `?mode=full` and `?tab=...` for deep links.
- **Optional server PDF:** The `/api/report/pdf` endpoint (Playwright/Chromium) is experimental and not used by the default export. If you enable it, ensure Chromium is installed (e.g. `npx playwright install chromium`) and system deps on Linux if needed.
