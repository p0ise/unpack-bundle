# unpack-bundle

Small Node.js tool to unpack JavaScript bundles (Browserify and simple AMD) into individual modules.

It can be used both as a CLI and as a library.

## Installation

Install globally to use the CLI:

```bash
npm install -g unpack-bundle
```

Or install locally for programmatic use:

```bash
npm install unpack-bundle --save-dev
```

## CLI usage

```bash
unpack-bundle [--quiet|-q] [--verbose|-v] <bundle1> [bundle2 ...] <outputDir>
```

- `bundleX` are input bundle files (Browserify or AMD bundles).
- `outputDir` is the directory where unpacked modules will be written.
- `--quiet` / `-q` hides per-module logs and only prints summaries and errors.
- `--verbose` / `-v` prints all internal info logs and per-module details.

Examples:

```bash
unpack-bundle ./examples/browserify-bundle.js ./out/browserify
unpack-bundle ./examples/amd-bundle.js ./out/amd
```

This will:

- Parse the bundle.
- Detect Browserify or AMD modules.
- Recursively unpack nested bundles.
- De-duplicate modules across multiple input bundles.
- Reconstruct best-effort file paths from module ids and relative `require(...)` calls.
- Write each module as a separate `.js` file under `./out`.

By default the CLI prints basic information for some modules (size and MD5 hash)
and periodic progress. Use `--verbose` to see details for every module.

## Library API

```js
const { unpackBundle, unpackBundles } = require("unpack-bundle");

// Single bundle
const modules = unpackBundle({
  path: "bundle.js",
  source: bundleCodeString,
});

// Multiple bundles (dedupe across inputs)
const allModules = unpackBundles([
  { path: "bundle1.js", source: code1 },
  { path: "bundle2.js", source: code2 },
]);

// `modules` / `allModules`:
// [
//   { path: "path/to/moduleA.js", source: "module source code..." },
//   { path: "path/to/moduleB.js", source: "..." },
//   ...
// ]
```

### Supported bundle formats

- Browserify bundles with the classic wrapper.
- Simple AMD bundles of the form:

  ```js
  define("path/to/module.js", function (require, module, exports) {
    // module body
  });
  ```

If the input is not recognized as Browserify or AMD, the library falls back to returning the original module.

## How it works (high level)

- `unpack/recursive.js` parses top level code, detects Browserify or AMD, and recurses into nested bundles.
- `unpack/browserify.js` and `unpack/amd.js` decode each bundle format into a normal module graph.
- `unpack/pathResolver.js` builds a virtual file tree from module ids and `require(...)` paths to reconstruct reasonable file paths.
- `unpack/utils.js` contains helpers used during AST transforms.
- `plugins/rename-exports.js` is a Babel plugin used by the CLI to rename exported identifiers to match their export names (for example, `exports.MyClass = Foo` becomes `class MyClass { ... }` where possible).

## Path reconstruction example

To see how module ids and relative `require(...)` calls are turned into
best-effort file paths, you can inspect the example bundles:

```bash
node examples/inspect-paths.js ./examples/browserify-bundle.js ./examples/amd-bundle.js
```

Example output:

```text
Bundle: ./examples/browserify-bundle.js
Modules: 3
  [0] parent-1/1
  [1] parent-1/lib/add
  [2] parent-1/shared/log

Bundle: ./examples/amd-bundle.js
Modules: 2
  [0] examples/amd/app/main.js
  [1] examples/amd/app/util/math.js
```

## Project structure

- `index.js`: main library entry, exports `unpackBundle` and `unpackBundles`.
- `bin/unpack-bundle.js`: CLI implementation used by the `unpack-bundle` command.
- `cli.js`: thin wrapper that forwards to `bin/unpack-bundle.js` (kept for compatibility).
- `unpack/`: core unpacking logic (Browserify, AMD, recursive traversal, path resolution).
- `plugins/`: Babel plugins used by the CLI.
- `examples/`: minimal bundles that demonstrate how path reconstruction works.
- `test/`: larger, real-world bundles used during development and manual testing.

## Development

Install dependencies:

```bash
npm install
```

Run the CLI directly with one of the sample bundles:

```bash
node bin/unpack-bundle.js ./examples/browserify-bundle.js ./out/browserify
```

For contribution guidelines and the recommended git workflow,
see `CONTRIBUTING.md`.

## Publishing checklist

- Make sure `name`, `version`, `description`, `author`, and `license` in `package.json` match your needs.
- Add a `repository` field in `package.json` pointing to your Git repository.
- Tag the version in Git (for example, `v1.0.0`) before publishing.
- Run `npm publish` from the project root.
