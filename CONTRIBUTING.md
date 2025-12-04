# Contributing to Excalidraw Local

First off, thanks for taking the time to contribute!

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check existing issues. When you create a bug report, include:

- A clear and descriptive title
- Exact steps to reproduce the problem
- Specific examples (code snippets, screenshots)
- The behavior you observed vs what you expected
- Your environment (OS, browser, Node.js version)

### Suggesting Features

Feature requests are welcome! Please:

- Use a clear and descriptive title
- Provide a detailed description of the proposed feature
- Explain why this feature would be useful
- List any alternatives you have considered

### Pull Requests

1. Fork the repo and create your branch from main
2. Install dependencies: pnpm install
3. Make your changes
4. Run linting: pnpm lint
5. Run type checking: npx tsc --noEmit
6. Test your changes locally
7. Commit with a clear message
8. Push to your fork and open a Pull Request

## Development Setup

### Prerequisites

- Node.js 22+
- pnpm 10+
- Docker and Docker Compose

### Getting Started

Clone your fork, install dependencies, copy .env.example to .env,
start the database with docker compose up -d db, run migrations
with npx prisma migrate dev, and start dev server with pnpm dev.

## Code Style

- TypeScript: Use strict types, avoid any
- Components: Functional components with hooks
- Naming: PascalCase for components, camelCase for functions
- Constants: All size limits and config values should go in src/lib/constants.ts

## Architecture Notes

### Storage Limits

Content size limits are centralized in `src/lib/constants.ts`. When adding new
content types or modifying limits:

1. Add/update constants in `constants.ts` with clear documentation
2. Update storage APIs to track new content types
3. Add client-side validation with real-time feedback
4. Include actionable error messages with size information

### Card Components

Markdown and Rich Text cards follow a consistent pattern:

- Real-time size tracking with visual indicators
- Warning at 80% of limit, error at 100%
- Save prevention when over limit
- Actionable error messages with reduction tips

## Commit Messages

Use clear, descriptive commit messages:

- feat: add version history panel
- fix: resolve autosave conflict detection
- docs: update README with deployment instructions
- style: format with Prettier

## Questions?

Feel free to open an issue for any questions about contributing.
