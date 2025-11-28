const parser = require("@babel/parser");
const { isBrowserifyBundle, unpackBrowserify } = require("./browserify");
const { isAmdBundle, unpackAmd } = require("./amd");

function recursiveUnpack(module, seen = new Set(), ctx = {}) {
  const allModules = [];
  if (!module || seen.has(module.path)) return allModules;
  seen.add(module.path);
  
  try {
    const ast = parser.parse(module.source, { });
    const body = ast.program.body;
    let submodules = [];
    
    if (isBrowserifyBundle(body)) {
      // 在多输入场景下共享 Browserify 的解析上下文以统一依赖路径解析
      ctx.browserifySession = ctx.browserifySession || {};
      submodules = unpackBrowserify(module.source, ctx.browserifySession);
    } else if (isAmdBundle(body)) {
      submodules = unpackAmd(module.source);
    }
    
    // 如果成功解包出子模块，则不保留原包，只保留子模块
    if (submodules.length > 0) {
      for (const innerModule of submodules) {
        const deeperModules = recursiveUnpack(innerModule, seen, ctx);
        allModules.push(...deeperModules);
      }
    } else {
      // 如果没有子模块，则保留原模块（叶子模块）
      allModules.push(module);
    }
  } catch {
    // 解析失败时，保留原模块
    console.warn(`Failed to parse module at ${module.path}, keeping as is.`);
    allModules.push(module);
  }
  
  return allModules;
}

module.exports = { recursiveUnpack };
