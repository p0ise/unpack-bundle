// Minimal AMD bundle that demonstrates directory-like module ids and
// a relative require that can be preserved when unpacking.

// Entry module: app/main.js -> requires ./util/math
define("examples/amd/app/main.js", function (require, module, exports) {
  const math = require("./util/math");
  console.log("2 + 3 =", math.add(2, 3));
});

// Leaf module: app/util/math.js
define("examples/amd/app/util/math.js", function (require, module, exports) {
  exports.add = function add(a, b) {
    return a + b;
  };
});
