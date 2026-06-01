# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Requirements

All project requirements, briefs, specs, and business context documents are stored in the [`requirements/`](requirements/) folder. **Always read all files in that folder before answering questions or implementing anything** — they contain the authoritative context for this project.

## Commands

```bash
npm test                  # Run all tests across Chromium, Firefox, WebKit
npm run test:headed       # Run tests with visible browser windows
npm run test:debug        # Run with Playwright Inspector attached
npm run test:watch        # Watch mode — re-runs tests on file save
npm run test:report       # Open the last HTML report in a browser
```

To run a single test file or grep for a specific test:
```bash
npx playwright test tests/infonyx.smoke-sanity.spec.js
npx playwright test --grep "smoke"
npx playwright test --project=chromium   # Single browser only
```

## Architecture

This is a **Playwright smoke and sanity test suite** for the live Infonyx website (`https://infonyx.com.au/`). There is no local server — tests hit the production URL directly.

All tests live in a single file: [tests/infonyx.smoke-sanity.spec.js](tests/infonyx.smoke-sanity.spec.js). The file is intentionally flat — no fixtures directory, no page object model. Two module-level helpers (`openHomePage`, `getInternalLinks`) are reused across suites.

Tests are organized into five `describe` blocks in order of scope:
1. **Smoke** — page loads, content exists, images return 200, no JS console errors
2. **Navigation** — links are clickable, important internal pages return 200, logo links home
3. **Contact** — a contact path (link, email, or phone) exists and leads to a form or contact detail
4. **Responsive** — layout doesn't overflow at mobile (390×844) or desktop (1440×900) viewports
5. **SEO / Accessibility** — meta description, `lang` attribute, `alt` text, Tab key focus movement

## Configuration Notes

- `playwright.config.ts` sets `baseURL: 'http://localhost:3000'` but the tests hard-code `https://infonyx.com.au/` via the `HOME_PAGE` constant — the `baseURL` is effectively unused.
- The config runs **all three browser engines in parallel** by default. On CI (`process.env.CI`), it switches to 1 worker and 2 retries.
- Screenshots are captured only on failure; traces are captured on first retry.

## MCP Integration

`.vscode/mcp.json` registers the Playwright MCP server (`@playwright/mcp@latest`) via stdio. This lets Claude interact with a live browser session directly through the MCP protocol — useful for debugging failing tests or exploring page state without writing test code.
