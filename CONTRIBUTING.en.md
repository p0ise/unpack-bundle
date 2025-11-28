# Contributing

[简体中文](CONTRIBUTING.md) · [English](CONTRIBUTING.en.md)

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

4. Open a pull request against the `develop` branch with:
   - A clear title (what the change does)
   - A short description of the motivation
   - Notes about any breaking changes or behavior changes

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
  - This project uses `standard-version` to automate versioning and changelog generation.
  - Use the Conventional Commits-style prefixes above so changes are categorized correctly.
  - Two ways to cut a release:

    1. **Locally via npm script**

       - Ensure `main` contains all desired commits and the working tree is clean.
       - Run:

         ```bash
         npm run release
         git push --follow-tags origin main
         npm publish
         ```

    2. **Via GitHub Actions (recommended once the repo is on GitHub)**

       - Open the repository on GitHub and go to **Actions → Release**.
       - Trigger the workflow with **Run workflow**.
       - The workflow will:
         - Install dependencies.
         - Run tests if defined (or skip with a warning).
         - Run `standard-version` to bump versions and update `CHANGELOG.md`.
         - Push the release commit and tag back to `main`.
         - Create a GitHub Release with auto-generated release notes.
         - Publish the package to npm using the `NPM_TOKEN` repository secret.
       - Make sure you have set `NPM_TOKEN` in the repository secrets with an npm access token that has publish permissions.

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
