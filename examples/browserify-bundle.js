// Minimal Browserify-style bundle that demonstrates how unpack-bundle
// reconstructs partial path relationships from relative require(...) calls.
//
// Path structure (what we want to reverse engineer):
//   [entry]  -> requires "./lib/add"
//   lib/add -> requires "../shared/log"
//   shared/log

(function (modules, cache, entries) {
  // Runtime implementation is not needed for static unpacking.
})(
  {
    // Entry module: requires a file in ./lib
    1: [
      function (require, module, exports) {
        const add = require("./lib/add");
        console.log("sum:", add(1, 2));
      },
      { "./lib/add": 2 },
    ],

    // ./lib/add
    2: [
      function (require, module, exports) {
        const log = require("../shared/log");
        module.exports = function add(a, b) {
          log("adding", a, b);
          return a + b;
        };
      },
      { "../shared/log": 3 },
    ],

    // ../shared/log
    3: [
      function (require, module, exports) {
        module.exports = function log(message, a, b) {
          console.log("[log]", message, a, b);
        };
      },
      {},
    ],
  },
  {},
  [1]
);
