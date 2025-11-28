#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const babel = require("@babel/core");
const { unpackBundles } = require("..");

// Load all babel plugins used for transformation
const renameExportsPlugin = require("../plugins/rename-exports");
const plugins = [renameExportsPlugin];

// Simple CLI options parsing
const rawArgs = process.argv.slice(2);
const cliOptions = {
  logLevel: "normal", // quiet | normal | verbose
};
const bundleArgs = [];

for (const arg of rawArgs) {
  if (arg === "-q" || arg === "--quiet") {
    cliOptions.logLevel = "quiet";
  } else if (arg === "-v" || arg === "--verbose") {
    cliOptions.logLevel = "verbose";
  } else {
    bundleArgs.push(arg);
  }
}

if (bundleArgs.length < 2) {
  console.error(
    "Usage: unpack-bundle [--quiet|-q] [--verbose|-v] <bundle1> [bundle2 ...] <outputDir>"
  );
  process.exit(1);
}

// Last argument is output directory, others are input bundle files
const outputDir = bundleArgs[bundleArgs.length - 1];
const bundlePaths = bundleArgs.slice(0, -1);

// Reduce internal noise in normal/quiet mode while keeping warnings/errors
const originalConsoleInfo = console.info.bind(console);
if (cliOptions.logLevel !== "verbose") {
  console.info = () => {};
}

// Read all bundle sources
const initialModules = bundlePaths.map((p) => ({
  path: path.basename(p),
  source: fs.readFileSync(p, "utf8"),
}));

// Unpack modules (recursive + Browserify + AMD), dedupe across inputs
const modules = unpackBundles(initialModules);

if (!modules || modules.length === 0) {
  console.log("No modules found in the bundle.");
  process.exit(0);
}

console.log(
  `Unpacked ${modules.length} module(s) from ${bundlePaths.length} bundle(s).`
);
console.log(`Writing files into: ${outputDir}`);

const total = modules.length;
const isSmallBundle = total <= 50;
const maxDetailedLogs = 20;
let detailedCount = 0;
let errors = 0;

// Write modules to target directory
modules.forEach((mod, index) => {
  const filePath = path.posix.join(outputDir, normalizeFileName(mod.path));
  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });

    const transformed = babel.transformSync(mod.source, {
      plugins,
      filename: mod.path,
      sourceType: "unambiguous",
    });

    fs.writeFileSync(filePath, transformed.code, "utf8");

    const shouldLogDetails =
      cliOptions.logLevel === "verbose" ||
      (cliOptions.logLevel === "normal" &&
        (isSmallBundle || detailedCount < maxDetailedLogs));

    if (shouldLogDetails) {
      console.log(`✓ ${mod.path}`);
      console.log(`  Size: ${Buffer.byteLength(mod.source, "utf8")} bytes`);
      console.log(`  Hash: ${generateHash(mod.source)}`);
      console.log("----------------------------------------");
      detailedCount++;
    } else if (
      cliOptions.logLevel === "normal" &&
      !isSmallBundle &&
      (index + 1) % 200 === 0
    ) {
      console.log(`Progress: ${index + 1}/${total} modules written...`);
    }
  } catch (err) {
    errors++;
    console.error(`Failed to write ${mod.path}: ${err.message}`);
  }
});

if (cliOptions.logLevel === "normal" && !isSmallBundle && detailedCount > 0) {
  const skipped = total - detailedCount;
  if (skipped > 0) {
    console.log(
      `Skipped detailed logs for ${skipped} module(s). Use --verbose to see all.`
    );
  }
}

console.log(
  `Done. Wrote ${total - errors} module(s)` +
    (errors ? ` (${errors} error(s))` : "") +
    "."
);

// Restore original console.info in case this process is embedded
console.info = originalConsoleInfo;

// Ensure file names always have .js suffix
function normalizeFileName(filePath) {
  return filePath.endsWith(".js") ? filePath : `${filePath}.js`;
}

// Generate MD5 hash for content
function generateHash(content) {
  return crypto.createHash("md5").update(content).digest("hex");
}
