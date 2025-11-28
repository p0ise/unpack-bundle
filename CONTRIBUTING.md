# Contributing

Thanks for your interest in contributing!

This project is a small Node.js tool for unpacking JavaScript bundles
(Browserify / AMD) into individual modules. The goal is to keep the code
simple, well-tested, and easy to understand.

## How to report bugs

1. Search existing issues to see if your problem is already reported.
2. Include:
   - Node.js version
   - Operating system
   - The bundle you tried to unpack (or a minimal reproducible example)
   - The command you ran and full output

If you can reduce the bundle to the smallest possible file that still
reproduces the problem, that helps a lot.

## How to propose changes

1. Fork the repository and create a branch from `develop`:

   - `feature/...` for new features
   - `fix/...` for bug fixes
   - `chore/...` for maintenance and tooling

2. Make your changes and keep them focused on a single topic.
3. Run tests or example commands:

   - If a `test` script exists, run:

     ```bash
     npm test
     ```

   - At minimum, run the example CLI commands from the README, for example:

     ```bash
     node bin/unpack-bundle.js ./examples/browserify-bundle.js ./out/browserify
     node bin/unpack-bundle.js ./examples/amd-bundle.js ./out/amd
     ```

## Git workflow and history

- Branch roles:
  - `main`: stable branch for tagged releases (`v1.0.0`, `v1.0.1`, ...).
  - `develop`: integration branch for day-to-day development.
  - `feature/*`: new features (for example `feature/add-path-examples`).
  - `fix/*`: bug fixes (for example `fix/handle-cross-bundle-id-conflicts`).
  - `chore/*`: tooling, CI, documentation, and other maintenance.

- Recommended workflow:
  1. Start from `develop` (`git checkout develop`).
  2. Create a topic branch (`feature/...`, `fix/...`, or `chore/...`).
  3. Keep commits small and focused; avoid committing generated output.
  4. Rebase on top of the latest `develop` before opening a pull request.
  5. Prefer squash-merge or a small number of well-structured commits.

- Commit message conventions:
  - Use a simple Conventional Commits–style prefix:
    - `feat: add path reconstruction examples`
    - `fix: handle empty browserify module objects`
    - `docs: document CLI logging options`
    - `refactor: simplify FileTree merge logic`
    - `test: add examples-based smoke tests`
    - `chore: update dependencies`
  - Use English and the imperative mood (“add”, not “added”).
  - Fix-up commits should be squashed before merging when possible.

- Releases:
  - Bump the `version` field in `package.json` when preparing a new release.
  - Update `README.md` / `CHANGELOG.md` (if present) to describe the changes.
  - Tag releases from `main` using `vX.Y.Z` and publish to npm from that tag.

4. Open a pull request against the `develop` branch with:
   - A clear title (what the change does)
   - A short description of the motivation
   - Notes about any breaking changes or behavior changes

## Code style

- Use the existing style in the codebase as a reference.
- Prefer small, focused functions over large ones.
- Add comments only where they help understanding non-obvious logic.

## Tests

- Add or update tests when fixing bugs or adding features.
- Keep tests small and deterministic. The test suite should be fast.

## Code of conduct

Please be respectful and constructive in all interactions. Treat other
contributors and users with courtesy. Harassment, discrimination, and
personal attacks are not acceptable.
