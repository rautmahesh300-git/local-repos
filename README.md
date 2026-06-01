# Playwright Project

A Playwright testing project with TypeScript support for end-to-end testing.

## Getting Started

### Prerequisites

- Node.js 18+ installed
- npm or yarn package manager

### Installation

1. Install dependencies:
```bash
npm install
```

2. Install Playwright browsers:
```bash
npx playwright install
```

### Running Tests

Run all tests:
```bash
npm test
```

Run tests in headed mode (visible browser):
```bash
npm run test:headed
```

Run tests in debug mode:
```bash
npm run test:debug
```

Run tests in watch mode:
```bash
npm run test:watch
```

View test report:
```bash
npm run test:report
```

## Project Structure

```
├── .github/
│   └── copilot-instructions.md    # Project instructions
├── tests/
│   ├── example.spec.ts             # Example test file
│   └── fixtures/                   # Test fixtures directory
├── playwright.config.ts            # Playwright configuration
├── tsconfig.json                   # TypeScript configuration
├── package.json                    # Project dependencies
├── .gitignore                      # Git ignore rules
└── README.md                       # This file
```

## Configuration

### playwright.config.ts

Main Playwright configuration file includes:
- Test directory and patterns
- Multiple browser support (Chromium, Firefox, WebKit)
- Screenshot and trace capture on failures
- HTML reporting

### tsconfig.json

TypeScript configuration for strict type checking and ES2020 target.

## Writing Tests

Tests are located in the `tests/` directory and follow the naming pattern `*.spec.ts`.

Example test structure:
```typescript
import { test, expect } from '@playwright/test';

test('my test', async ({ page }) => {
  await page.goto('https://example.com');
  // Add your test logic here
});
```

## Test Reports

After running tests, HTML reports are generated in the `playwright-report/` directory. View them with:
```bash
npm run test:report
```

## Continuous Integration

The project is configured for CI environments with:
- Reduced workers to 1
- 2 retry attempts
- Screenshot and trace capture on failures

## Resources

- [Playwright Documentation](https://playwright.dev)
- [Playwright Best Practices](https://playwright.dev/docs/best-practices)
- [Test Examples](https://playwright.dev/docs/writing-tests)
