const { test, expect } = require('@playwright/test');

// Website under test.
// Keeping this in one place makes it easy to change later.
const HOME_PAGE = 'https://infonyx.com.au/';

// Common words that usually identify important business pages.
const IMPORTANT_PAGE_WORDS = [
  'about',
  'service',
  'services',
  'solution',
  'solutions',
  'career',
  'careers',
  'contact',
];

// Helper: open the home page and wait until the browser has finished loading.
async function openHomePage(page) {
  await page.goto(HOME_PAGE, { waitUntil: 'domcontentloaded' });
}

// Helper: get all visible links that belong to the Infonyx website.
async function getInternalLinks(page) {
  const homeUrl = new URL(HOME_PAGE);

  return page.locator('a[href]').evaluateAll((links, hostName) => {
    return links
      .map((link) => {
        return {
          text: link.innerText.trim(),
          href: link.href,
        };
      })
      .filter((link) => {
        try {
          const url = new URL(link.href);
          return url.hostname === hostName;
        } catch {
          return false;
        }
      });
  }, homeUrl.hostname);
}

test.describe('Infonyx smoke tests', () => {
  test('home page should load successfully and show the Infonyx brand', async ({ page }) => {
    await openHomePage(page);

    // Check that the page really opened.
    await expect(page).toHaveURL(/infonyx\.com\.au/);

    // Check that the browser tab has a useful title.
    await expect(page).toHaveTitle(/infonyx/i);

    // Check that visible text on the page includes the company name.
    await expect(page.getByText(/infonyx/i).first()).toBeVisible();
  });

  test('home page should have useful main content', async ({ page }) => {
    await openHomePage(page);

    // A user should see headings or meaningful text after the page loads.
    const headings = page.locator('h1, h2, h3');
    await expect(headings.first()).toBeVisible();
    await expect(headings).not.toHaveCount(0);

    // The page should not be almost empty.
    const pageText = await page.locator('body').innerText();
    expect(pageText.trim().length).toBeGreaterThan(300);
  });

  test('important images should load correctly', async ({ page, request }) => {
    await openHomePage(page);

    const visibleImageUrls = await page.locator('img').evaluateAll((images) => {
      return images
        .filter((image) => {
          const styles = window.getComputedStyle(image);
          const imageSize = image.getBoundingClientRect();
          const isVisible =
            image.offsetParent !== null &&
            imageSize.width > 0 &&
            imageSize.height > 0 &&
            styles.visibility !== 'hidden' &&
            styles.display !== 'none';

          return isVisible;
        })
        .map((image) => image.currentSrc || image.src)
        .filter(Boolean);
    });

    expect(visibleImageUrls.length).toBeGreaterThan(0);

    const httpImageUrls = [...new Set(visibleImageUrls)].filter(
      (url) => url.startsWith('http://') || url.startsWith('https://')
    );

    expect(httpImageUrls.length).toBeGreaterThan(0);

    for (const imageUrl of httpImageUrls) {
      const response = await request.get(imageUrl);
      expect(response.ok(), `${imageUrl} returned status ${response.status()}`).toBeTruthy();
    }
  });

  test('page should not show critical JavaScript console errors', async ({ page }) => {
    const consoleErrors = [];

    page.on('console', (message) => {
      const text = message.text();

      // Firefox reports analytics cookie-domain warnings as console errors.
      // They are not critical JavaScript failures for this smoke test.
      const isAnalyticsCookieWarning =
        text.includes('Cookie') &&
        text.includes('has been rejected') &&
        text.includes('_ga');

      if (message.type() === 'error' && !isAnalyticsCookieWarning) {
        consoleErrors.push(text);
      }
    });

    await openHomePage(page);
    await page.waitForLoadState('networkidle');

    expect(consoleErrors, `Console errors: ${consoleErrors.join('\n')}`).toEqual([]);
  });
});

test.describe('Infonyx navigation sanity tests', () => {
  test('navigation links should be visible and usable', async ({ page }) => {
    await openHomePage(page);

    const visibleLinks = page.locator('a[href]:visible');
    await expect(visibleLinks.first()).toBeVisible();
    expect(await visibleLinks.count()).toBeGreaterThan(3);
  });

  test('important internal pages should return successful responses', async ({ page, request }) => {
    await openHomePage(page);

    const internalLinks = await getInternalLinks(page);
    const importantLinks = internalLinks
      .filter((link) => {
        const linkValue = `${link.text} ${link.href}`.toLowerCase();
        return IMPORTANT_PAGE_WORDS.some((word) => linkValue.includes(word));
      })
      .map((link) => link.href);

    // Remove duplicates and test only the first few links so the test stays fast.
    const uniqueLinks = [...new Set(importantLinks)].slice(0, 8);

    expect(uniqueLinks.length).toBeGreaterThan(0);

    for (const url of uniqueLinks) {
      const response = await request.get(url);
      expect(response.ok(), `${url} returned status ${response.status()}`).toBeTruthy();
    }
  });

  test('logo or home link should take the user back to the home page', async ({ page }) => {
    await openHomePage(page);

    const internalLinks = await getInternalLinks(page);
    const homeLink = internalLinks.find((link) => {
      const url = new URL(link.href);
      return url.pathname === '/' || link.text.toLowerCase().includes('infonyx');
    });

    expect(homeLink, 'Expected a logo or home link on the page').toBeTruthy();

    await page.goto(homeLink.href);
    await expect(page).toHaveURL(/infonyx\.com\.au/);
  });
});

test.describe('Infonyx contact sanity tests', () => {
  test('site should provide a contact path for visitors', async ({ page }) => {
    await openHomePage(page);

    const contactLink = page.locator('a[href*="contact" i], a:has-text("Contact")').first();
    const emailLink = page.locator('a[href^="mailto:"]').first();
    const phoneLink = page.locator('a[href^="tel:"]').first();

    const hasContactLink = await contactLink.count();
    const hasEmailLink = await emailLink.count();
    const hasPhoneLink = await phoneLink.count();

    expect(
      hasContactLink + hasEmailLink + hasPhoneLink,
      'Expected a contact page link, email link, or phone link'
    ).toBeGreaterThan(0);
  });

  test('contact page or contact area should contain a way to submit or reach out', async ({ page }) => {
    await openHomePage(page);

    const contactLink = page.locator('a[href*="contact" i], a:has-text("Contact")').first();

    if (await contactLink.count()) {
      // Some websites keep duplicate menu links for desktop/mobile.
      // Reading the href and going there directly avoids clicking a hidden copy.
      const contactUrl = await contactLink.getAttribute('href');
      await page.goto(contactUrl);
      await page.waitForLoadState('domcontentloaded');
    }

    const formFields = page.locator('input, textarea, select');
    const emailLink = page.locator('a[href^="mailto:"]');
    const phoneLink = page.locator('a[href^="tel:"]');

    
    const contactOptions =
      (await formFields.count()) + (await emailLink.count()) + (await phoneLink.count());

    expect(
      contactOptions,
      'Expected a form field, email link, or phone link for contacting the company'
    ).toBeGreaterThan(0);
  });
});

test.describe('Infonyx responsive sanity tests', () => {
  test('home page should render on mobile size', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openHomePage(page);

    await expect(page.getByText(/infonyx/i).first()).toBeVisible();

    // This catches many common mobile layout problems.
    const pageWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const viewportWidth = await page.evaluate(() => window.innerWidth);
    expect(pageWidth).toBeLessThanOrEqual(viewportWidth + 10);
  });

  test('home page should render on desktop size', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openHomePage(page);

    await expect(page.getByText(/infonyx/i).first()).toBeVisible();

    const pageWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const viewportWidth = await page.evaluate(() => window.innerWidth);
    expect(pageWidth).toBeLessThanOrEqual(viewportWidth + 10);
  });
});

test.describe('Infonyx SEO and accessibility sanity tests', () => {
  test('home page should have basic SEO tags', async ({ page }) => {
    await openHomePage(page);

    const title = await page.title();
    const metaDescription = page.locator('meta[name="description"]').first();

    expect(title.trim().length).toBeGreaterThan(5);
    await expect(metaDescription).toHaveAttribute('content', /.+/);
  });

  test('html tag should declare a language', async ({ page }) => {
    await openHomePage(page);

    await expect(page.locator('html')).toHaveAttribute('lang', /.+/);
  });

  test('images should have alt text or be marked as decorative', async ({ page }) => {
    await openHomePage(page);

    const visibleImagesMissingAlt = await page.locator('img').evaluateAll((images) => {
      return images
        .filter((image) => {
          const styles = window.getComputedStyle(image);
          const isVisible =
            image.offsetParent !== null &&
            styles.visibility !== 'hidden' &&
            styles.display !== 'none';

          const hasAltText = image.hasAttribute('alt');
          const isDecorative = image.getAttribute('role') === 'presentation';

          return isVisible && !hasAltText && !isDecorative;
        })
        .map((image) => image.currentSrc || image.src);
    });

    expect(
      visibleImagesMissingAlt,
      `Visible images missing alt text: ${visibleImagesMissingAlt.join(', ')}`
    ).toEqual([]);
  });

  test('keyboard users should be able to move focus with Tab', async ({ page }) => {
    await openHomePage(page);

    // Press Tab a few times because the first tab stop can vary by browser.
    for (let tabPressCount = 0; tabPressCount < 8; tabPressCount++) {
      await page.keyboard.press('Tab');

      const focusedElement = await page.evaluate(() => {
        const element = document.activeElement;
        return element ? element.tagName.toLowerCase() : '';
      });

      if (focusedElement && focusedElement !== 'body') {
        break;
      }
    }

    const focusedElement = await page.evaluate(() => {
      const element = document.activeElement;
      return element ? element.tagName.toLowerCase() : '';
    });

    expect(focusedElement).not.toBe('');
    expect(focusedElement).not.toBe('body');
  });
});
