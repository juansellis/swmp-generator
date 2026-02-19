# SWMP Generator

Next.js + Supabase app to generate NZ-first Site Waste Management Plans (SWMPs).

## Setup
1. Copy `.env.example` to `.env.local` and fill values
2. `npm install` (runs `playwright install chromium` via postinstall for PDF export)
3. `npm run dev`

### PDF export (Report → Download PDF)
- **Local:** After `npm install`, Chromium is installed and "Download PDF" works.
- **CI/deploy:** Ensure the install step runs Playwright (e.g. `npm ci` runs postinstall). On Linux you may need system deps: `npx playwright install-deps` (or `playwright install --with-deps`).
- **Optional:** Set `PLAYWRIGHT_BROWSERS_PATH=0` to use the default browser cache (see `.env.example`).
- If the PDF engine is missing, the app shows a fallback: "Open print view" → use the browser’s Print → Save as PDF.
