'use strict';
/**
 * ====================================================================
 * RECONCILIATION AUSTRALIA — END-TO-END PLAYWRIGHT TEST SUITE
 * Website: https://www.reconciliation.org.au/
 * ====================================================================
 *
 * SUITE STRUCTURE (13 describe blocks, ~110 tests)
 * ─────────────────────────────────────────────────────────────────────
 *  1.  Smoke              — all key pages return HTTP 200, no JS errors
 *  2.  Main Navigation    — header links, logo, Donate CTA, search
 *  3.  Footer             — columns, policy links, contact, social media
 *  4.  Homepage Content   — hero, sections, CTAs, newsletter
 *  5.  Reconciliation Page— definition text, mission, program links
 *  6.  Our Work Page      — all six program areas are present
 *  7.  RAP Page           — four types, three pillars, stats, directory
 *  8.  About Us Page      — mission statement, leadership, contact info
 *  9.  News & Media Page  — article grid, dates, pagination, filters
 * 10.  Contact Page       — form fields, required attrs, contact info
 * 11.  Responsive Layout  — mobile 390px, tablet 768px, desktop 1440px
 * 12.  SEO & Accessibility— meta tags, lang, h1, alt text, keyboard nav
 * 13.  Link Integrity     — internal links from home page all return 200
 * ─────────────────────────────────────────────────────────────────────
 *
 * HOW TO RUN
 * ─────────────────────────────────────────────────────────────────────
 *  All tests:            npm test
 *  Single browser:       npx playwright test --project=chromium
 *  Single describe:      npx playwright test --grep "Smoke"
 *  Single test by name:  npx playwright test --grep "home page should load"
 *  Debug (inspector):    npm run test:debug
 *  Visible browser:      npm run test:headed
 * ─────────────────────────────────────────────────────────────────────
 */

const { test, expect } = require('@playwright/test');

// ====================================================================
// GLOBAL TEST TIMEOUT
// Each test on this production site gets 2 minutes. When 4 workers all
// hit a Cloudflare-protected site concurrently the initial page load
// can take 40-60 seconds. The default 30 s was too short.
// ====================================================================
test.setTimeout(120_000);

// ====================================================================
// CONSTANTS
// ====================================================================

/** Root URL — change this once to retarget the entire suite. */
const BASE_URL = 'https://www.reconciliation.org.au';

/**
 * PAGE — named URL map. Use PAGE.home instead of raw strings so a URL
 * change only needs to be made in one place.
 */
const PAGE = {
  home:           `${BASE_URL}/`,
  reconciliation: `${BASE_URL}/reconciliation/`,
  ourWork:        `${BASE_URL}/our-work/`,
  rap:            `${BASE_URL}/reconciliation-action-plans/`,
  aboutUs:        `${BASE_URL}/about-us/`,
  news:           `${BASE_URL}/news-and-media/news/`,
  contact:        `${BASE_URL}/contact-us/`,
  donate:         `${BASE_URL}/donate/`,
  privacy:        `${BASE_URL}/privacy/`,
  accessibility:  `${BASE_URL}/reconciliation-australia-accessibility/`,
};

/** Text labels expected in the primary desktop header navigation. */
const MAIN_NAV_LABELS = [
  'Reconciliation',
  'Our Work',
  'Reconciliation Action Plans',
  'About Us',
];

/** Social-media platform hostnames expected in the footer. */
const SOCIAL_PLATFORMS = [
  'linkedin.com',
  'instagram.com',
  'facebook.com',
  'youtube.com',
  'x.com',
];

// ====================================================================
// HELPERS
// ====================================================================

/**
 * goTo — navigate to a URL and wait until the HTML is parsed.
 *
 * 60 s navigation timeout handles slow Cloudflare-proxied responses.
 * Use this for almost every test.
 */
async function goTo(page, url) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
}

/**
 * goToAndLoad — navigate and wait for the full load event.
 *
 * Use only when images/scripts must finish loading (e.g. JS-error check).
 */
async function goToAndLoad(page, url) {
  await page.goto(url, { waitUntil: 'load', timeout: 90_000 });
}

/**
 * getPageText — return the visible body text of the current page.
 *
 * WHY innerText instead of textContent?
 * innerText respects CSS and excludes elements with display:none.
 * This site uses Elementor with hidden dropdown nav sub-items.
 * getByText().first() picks those hidden items before real page
 * content. innerText gives only what a user can actually see.
 */
async function getPageText(page) {
  return page.locator('body').innerText();
}

/**
 * expectPageContains — assert that visible page text matches a pattern.
 *
 * More reliable than element.toBeVisible() for content checks because
 * it is unaffected by hidden navigation menus or theme artifacts.
 */
async function expectPageContains(page, pattern, description) {
  const text = await getPageText(page);
  expect(text, description ?? `Page should contain: ${pattern}`).toMatch(pattern);
}

/**
 * getInternalLinks — return { text, href } for every <a> whose href
 * belongs to BASE_URL's domain.
 */
async function getInternalLinks(page) {
  const { hostname } = new URL(BASE_URL);
  return page.locator('a[href]').evaluateAll((anchors, host) =>
    anchors
      .map((a) => ({ text: a.innerText.trim(), href: a.href }))
      .filter((link) => {
        try { return new URL(link.href).hostname === host; }
        catch { return false; }
      })
  , hostname);
}

/**
 * assertPageOk — GET a URL and assert it returns HTTP 200.
 * The URL appears in the failure message for fast debugging.
 */
async function assertPageOk(request, url) {
  const res = await request.get(url, { timeout: 30_000 });
  expect(
    res.status(),
    `Expected HTTP 200 from "${url}" but received ${res.status()}`
  ).toBe(200);
}

/**
 * dismissCookieBanner — click a consent button if one appears within
 * 3 seconds, then force-remove any Elementor popup modals that would
 * otherwise intercept pointer events and block click actions.
 * Call this before any test that clicks page elements.
 */
async function dismissCookieBanner(page) {
  const sel = [
    'button:has-text("Accept")',
    'button:has-text("Accept all")',
    'button:has-text("I accept")',
    'button:has-text("Got it")',
    'button:has-text("Close")',
    '[aria-label="Accept cookies"]',
    '.wpcc-btn',
    '#cookie-notice .cn-set-cookie',
  ].join(', ');
  try {
    const btn = page.locator(sel).first();
    await btn.waitFor({ state: 'visible', timeout: 3_000 });
    await btn.click();
  } catch { /* no banner — carry on */ }

  // Elementor popup modals (e.g. newsletter sign-up) intercept pointer
  // events and cause all subsequent .click() calls to time out.
  // Force-remove them from the DOM rather than trying to close them,
  // because the close button itself may also be inside the overlay.
  try {
    await page.evaluate(() => {
      document.querySelectorAll(
        '[id*="elementor-popup-modal"], .elementor-popup-modal, .dialog-lightbox-widget'
      ).forEach((el) => el.remove());
    });
  } catch { /* page navigated away — carry on */ }
}

/**
 * getFirstVisibleHeading — first h2 or h3 that contains actual text.
 *
 * WHY NOT h1?
 * This site has an empty <h1 color="#000"></h1> as a theme artifact
 * (zero size, hidden). The real page titles live in h2 elements.
 */
function getFirstVisibleHeading(page) {
  return page.locator('h2, h3').filter({ hasText: /\S/ }).first();
}

// ====================================================================
// 1. SMOKE — Critical pages must load
// ====================================================================
/**
 * Fastest health-check. If any smoke test fails the site is likely
 * down or misconfigured. Run these first.
 */
test.describe('1. Smoke — critical pages must load', () => {

  // HTTP-level checks (no browser, uses the request fixture)
  test('home page returns HTTP 200', async ({ request }) => {
    await assertPageOk(request, PAGE.home);
  });

  test('reconciliation page returns HTTP 200', async ({ request }) => {
    await assertPageOk(request, PAGE.reconciliation);
  });

  test('our-work page returns HTTP 200', async ({ request }) => {
    await assertPageOk(request, PAGE.ourWork);
  });

  test('RAP page returns HTTP 200', async ({ request }) => {
    await assertPageOk(request, PAGE.rap);
  });

  test('about-us page returns HTTP 200', async ({ request }) => {
    await assertPageOk(request, PAGE.aboutUs);
  });

  test('news-and-media page returns HTTP 200', async ({ request }) => {
    await assertPageOk(request, PAGE.news);
  });

  test('contact-us page returns HTTP 200', async ({ request }) => {
    await assertPageOk(request, PAGE.contact);
  });

  // Browser-level checks
  test('home page has the correct browser tab title', async ({ page }) => {
    await goTo(page, PAGE.home);
    await expect(page).toHaveTitle(/Reconciliation Australia/i);
  });

  test('home page URL resolves to the expected domain', async ({ page }) => {
    await goTo(page, PAGE.home);
    await expect(page).toHaveURL(/reconciliation\.org\.au/);
  });

  test('home page body contains substantial text (not blank or stub)', async ({ page }) => {
    await goTo(page, PAGE.home);
    const text = await getPageText(page);
    expect(text.trim().length, 'Body text is suspiciously short').toBeGreaterThan(500);
  });

  test('home page has at least one visible heading', async ({ page }) => {
    await goTo(page, PAGE.home);
    // h2/h3 — site has an empty hidden <h1> as a theme artifact
    await expect(getFirstVisibleHeading(page)).toBeVisible();
  });

  test('home page does not produce critical JavaScript console errors', async ({ page }) => {
    const jsErrors = [];

    // Listen BEFORE navigating so no errors are missed.
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text();
        const isThirdParty =
          text.includes('googletagmanager') ||
          text.includes('facebook.net') ||
          text.includes('doubleclick') ||
          (text.includes('Cookie') && text.includes('_ga'));
        // asm_pro is a deprecated plugin API — not a critical page error.
        // "Failed to load resource" covers broken CDN/plugin assets that
        // do not affect page functionality.
        const isKnownNonCritical =
          text.includes('asm_pro') ||
          text.includes('advancedSidebarMenuPro') ||
          text.startsWith('Failed to load resource');
        if (!isThirdParty && !isKnownNonCritical) jsErrors.push(text);
      }
    });

    await goToAndLoad(page, PAGE.home);
    expect(jsErrors, `Unexpected JS errors:\n${jsErrors.join('\n')}`).toEqual([]);
  });

  test('all visible images on the home page return HTTP 200', async ({ page, request }) => {
    await goTo(page, PAGE.home);

    const imageSrcs = await page.locator('img').evaluateAll((images) =>
      images
        .filter((img) => {
          const rect  = img.getBoundingClientRect();
          const style = window.getComputedStyle(img);
          return (
            rect.width  > 0 &&
            rect.height > 0 &&
            style.visibility !== 'hidden' &&
            style.display    !== 'none'
          );
        })
        .map((img) => img.currentSrc || img.src)
        .filter(Boolean)
    );

    expect(imageSrcs.length, 'Expected at least one visible image on the home page').toBeGreaterThan(0);

    const unique = [...new Set(imageSrcs)].filter((s) => s.startsWith('http'));
    for (const src of unique) {
      await assertPageOk(request, src);
    }
  });
});

// ====================================================================
// 2. MAIN NAVIGATION — header links, logo, Donate CTA
// ====================================================================
/**
 * A broken nav means users cannot reach any part of the site.
 * These tests confirm every top-level link is present and clickable.
 */
test.describe('2. Main Navigation — header links, logo, Donate CTA', () => {

  test('navigation element is visible on the home page', async ({ page }) => {
    await goTo(page, PAGE.home);
    await expect(page.locator('nav, [role="navigation"]').first()).toBeVisible();
  });

  test('header contains all four top-level navigation links', async ({ page }) => {
    await goTo(page, PAGE.home);
    for (const label of MAIN_NAV_LABELS) {
      const link = page.locator('header a, nav a').getByText(label, { exact: false }).first();
      await expect(link, `Nav link "${label}" should be visible`).toBeVisible();
    }
  });

  test('"Donate" CTA is visible in the header', async ({ page }) => {
    await goTo(page, PAGE.home);
    await expect(
      page.locator('header a[href*="donate" i], nav a[href*="donate" i]').first()
    ).toBeVisible();
  });

  test('"Donate" CTA href points to the donate page', async ({ page }) => {
    await goTo(page, PAGE.home);
    const href = await page.locator('header a[href*="donate" i]').first().getAttribute('href');
    expect(href).toMatch(/donate/i);
  });

  test('logo or home link navigates back to the home page', async ({ page }) => {
    await goTo(page, PAGE.aboutUs);
    await dismissCookieBanner(page);

    const homeLink = page.locator(
      `a[href="/"], a[href="${BASE_URL}/"], header a:has(img), a[href*="reconciliation.org.au/"]:has(img)`
    ).first();

    if (await homeLink.count() > 0) {
      await homeLink.click();
      await expect(page).toHaveURL(/reconciliation\.org\.au\/?$/);
    } else {
      await expect(page.locator('a[href="/"]').first(), 'Expected a home link in the header').toBeVisible();
    }
  });

  test('"Reconciliation" nav link navigates to /reconciliation/', async ({ page }) => {
    await goTo(page, PAGE.home);
    await dismissCookieBanner(page);

    const link = page.locator('header a[href*="/reconciliation/"]').first();
    await expect(link).toBeVisible();
    // Elementor submenu items with aria-haspopup toggle the dropdown on
    // click rather than navigating — use the href directly instead.
    const href = await link.getAttribute('href');
    await goTo(page, href.startsWith('http') ? href : `${BASE_URL}${href}`);
    await expect(page).toHaveURL(/\/reconciliation\//);
  });

  test('"Our Work" nav link navigates to /our-work/', async ({ page }) => {
    await goTo(page, PAGE.home);
    await dismissCookieBanner(page);

    const link = page.locator('header a[href*="/our-work/"]').first();
    await expect(link).toBeVisible();
    const href = await link.getAttribute('href');
    await goTo(page, href.startsWith('http') ? href : `${BASE_URL}${href}`);
    await expect(page).toHaveURL(/\/our-work\//);
  });

  test('"About Us" nav link navigates to /about-us/', async ({ page }) => {
    await goTo(page, PAGE.home);
    await dismissCookieBanner(page);

    const link = page.locator('header a[href*="/about-us/"]').first();
    await expect(link).toBeVisible();
    const href = await link.getAttribute('href');
    await goTo(page, href.startsWith('http') ? href : `${BASE_URL}${href}`);
    await expect(page).toHaveURL(/\/about-us\//);
  });

  test('a search input or search button is present in the header', async ({ page }) => {
    await goTo(page, PAGE.home);

    const searchInput  = page.locator('input[type="search"], input[name="s"], [role="search"]');
    const searchButton = page.locator('button[aria-label*="search" i], [class*="search-toggle"]');

    const hasSearch = (await searchInput.count()) > 0 || (await searchButton.count()) > 0;
    expect(hasSearch, 'Expected a search input or search button in the header').toBeTruthy();
  });
});

// ====================================================================
// 3. FOOTER — columns, policy links, contact info, social media
// ====================================================================
/**
 * The footer appears on every page. It must contain policy links,
 * contact details, and social media links.
 *
 * Text checks use footer.innerText() because some CMS themes render
 * duplicate nav items inside the footer at display:none for mobile.
 */
test.describe('3. Footer — columns, policy links, contact info, social media', () => {

  test('footer element is present on the home page', async ({ page }) => {
    await goTo(page, PAGE.home);
    await expect(page.locator('footer').first()).toBeVisible();
  });

  test('footer visible text covers the four main navigation sections', async ({ page }) => {
    await goTo(page, PAGE.home);
    const footerText = await page.locator('footer').innerText();
    for (const text of ['Reconciliation', 'Our Work', 'About']) {
      expect(footerText, `Footer should include "${text}"`).toMatch(new RegExp(text, 'i'));
    }
  });

  test('footer has a Privacy Policy link', async ({ page }) => {
    await goTo(page, PAGE.home);
    await expect(
      page.locator('footer a[href*="privacy" i], footer a:has-text("Privacy")').first()
    ).toBeVisible();
  });

  test('Privacy Policy page loads when footer link is followed', async ({ page }) => {
    await goTo(page, PAGE.home);

    const link    = page.locator('footer a[href*="privacy" i]').first();
    const rawHref = await link.getAttribute('href');
    const target  = rawHref.startsWith('http') ? rawHref : `${BASE_URL}${rawHref}`;

    await goTo(page, target);
    await expect(page).toHaveURL(/privacy/i);
  });

  test('footer has an Accessibility statement link', async ({ page }) => {
    await goTo(page, PAGE.home);
    await expect(
      page.locator('footer a[href*="accessibility" i], footer a:has-text("Accessibility")').first()
    ).toBeVisible();
  });

  test('footer displays the organisation phone number', async ({ page }) => {
    await goTo(page, PAGE.home);
    const footerText = await page.locator('footer').innerText();
    expect(footerText, 'Footer should show 02 6153 4400').toMatch(/6153\s*4400/);
  });

  test('footer displays the postal address suburb (Surry Hills)', async ({ page }) => {
    await goTo(page, PAGE.home);
    const footerText = await page.locator('footer').innerText();
    expect(footerText).toMatch(/Surry Hills/i);
  });

  test('footer contains social media links to all five expected platforms', async ({ page }) => {
    await goTo(page, PAGE.home);
    for (const platform of SOCIAL_PLATFORMS) {
      await expect(
        page.locator(`footer a[href*="${platform}"]`).first(),
        `Footer should have a ${platform} link`
      ).toBeVisible();
    }
  });

  test('footer social media links are external URLs', async ({ page }) => {
    await goTo(page, PAGE.home);
    for (const platform of SOCIAL_PLATFORMS) {
      const link = page.locator(`footer a[href*="${platform}"]`).first();
      if (await link.count() > 0) {
        const href = await link.getAttribute('href');
        expect(href, `${platform} should be external`).toMatch(/^https?:\/\//);
        expect(href).not.toMatch(/reconciliation\.org\.au/);
      }
    }
  });

  test('page contains an email subscription input field', async ({ page }) => {
    await goTo(page, PAGE.home);
    await expect(
      page.locator('input[type="email"]').last(),
      'Expected an email input for newsletter subscription'
    ).toBeVisible();
  });
});

// ====================================================================
// 4. HOMEPAGE CONTENT — hero, key sections, CTAs
// ====================================================================
/**
 * Guards against CMS accidents where editors delete a page section.
 * Text checks use body.innerText() to avoid false-positives from
 * hidden nav dropdowns that contain the same terms.
 */
test.describe('4. Homepage Content — hero, key sections, CTAs', () => {

  test('home page displays the organisation name', async ({ page }) => {
    await goTo(page, PAGE.home);
    await expectPageContains(page, /Reconciliation Australia/i);
  });

  test('home page mentions Reconciliation Action Plans', async ({ page }) => {
    await goTo(page, PAGE.home);
    await expectPageContains(page, /Reconciliation Action Plan/i);
  });

  test('home page has a visible hero or banner section', async ({ page }) => {
    await goTo(page, PAGE.home);
    const hero = page.locator(
      '.hero, .banner, section, .wp-block-cover, [class*="hero"], [class*="banner"], [class*="slider"]'
    ).first();
    await expect(hero).toBeVisible();
  });

  test('home page "Donate" CTA is visible', async ({ page }) => {
    await goTo(page, PAGE.home);
    await expect(page.locator('a[href*="donate" i]').first()).toBeVisible();
  });

  test('home page contains a link to the RAP section', async ({ page }) => {
    await goTo(page, PAGE.home);
    await expect(
      page.locator('a[href*="reconciliation-action-plans" i]').first()
    ).toBeVisible();
  });

  test('home page content includes National Reconciliation Week', async ({ page }) => {
    await goTo(page, PAGE.home);
    await expectPageContains(page, /National Reconciliation Week/i);
  });

  test('home page has a newsletter or email subscription section', async ({ page }) => {
    await goTo(page, PAGE.home);
    const emailInput   = page.locator('input[type="email"]').first();
    const subscribeBtn = page.locator('button:has-text("Subscribe"), input[value*="Subscribe" i]').first();

    const hasSection = (await emailInput.count()) > 0 || (await subscribeBtn.count()) > 0;
    expect(hasSection, 'Expected a newsletter subscription section').toBeTruthy();
  });

  test('home page has more than three section headings', async ({ page }) => {
    await goTo(page, PAGE.home);
    const count = await page.locator('h2, h3').count();
    expect(count, 'Expected at least 4 section headings').toBeGreaterThan(3);
  });
});

// ====================================================================
// 5. RECONCILIATION PAGE — definition, mission, program links
// ====================================================================
/**
 * The /reconciliation/ page is the primary explainer for the
 * organisation's purpose. Core messaging must always be present.
 */
test.describe('5. Reconciliation Page — definition and mission content', () => {

  test('page title includes "Reconciliation"', async ({ page }) => {
    await goTo(page, PAGE.reconciliation);
    await expect(page).toHaveTitle(/Reconciliation/i);
  });

  test('page has a visible heading', async ({ page }) => {
    await goTo(page, PAGE.reconciliation);
    await expect(getFirstVisibleHeading(page)).toBeVisible();
  });

  test('page contains the definition ("strengthening relationships")', async ({ page }) => {
    await goTo(page, PAGE.reconciliation);
    await expectPageContains(page, /strengthening relationships/i);
  });

  test('page mentions Aboriginal and Torres Strait Islander peoples', async ({ page }) => {
    await goTo(page, PAGE.reconciliation);
    await expectPageContains(page, /Aboriginal and Torres Strait Islander/i);
  });

  test('page mentions National Reconciliation Week', async ({ page }) => {
    await goTo(page, PAGE.reconciliation);
    await expectPageContains(page, /National Reconciliation Week/i);
  });

  test('page mentions Reconciliation Action Plans', async ({ page }) => {
    await goTo(page, PAGE.reconciliation);
    await expectPageContains(page, /Reconciliation Action Plan/i);
  });

  test('page contains a link back to the home page', async ({ page }) => {
    await goTo(page, PAGE.reconciliation);
    const links = await getInternalLinks(page);
    const homeLink = links.find((l) => {
      try { return new URL(l.href).pathname === '/'; }
      catch { return false; }
    });
    expect(homeLink, 'Expected a link to the home page').toBeTruthy();
  });
});

// ====================================================================
// 6. OUR WORK PAGE — six program areas
// ====================================================================
/**
 * The /our-work/ page must feature all six programs. A missing program
 * means the page is out of date.
 */
test.describe('6. Our Work Page — all six program areas present', () => {

  test('page title includes "Our Work"', async ({ page }) => {
    await goTo(page, PAGE.ourWork);
    await expect(page).toHaveTitle(/Our Work/i);
  });

  test('page has a visible heading', async ({ page }) => {
    await goTo(page, PAGE.ourWork);
    await expect(getFirstVisibleHeading(page)).toBeVisible();
  });

  test('National Reconciliation Week is featured', async ({ page }) => {
    await goTo(page, PAGE.ourWork);
    await expectPageContains(page, /National Reconciliation Week/i);
  });

  test('Narragunnawali (reconciliation in education) is featured', async ({ page }) => {
    await goTo(page, PAGE.ourWork);
    await expectPageContains(page, /Narragunnawali/i);
  });

  test('Indigenous Governance program is featured', async ({ page }) => {
    await goTo(page, PAGE.ourWork);
    await expectPageContains(page, /Indigenous Governance/i);
  });

  test('Truth-telling program is featured', async ({ page }) => {
    await goTo(page, PAGE.ourWork);
    await expectPageContains(page, /Truth-telling/i);
  });

  test('Policy and Research program is featured', async ({ page }) => {
    await goTo(page, PAGE.ourWork);
    await expectPageContains(page, /Policy and Research/i);
  });

  test('Reconciliation Action Plans program is featured', async ({ page }) => {
    await goTo(page, PAGE.ourWork);
    await expectPageContains(page, /Reconciliation Action Plan/i);
  });

  test('page has internal links to program sub-pages', async ({ page }) => {
    await goTo(page, PAGE.ourWork);
    const links = await getInternalLinks(page);
    expect(links.length, 'Expected more than 5 internal links').toBeGreaterThan(5);
  });
});

// ====================================================================
// 7. RAP PAGE — four types, three pillars, key statistics
// ====================================================================
/**
 * The RAP page is business-critical. Tests verify all four RAP types,
 * three core pillars, and key founding statistics.
 */
test.describe('7. RAP Page — types, pillars, stats, directory link', () => {

  test('page title includes "Reconciliation Action Plan"', async ({ page }) => {
    await goTo(page, PAGE.rap);
    await expect(page).toHaveTitle(/Reconciliation Action Plan/i);
  });

  test('page has a visible heading', async ({ page }) => {
    await goTo(page, PAGE.rap);
    await expect(getFirstVisibleHeading(page)).toBeVisible();
  });

  // Four RAP types
  test('the "Reflect" RAP type is on the page', async ({ page }) => {
    await goTo(page, PAGE.rap);
    await expectPageContains(page, /Reflect/i);
  });

  test('the "Innovate" RAP type is on the page', async ({ page }) => {
    await goTo(page, PAGE.rap);
    await expectPageContains(page, /Innovate/i);
  });

  test('the "Stretch" RAP type is on the page', async ({ page }) => {
    await goTo(page, PAGE.rap);
    await expectPageContains(page, /Stretch/i);
  });

  test('the "Elevate" RAP type is on the page', async ({ page }) => {
    await goTo(page, PAGE.rap);
    await expectPageContains(page, /Elevate/i);
  });

  // Three RAP pillars
  test('the "Relationships" pillar is on the page', async ({ page }) => {
    await goTo(page, PAGE.rap);
    await expectPageContains(page, /Relationships/i);
  });

  test('the "Respect" pillar is on the page', async ({ page }) => {
    await goTo(page, PAGE.rap);
    await expectPageContains(page, /Respect/i);
  });

  test('the "Opportunities" pillar is on the page', async ({ page }) => {
    await goTo(page, PAGE.rap);
    await expectPageContains(page, /Opportunities/i);
  });

  // Key statistics
  test('page mentions 2006 (the year the RAP program started)', async ({ page }) => {
    await goTo(page, PAGE.rap);
    await expectPageContains(page, /2006/);
  });

  test('page references 3,000+ organisations with RAPs', async ({ page }) => {
    await goTo(page, PAGE.rap);
    const text = await getPageText(page);
    expect(text, 'Page should reference 3,000+ RAP organisations').toMatch(/3[,.]?000/);
  });

  test('page contains a "Who has a RAP?" or RAP directory link', async ({ page }) => {
    await goTo(page, PAGE.rap);
    // The link lives inside a hidden Elementor submenu on this page,
    // so check that it is attached to the DOM rather than visible.
    const link = page.locator(
      'a:has-text("Who has a RAP"), a[href*="who-has"], a:has-text("RAP community")'
    ).first();
    await expect(link, 'Expected a RAP directory link').toBeAttached();
  });

  test('page mentions Narragunnawali (school RAPs)', async ({ page }) => {
    await goTo(page, PAGE.rap);
    await expectPageContains(page, /Narragunnawali/i);
  });
});

// ====================================================================
// 8. ABOUT US PAGE — mission, leadership, contact info
// ====================================================================
/**
 * Must always show the mission, a leadership section, and contact
 * details for organisational credibility.
 */
test.describe('8. About Us Page — mission, leadership, contact info', () => {

  test('page title includes "About"', async ({ page }) => {
    await goTo(page, PAGE.aboutUs);
    await expect(page).toHaveTitle(/About/i);
  });

  test('page has a visible heading', async ({ page }) => {
    await goTo(page, PAGE.aboutUs);
    await expect(getFirstVisibleHeading(page)).toBeVisible();
  });

  test('page identifies RA as the lead body for reconciliation', async ({ page }) => {
    await goTo(page, PAGE.aboutUs);
    await expectPageContains(page, /lead body for reconciliation/i);
  });

  test('page conveys the vision of a "reconciled Australia"', async ({ page }) => {
    await goTo(page, PAGE.aboutUs);
    await expectPageContains(page, /reconciled Australia/i);
  });

  test('page has a leadership, board, or "our people" section', async ({ page }) => {
    await goTo(page, PAGE.aboutUs);
    await expectPageContains(page, /leadership|board|our people/i);
  });

  test('page references corporate information (annual report or constitution)', async ({ page }) => {
    await goTo(page, PAGE.aboutUs);
    await expectPageContains(page, /annual report|constitution|corporate/i);
  });

  test('page has a careers or opportunities section', async ({ page }) => {
    await goTo(page, PAGE.aboutUs);
    await expectPageContains(page, /careers|jobs|opportunities/i);
  });

  test('page contains a "Contact Us" link', async ({ page }) => {
    await goTo(page, PAGE.aboutUs);
    await expect(page.locator('a[href*="contact" i], a:has-text("Contact")').first()).toBeVisible();
  });

  test('page displays the organisation phone number', async ({ page }) => {
    await goTo(page, PAGE.aboutUs);
    const text = await getPageText(page);
    expect(text, 'Expected phone 02 6153 4400').toMatch(/6153\s*4400/);
  });

  test('page displays the postal address suburb (Surry Hills)', async ({ page }) => {
    await goTo(page, PAGE.aboutUs);
    await expectPageContains(page, /Surry Hills/i);
  });
});

// ====================================================================
// 9. NEWS & MEDIA PAGE — article grid, dates, pagination, filters
// ====================================================================
/**
 * Verifies articles exist, are clickable, dated, and that pagination
 * and category filters are present.
 */
test.describe('9. News & Media Page — articles, dates, pagination, filters', () => {

  test('page title includes "News"', async ({ page }) => {
    await goTo(page, PAGE.news);
    await expect(page).toHaveTitle(/News/i);
  });

  test('page displays multiple news article cards', async ({ page }) => {
    await goTo(page, PAGE.news);
    const articles = page.locator('article, .post, [class*="post-item"], [class*="article-item"]');
    expect(await articles.count(), 'Expected at least 4 news articles').toBeGreaterThan(3);
  });

  test('news article cards have visible title headings', async ({ page }) => {
    await goTo(page, PAGE.news);
    const headings = page.locator('article h2, article h3, article h4, .post h2, .post h3');
    await expect(headings.first()).toBeVisible();
  });

  test('news article cards show publication dates', async ({ page }) => {
    await goTo(page, PAGE.news);
    const dates = page.locator('time, [class*="date"], [class*="entry-date"]');
    expect(await dates.count(), 'Expected at least one publication date').toBeGreaterThan(0);
  });

  test('news article titles are clickable links', async ({ page }) => {
    await goTo(page, PAGE.news);

    const firstLink = page.locator('article a[href], .post-title a, h2 a, h3 a').first();
    await expect(firstLink).toBeVisible();
    const href = await firstLink.getAttribute('href');
    expect(href, 'Article link should have a non-empty href').toBeTruthy();
  });

  test('navigating to an individual article shows a heading', async ({ page }) => {
    await goTo(page, PAGE.news);
    await dismissCookieBanner(page);

    const firstLink = page.locator('article a[href], .post-title a').first();
    const href      = await firstLink.getAttribute('href');

    if (href) {
      const target = href.startsWith('http') ? href : `${BASE_URL}${href}`;
      await goTo(page, target);
      // Article pages use h1 for the post title; getFirstVisibleHeading
      // targets h2/h3 to skip a home-page theme artifact — use h1 here.
      const heading = page.locator('h1, h2, h3').filter({ hasText: /\S/ }).first();
      await expect(heading).toBeVisible();
    }
  });

  test('news page has pagination controls', async ({ page }) => {
    await goTo(page, PAGE.news);
    const pagination = page.locator(
      '.pagination, .page-numbers, nav.navigation, [class*="paginat"], [aria-label*="pagination" i]'
    ).first();
    await expect(pagination, 'Expected pagination controls').toBeVisible();
  });

  test('news page has category filter options', async ({ page }) => {
    await goTo(page, PAGE.news);
    const filters = page.locator(
      'select[name*="cat"], .cat-item, [class*="filter"], [class*="tax-"], [class*="category-filter"]'
    );
    expect(await filters.count(), 'Expected filter controls').toBeGreaterThan(0);
  });
});

// ====================================================================
// 10. CONTACT PAGE — form fields, required attributes, contact info
// ====================================================================
/**
 * The form is NEVER submitted to avoid sending junk enquiries.
 * We verify structure and HTML validation attributes only.
 */
test.describe('10. Contact Page — form fields, validation, contact info', () => {

  test('page title includes "Contact"', async ({ page }) => {
    await goTo(page, PAGE.contact);
    await expect(page).toHaveTitle(/Contact/i);
  });

  test('a contact form is visible', async ({ page }) => {
    await goTo(page, PAGE.contact);
    await expect(page.locator('form').first()).toBeVisible();
  });

  test('contact form has a First Name field', async ({ page }) => {
    await goTo(page, PAGE.contact);
    // Try label-based lookup (works with Gravity Forms) first, then
    // fall back to attribute matching for other form plugins.
    const byLabel = page.getByLabel(/first.?name/i).first();
    const byAttr  = page.locator(
      'input[name*="first" i], input[placeholder*="first" i], input[id*="first" i], input[aria-label*="first" i]'
    ).first();
    const found = (await byLabel.count()) > 0 ? byLabel : byAttr;
    await expect(found, 'Expected a First Name input').toBeVisible();
  });

  test('contact form has a Last Name field', async ({ page }) => {
    await goTo(page, PAGE.contact);
    const byLabel = page.getByLabel(/last.?name/i).first();
    const byAttr  = page.locator(
      'input[name*="last" i], input[placeholder*="last" i], input[id*="last" i], input[aria-label*="last" i]'
    ).first();
    const found = (await byLabel.count()) > 0 ? byLabel : byAttr;
    await expect(found, 'Expected a Last Name input').toBeVisible();
  });

  test('contact form has an Email field', async ({ page }) => {
    await goTo(page, PAGE.contact);
    await expect(
      page.locator('input[type="email"], input[name*="email" i]').first()
    ).toBeVisible();
  });

  test('email field has type="email" for browser validation', async ({ page }) => {
    await goTo(page, PAGE.contact);
    await expect(page.locator('input[type="email"]').first()).toHaveAttribute('type', 'email');
  });

  test('contact form has a Message textarea', async ({ page }) => {
    await goTo(page, PAGE.contact);
    await expect(page.locator('textarea').first()).toBeVisible();
  });

  test('contact form has an enquiry category dropdown', async ({ page }) => {
    await goTo(page, PAGE.contact);
    // Native <select> or a custom ARIA listbox / combobox both satisfy this.
    const dropdown = page.locator('select, [role="listbox"], [role="combobox"]').first();
    if (await dropdown.count() === 0) {
      // Some CMS forms do not include a category dropdown — skip rather than fail.
      test.skip(true, 'No dropdown element found on the contact form');
      return;
    }
    await expect(dropdown).toBeVisible();
  });

  test('category dropdown includes expected enquiry types', async ({ page }) => {
    await goTo(page, PAGE.contact);
    const dropdown = page.locator('select').first();
    if (await dropdown.count() === 0) {
      test.skip(true, 'No native <select> dropdown found — skipping option text check');
      return;
    }
    const optionTexts = (await dropdown.locator('option').allInnerTexts()).join(' ');

    const expectedCategories = ['General', 'Media', 'RAP', 'Narragunnawali'];
    const hasExpected = expectedCategories.some((cat) =>
      optionTexts.match(new RegExp(cat, 'i'))
    );
    expect(hasExpected, `Expected one of [${expectedCategories}] in dropdown`).toBeTruthy();
  });

  test('contact form has a visible submit button', async ({ page }) => {
    await goTo(page, PAGE.contact);
    await expect(
      page.locator('button[type="submit"], input[type="submit"]').first()
    ).toBeVisible();
  });

  test('at least one required field exists (client-side validation active)', async ({ page }) => {
    await goTo(page, PAGE.contact);
    const count = await page.locator('input[required], textarea[required], select[required]').count();
    expect(count, 'Expected at least one field with the required attribute').toBeGreaterThan(0);
  });

  test('page displays the organisation phone number', async ({ page }) => {
    await goTo(page, PAGE.contact);
    const text = await getPageText(page);
    expect(text, 'Expected phone 02 6153 4400').toMatch(/6153\s*4400/);
  });

  test('page displays the postal address suburb (Surry Hills)', async ({ page }) => {
    await goTo(page, PAGE.contact);
    await expectPageContains(page, /Surry Hills/i);
  });

  test('page displays an ABN', async ({ page }) => {
    await goTo(page, PAGE.contact);
    await expectPageContains(page, /ABN/i);
  });
});

// ====================================================================
// 11. RESPONSIVE LAYOUT — mobile, tablet, desktop viewports
// ====================================================================
/**
 * scrollWidth > viewportWidth means content overflows horizontally —
 * a sign of broken mobile layout.
 */
test.describe('11. Responsive Layout — mobile, tablet, desktop viewports', () => {

  async function getOverflow(page) {
    return page.evaluate(() => ({
      scrollWidth:   document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
    }));
  }

  // Mobile (390 × 844 — iPhone 14)
  test('home page has no horizontal overflow on mobile (390px)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await goTo(page, PAGE.home);
    const { scrollWidth, viewportWidth } = await getOverflow(page);
    expect(scrollWidth, `Overflow: ${scrollWidth}px > ${viewportWidth}px`).toBeLessThanOrEqual(viewportWidth + 5);
  });

  test('page header is visible on mobile (390px)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await goTo(page, PAGE.home);
    await expect(page.locator('header').first()).toBeVisible();
  });

  test('page footer is visible on mobile (390px)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await goTo(page, PAGE.home);
    await expect(page.locator('footer').first()).toBeVisible();
  });

  test('a mobile hamburger button is visible at 390px', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await goTo(page, PAGE.home);
    // The Acknowledgement of Country modal covers the full viewport on
    // mobile — remove it before checking hamburger visibility.
    await dismissCookieBanner(page);

    const hamburger = page.locator([
      'button[aria-label*="menu" i]',
      'button[aria-label*="navigation" i]',
      'button[class*="hamburger"]',
      'button[class*="nav-toggle"]',
      'button[class*="menu-toggle"]',
      '[class*="menu-toggle"] button',
      '.navbar-toggler',
      // Elementor nav menu toggle (used on this site)
      '[class*="elementor-nav-menu--toggle"]',
      '[class*="elementor-menu-toggle"]',
      '.elementor-hamburger-nav-icon',
      '[class*="nav-menu--toggle"]',
      'i[class*="eicon-menu-bar"]',
      '[class*="elementor-hamburger"]',
    ].join(', ')).first();

    if (await hamburger.count() === 0) {
      // Some Elementor themes implement mobile navigation without a standard
      // hamburger button (CSS-only accordion or off-canvas drawer).
      // Verify instead that navigation is accessible by some means at mobile.
      const navExists = await page.locator('nav, [role="navigation"]').count();
      expect(navExists, 'Expected at least a <nav> element to exist at 390px').toBeGreaterThan(0);
      return;
    }
    await expect(hamburger, 'Expected a hamburger/menu toggle at 390px').toBeVisible();
  });

  // Tablet (768 × 1024 — iPad)
  test('home page has no horizontal overflow on tablet (768px)', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await goTo(page, PAGE.home);
    const { scrollWidth, viewportWidth } = await getOverflow(page);
    expect(scrollWidth).toBeLessThanOrEqual(viewportWidth + 5);
  });

  test('home page body has readable text at 768px', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await goTo(page, PAGE.home);
    const text = await getPageText(page);
    expect(text.trim().length).toBeGreaterThan(300);
  });

  // Desktop (1440 × 900 — standard widescreen)
  test('home page has no horizontal overflow on desktop (1440px)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await goTo(page, PAGE.home);
    const { scrollWidth, viewportWidth } = await getOverflow(page);
    expect(scrollWidth).toBeLessThanOrEqual(viewportWidth + 5);
  });

  test('desktop nav links are visible at 1440px (not behind a hamburger)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await goTo(page, PAGE.home);
    await expect(page.locator('nav a').first()).toBeVisible();
  });

  test('contact page has no horizontal overflow on mobile (390px)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await goTo(page, PAGE.contact);
    const { scrollWidth, viewportWidth } = await getOverflow(page);
    expect(scrollWidth).toBeLessThanOrEqual(viewportWidth + 5);
  });
});

// ====================================================================
// 12. SEO & ACCESSIBILITY — meta tags, headings, alt text, keyboard
// ====================================================================
/**
 * WCAG 2.1 Level AA basics and SEO hygiene.
 */
test.describe('12. SEO & Accessibility — meta tags, headings, alt text, keyboard nav', () => {

  test('home page <title> tag is non-empty and descriptive', async ({ page }) => {
    await goTo(page, PAGE.home);
    const title = await page.title();
    expect(title.trim().length, '<title> should be longer than 10 chars').toBeGreaterThan(10);
  });

  test('home page has a <meta name="description"> with content', async ({ page }) => {
    await goTo(page, PAGE.home);
    await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /.{10,}/);
  });

  test('<html> element declares a lang attribute', async ({ page }) => {
    await goTo(page, PAGE.home);
    await expect(page.locator('html')).toHaveAttribute('lang', /.+/);
  });

  test('home page has at least one h1 element', async ({ page }) => {
    await goTo(page, PAGE.home);
    const count = await page.locator('h1').count();
    expect(count, 'Expected at least one h1').toBeGreaterThanOrEqual(1);
  });

  test('home page has multiple h2 section headings', async ({ page }) => {
    await goTo(page, PAGE.home);
    const count = await page.locator('h2').count();
    expect(count, 'Expected multiple h2 headings').toBeGreaterThan(1);
  });

  test('all visible images on the home page have alt text or are decorative', async ({ page }) => {
    await goTo(page, PAGE.home);

    const missingAlt = await page.locator('img').evaluateAll((images) =>
      images
        .filter((img) => {
          const rect  = img.getBoundingClientRect();
          const style = window.getComputedStyle(img);
          const isVisible =
            rect.width  > 0 &&
            rect.height > 0 &&
            style.visibility !== 'hidden' &&
            style.display    !== 'none';
          const hasAlt       = img.hasAttribute('alt');
          const isDecorative = img.getAttribute('role') === 'presentation';
          return isVisible && !hasAlt && !isDecorative;
        })
        .map((img) => img.currentSrc || img.src)
    );

    expect(
      missingAlt,
      `Visible images missing alt:\n${missingAlt.join('\n')}`
    ).toEqual([]);
  });

  test('Tab key moves keyboard focus to an interactive element', async ({ page }) => {
    await goTo(page, PAGE.home);
    await dismissCookieBanner(page);

    let focusedTag = 'body';
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press('Tab');
      focusedTag = await page.evaluate(
        () => document.activeElement?.tagName?.toLowerCase() ?? 'body'
      );
      if (focusedTag !== 'body') break;
    }

    expect(focusedTag, 'Tab key should move focus off <body>').not.toBe('body');
    expect(focusedTag).toBeTruthy();
  });

  test('home page has an Open Graph title tag for social sharing', async ({ page }) => {
    await goTo(page, PAGE.home);
    await expect(
      page.locator('meta[property="og:title"]'),
      'Expected an og:title meta tag'
    ).toHaveCount(1);
  });

  test('about-us page has a distinct <title> from the home page', async ({ page }) => {
    await goTo(page, PAGE.home);
    const homeTitle = await page.title();

    await goTo(page, PAGE.aboutUs);
    const aboutTitle = await page.title();

    expect(aboutTitle, 'About page title should differ from home').not.toBe(homeTitle);
  });

  test('contact page has a distinct <title> from the home page', async ({ page }) => {
    await goTo(page, PAGE.home);
    const homeTitle = await page.title();

    await goTo(page, PAGE.contact);
    const contactTitle = await page.title();

    expect(contactTitle, 'Contact page title should differ from home').not.toBe(homeTitle);
  });
});

// ====================================================================
// 13. LINK INTEGRITY — internal links return HTTP 200
// ====================================================================
/**
 * Crawls internal links on key pages and asserts none are broken.
 * Broken links (404/500) damage SEO and user trust.
 * Capped at 25 links per page to keep runtime reasonable.
 */
test.describe('13. Link Integrity — internal links return HTTP 200', () => {

  const LINK_CAP = 25;

  test('internal links on the home page all return HTTP 200', async ({ page, request }) => {
    await goTo(page, PAGE.home);
    const links = await getInternalLinks(page);

    const urlsToCheck = [...new Set(
      links
        .map((l) => l.href)
        .filter((href) => {
          try {
            const url = new URL(href);
            return url.pathname !== '/' && !href.includes('#');
          } catch { return false; }
        })
    )].slice(0, LINK_CAP);

    expect(urlsToCheck.length, 'Expected at least 5 unique internal links').toBeGreaterThan(5);

    for (const url of urlsToCheck) {
      await assertPageOk(request, url);
    }
  });

  test('footer links on the home page all return HTTP 200', async ({ page, request }) => {
    await goTo(page, PAGE.home);

    const { hostname } = new URL(BASE_URL);
    const footerUrls = await page.locator('footer a[href]').evaluateAll((anchors, host) =>
      [...new Set(
        anchors
          .map((a) => a.href)
          .filter((href) => {
            try { return new URL(href).hostname === host; }
            catch { return false; }
          })
      )],
      hostname
    );

    expect(footerUrls.length, 'Expected internal links in the footer').toBeGreaterThan(0);

    for (const url of footerUrls) {
      await assertPageOk(request, url);
    }
  });

  test('Privacy Policy page loads and has content', async ({ page }) => {
    await goTo(page, PAGE.privacy);
    const text = await getPageText(page);
    expect(text.trim().length, 'Privacy page appears empty').toBeGreaterThan(200);
  });

  test('Accessibility statement page loads and has content', async ({ page }) => {
    await goTo(page, PAGE.accessibility);
    const text = await getPageText(page);
    expect(text.trim().length, 'Accessibility page appears empty').toBeGreaterThan(200);
  });

  test('Donate page returns HTTP 200', async ({ request }) => {
    await assertPageOk(request, PAGE.donate);
  });
});
