# Contributing to Baseline

Thank you for your interest in contributing to Baseline! This guide will help you get started.

## Development Setup

1. **Clone the repository**

    ```bash
    git clone <repository-url>
    cd baseline
    ```

2. **Install dependencies**

    ```bash
    npm install
    ```

3. **Build the project**

    ```bash
    npm run build
    ```

4. **Run tests**
    ```bash
    npm test
    ```

## Development Workflow

### Making Changes

1. **Create a branch**

    ```bash
    git checkout -b feature/your-feature-name
    ```

2. **Make your changes**

    - Write code following the existing style
    - Add tests for new functionality
    - Update documentation as needed

3. **Run tests**

    ```bash
    npm test
    npm run test:coverage
    ```

4. **Build and verify**
    ```bash
    npm run build
    node dist/cli.js <command>
    ```

### Testing

- All tests should pass before submitting a PR
- Add tests for new features
- Aim for >80% coverage for new code
- See `TESTING.md` for detailed testing guidelines

### Code Style

- Use TypeScript strict mode
- Follow existing code formatting (double quotes, tabs)
- Add JSDoc comments for public APIs
- Keep functions focused and testable

### Commit Messages

Use clear, descriptive commit messages:

```
feat: add support for GitLab integration
fix: resolve path resolution issue in exec command
docs: update README with new command examples
test: add integration tests for branch command
```

## Pull Request Process

1. **Update tests**: Ensure all tests pass
2. **Update documentation**: Update README, ARCHITECTURE.md, or relevant docs
3. **Run linter**: Ensure no linting errors
4. **Submit PR**: Include description of changes and motivation

### PR Checklist

- [ ] Tests pass (`npm test`)
- [ ] Coverage maintained or improved
- [ ] Documentation updated
- [ ] No linting errors
- [ ] Code follows existing patterns
- [ ] Commit messages are clear

## Adding New Commands

1. Create `src/commands/yourcommand.ts`
2. Export command function
3. Register in `src/cli.ts`
4. Add tests in `src/commands/__tests__/yourcommand.test.ts`
5. Update README.md with command documentation

## Adding New Utilities

1. Create `src/utils/yourutil.ts`
2. Export utility functions/classes
3. Add JSDoc comments
4. Add tests in `src/utils/__tests__/yourutil.test.ts`

## Questions?

Open an issue with your question or reach out to maintainers.
