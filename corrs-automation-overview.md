# Corrs Chambers Westgarth — Automated Test Suite Overview

**Prepared by:** Infonyx  
**Website under test:** https://www.corrs.com.au/  
**Test framework:** Playwright (Node.js)  
**Browsers covered:** Chromium, Firefox, WebKit (Safari engine)  
**Date:** May 2026

---

## What We Built

An automated smoke and sanity test suite that runs against the live Corrs website across all three major browser engines. Tests run in parallel by default and produce a full HTML report with screenshots on failure.

The suite covers **12 functional areas** with a total of **80+ test cases**, tagged as either positive `[+]` (expected working paths) or negative `[-]` (error handling, validation, and edge cases).

---

## Test Coverage by Area

### 1. Smoke Tests
Verifies the site is up and serving correctly:
- Home page loads with the correct title (`Corrs Chambers Westgarth`)
- At least one visible H1 heading is present
- Meaningful content exists (500+ characters of body text)
- Visible images all return HTTP 200 (up to 15 checked)
- Featured Insights and Our People sections are present
- LinkedIn social link exists
- No critical JavaScript console errors are thrown

### 2. Navigation Tests
Verifies the site's link structure and routing:
- All 8 primary nav paths are attached to the document (`/who-we-are`, `/capabilities`, `/insights`, `/people`, `/careers`, `/deals`, `/news`, `/contact-us`)
- Header links (DEALS, NEWS, CONTACT US) are visible
- Logo click navigates back to the home page
- All main site sections return HTTP 200
- Footer links (Privacy, Terms of Use, Contact Us) are present
- Privacy and Terms of Use pages return HTTP 200
- First 10 internal links are not broken (no 4xx/5xx responses)

### 3. Contact Page — Positive Tests
Verifies the contact form is fully functional and office information is present:
- Page loads with "Contact Us" heading
- All form fields are visible and editable: First Name, Last Name, Email, Telephone, Organisation, Message, Industry
- Email input is correctly typed (`type="email"`)
- Message textarea accepts input correctly
- Submit button is visible and enabled
- All five office headings present: Sydney, Melbourne, Brisbane, Perth, Port Moresby
- Office phone numbers displayed (Sydney, Melbourne)
- Media contact `mailto:` link present
- "General enquiries" and "Connect with our team" headings visible

### 4. Contact Form — Negative / Validation Tests
Verifies the form handles bad input correctly:
- Empty form submission stays on the contact page (no unwanted redirect)
- Email field rejects plain text (e.g. `this-is-not-an-email`)
- Email field rejects incomplete addresses (e.g. `user@`)
- Name-only submission (no email) keeps the user on the form
- XSS payload in the message field does not execute as a script

### 5. People Directory
Verifies the lawyer/staff directory works end-to-end:
- Page loads with "People" heading
- At least one person profile link is present
- Person card image elements render
- Pagination control exists and page 2 still shows profiles
- A profile page returns HTTP 200
- An individual profile loads with a visible heading
- People page does not return a 500 error

### 6. Insights
Verifies the thought leadership / article section:
- Page loads with a visible heading
- At least one article link is present
- Filter controls (topic / content type) are present
- Article images return HTTP 200 (up to 6 checked)
- Clicking an article opens a valid page (HTTP 200)
- Subscribe / newsletter element is present
- Selecting a content type filter does not crash the page

### 7. Capabilities
Verifies the practice areas section:
- Page loads with a visible heading
- Key practice areas are in the document: Corporate, Litigation, Tax, Employment, Competition
- At least one capability sub-page link is present
- First 5 capability sub-pages return HTTP 200
- Navigating to a capability sub-URL loads a new, distinct page

### 8. Careers
Verifies the careers / recruitment section:
- "Achieve your ambition" heading is present
- Key sections present: Life at Corrs, Diversity, Graduates
- "Career Opportunities" CTA exists with a valid href
- "Explore Careers" or equivalent CTA is present
- Subscribe link exists with a valid href
- International Opportunities section present

### 9. Search
Verifies the site search does not error:
- Search icon/trigger is present on the home page
- Searching `mergers` returns no server error (no 500/503)
- Searching `banking` returns no server error
- Gibberish query (`zxqwerty12345notarealterm`) does not cause a 500 error

### 10. Responsive Layout
Verifies the layout adapts correctly across screen sizes:

| Viewport | Width × Height | Checks |
|---|---|---|
| Mobile | 390 × 844 | No horizontal scroll overflow |
| Tablet | 768 × 1024 | No overflow, H1 visible |
| Desktop | 1440 × 900 | No overflow, H1 visible |

Also checks: contact page and people page on mobile do not overflow; a header element exists at mobile width.

### 11. SEO & Accessibility
Verifies search engine and accessibility fundamentals:
- Page title contains "Corrs" and is at least 10 characters
- `<meta name="description">` or `<meta property="og:description">` is present
- `<html lang="...">` attribute is set
- At least one H1 on the home page
- All visible images have `alt` text or are marked decorative (`aria-hidden`, `role="presentation"`)
- Tab key moves keyboard focus to an interactive element (not stuck on `<body>`)
- `<header>` and `<main>` landmarks are present
- `<footer>` semantic element is present
- Open Graph title tag (`og:title`) exists
- Contact page has a meta or OG description
- No deprecated `<font>` or `<center>` HTML tags

### 12. Error Handling / 404
Verifies the site handles broken URLs gracefully:
- A non-existent URL does not return 200 or 500 (must return 404)
- The 404 page renders meaningful content (100+ characters — not a blank page)
- The 404 page still shows the site header/navigation
- Deals, News, and Who We Are sections return HTTP 200
- CorrsEdge footer link (if present) has a valid href

---

## Technical Approach

### Bot-Detection Bypass
The Corrs website uses Cloudflare protection that blocks standard headless browser requests. Two measures are in place so tests reach real content:

1. **Real Chrome user-agent string** — tests present the same UA a genuine Chrome browser would send.
2. **`--disable-blink-features=AutomationControlled`** — removes the automation flag from the browser launch args.
3. **`navigator.webdriver` override** — an `addInitScript` hook removes the `webdriver` property from `navigator` before every page load, which is what Cloudflare's JavaScript checks look for.

### Contact Page Handling
The contact page embeds a Cloudflare Turnstile CAPTCHA widget that continuously polls a network endpoint. Waiting for `networkidle` causes a timeout. Instead, the suite waits for `load` state and then explicitly waits for the first form field (`#form-input-email`) to appear — this is a reliable signal that the form has rendered.

### Selector Strategy
- **ID selectors** (`#form-input-email`, `#form-input-firstName`) are used for form fields because they are stable and unambiguous.
- **`toBeAttached()`** is used instead of `toBeVisible()` for elements inside animated carousels, mega-menus, or off-screen containers — confirming DOM presence without requiring the element to be in the viewport.
- **`.filter({ visible: true })`** is applied to headings to avoid false positives from hidden mega-menu H2s.

### HTTP Response Checks
Many tests use Playwright's `request` fixture to make direct HTTP GET requests and verify response status codes — without rendering a full browser page. This is faster and more reliable for checking whether URLs are alive.

---

## How to Run

```bash
# All browsers, all tests
npm test

# Single browser only (faster for development)
npx playwright test --project=chromium

# Run with visible browser windows
npm run test:headed

# Open the HTML report after a run
npm run test:report

# Run only the Corrs test file
npx playwright test tests/corrs.smoke-sanity.spec.js
```

Tests run in parallel across browsers by default. On CI, the suite automatically switches to a single worker with 2 retries per test.

---

## Reporting

After each run, Playwright generates a full HTML report including:
- Pass / fail status per test and per browser
- Screenshots captured on failure
- Trace files captured on the first retry (step-by-step browser recording for debugging)

---

*This suite is maintained by Infonyx as part of ongoing quality assurance for the Corrs Chambers Westgarth website.*
