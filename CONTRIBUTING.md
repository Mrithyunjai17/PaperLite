# Contributing to PaperLite

Thank you for helping improve PaperLite. Keep changes focused on a fast, simple, offline PDF workflow.

## Before opening an issue

- Search existing issues for the same problem.
- Confirm the issue occurs in the latest release.
- Remove personal or confidential information from sample PDFs.
- For security issues, follow [SECURITY.md](SECURITY.md) instead of opening a public issue.

## Development workflow

1. Fork and clone the repository.
2. Install dependencies with `pnpm install`.
3. Run the desktop app with `pnpm desktop:dev`.
4. Make a focused change and verify it with representative PDFs.
5. Run `pnpm build` before opening a pull request.

Pull requests should explain the user-visible problem, the resulting behavior, and how the change was tested. Avoid adding online services, analytics, or large dependencies without a clear reason.

## Code style

- Keep TypeScript strict and prefer small, readable components.
- Preserve offline behavior.
- Keep native permissions limited to capabilities the application uses.
- Maintain keyboard and assistive-technology labels for interactive controls.
