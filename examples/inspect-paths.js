const fs = require("fs");
const path = require("path");

const { unpackBundle } = require("..");

function inspectBundle(bundlePath) {
  const absPath = path.resolve(bundlePath);
  const source = fs.readFileSync(absPath, "utf8");

  const modules = unpackBundle({
    path: path.basename(absPath),
    source,
  });

  console.log(`Bundle: ${bundlePath}`);
  console.log(`Modules: ${modules.length}`);

  modules.forEach((mod, index) => {
    console.log(`  [${index}] ${mod.path}`);
  });

  console.log("");
}

function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log("Usage: node examples/inspect-paths.js <bundle1> [bundle2 ...]");
    console.log("Example:");
    console.log(
      "  node examples/inspect-paths.js ./examples/browserify-bundle.js ./examples/amd-bundle.js"
    );
    return;
  }

  for (const bundlePath of args) {
    inspectBundle(bundlePath);
  }
}

main();

