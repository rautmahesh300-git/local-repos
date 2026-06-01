<!-- Playwright Project Setup Instructions -->

# Playwright Project Instructions

This is a Playwright testing project with TypeScript support.

## Project Overview

- **Framework**: Playwright
- **Language**: TypeScript
- **Test Directory**: `tests/`
- **Configuration**: `playwright.config.ts`

## Getting Started

1. Install dependencies: `npm install`
2. Run tests: `npm test`
3. Run tests in debug mode: `npm run test:debug`
4. Generate test report: `npm run test:report`

## Project Structure

```
├── tests/                      # Test files
│   ├── example.spec.ts        # Example test
│   └── fixtures/              # Test fixtures
├── playwright.config.ts        # Playwright configuration
├── package.json               # Dependencies
└── README.md                  # Documentation
```

## Development

- Use `npm run test:watch` for watch mode
- Use `npm run test:headed` to run tests with visible browser
- Reports are generated in `test-results/` directory
