# Testing Guide

This document describes the testing strategy and how to run tests for the Baseline CLI tool.

## Test Framework

- **Framework**: [Vitest](https://vitest.dev/)
- **Coverage**: [@vitest/coverage-v8](https://vitest.dev/guide/coverage.html)
- **Assertions**: Built-in Vitest assertions

## Running Tests

### All Tests
```bash
npm test
```

### Watch Mode
```bash
npm run test:watch
```

### Coverage Report
```bash
npm run test:coverage
```

This generates:
- Text coverage report in terminal
- JSON coverage report in `coverage/coverage-final.json`
- HTML coverage report in `coverage/index.html`

## Test Structure

Tests are organized to mirror the source code structure:

```
src/
├── utils/
│   ├── __tests__/
│   │   ├── logger.test.ts
│   │   ├── version-check.test.ts
│   │   └── package-manager.test.ts
│   ├── logger.ts
│   ├── version-check.ts
│   └── package-manager.ts
├── config/
│   ├── __tests__/
│   │   └── manager.test.ts
│   └── manager.ts
└── commands/
    ├── __tests__/
    │   └── add.test.ts
    └── add.ts
```

## Test Categories

### Unit Tests

#### Logger Tests (`src/utils/__tests__/logger.test.ts`)
- Tests all log methods (info, success, warn, error, debug)
- Tests formatting methods (title, section, dim, highlight)
- Tests table rendering

#### Version Check Tests (`src/utils/__tests__/version-check.test.ts`)
- Tests semver validation (exact, min, max, ranges)
- Tests non-semver string comparison
- Tests policy satisfaction logic
- Tests error messages

#### Package Manager Tests (`src/utils/__tests__/package-manager.test.ts`)
- Tests package manager detection from lock files
- Tests priority order (pnpm > yarn > npm)
- Tests installation checking
- Tests version retrieval

#### Config Manager Tests (`src/config/__tests__/manager.test.ts`)
- Tests config loading and saving
- Tests file existence checking
- Tests validation errors
- Tests workspace root finding

### Integration Tests

#### Command Tests (`src/commands/__tests__/add.test.ts`)
- Tests repository addition
- Tests option handling
- Tests duplicate detection
- Tests config updates

## Writing Tests

### Example Unit Test

```typescript
import { describe, it, expect } from "vitest";
import { VersionCheck } from "../version-check.js";

describe("VersionCheck", () => {
  describe("satisfies", () => {
    it("should validate exact version match", () => {
      const policy = { exact: "1.2.3" };
      expect(VersionCheck.satisfies("1.2.3", policy).valid).toBe(true);
      expect(VersionCheck.satisfies("1.2.4", policy).valid).toBe(false);
    });
  });
});
```

### Example Integration Test

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { addCommand } from "../add.js";
import { ConfigManager } from "../../config/manager.js";

describe("addCommand", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "test-"));
    // Setup test environment
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("should add repository to config", async () => {
    // Test implementation
  });
});
```

## Best Practices

1. **Isolation**: Each test should be independent and not rely on other tests
2. **Cleanup**: Always clean up temporary files/directories in `afterEach`
3. **Mocking**: Use Vitest's mocking for external dependencies
4. **Naming**: Use descriptive test names that explain what is being tested
5. **Coverage**: Aim for high coverage of core functionality
6. **Fast Tests**: Keep tests fast; use mocks for slow operations

## Continuous Integration

Tests run automatically on:
- Push to main/master branches
- Pull requests

See `.github/workflows/test.yml` for CI configuration.

## Coverage Goals

Current coverage targets:
- **Core utilities**: >90%
- **Config management**: >90%
- **Commands**: >80%
- **Overall**: >85%

## Debugging Tests

### Run Single Test File
```bash
npm test -- logger.test.ts
```

### Run Tests Matching Pattern
```bash
npm test -- --grep "version"
```

### Debug Mode
```bash
npm test -- --reporter=verbose
```

## Future Test Improvements

- [ ] E2E tests for full command workflows
- [ ] Mock git operations for faster tests
- [ ] Test error scenarios more thoroughly
- [ ] Performance tests for large workspaces
- [ ] Cross-platform testing in CI

