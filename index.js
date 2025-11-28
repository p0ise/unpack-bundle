const { recursiveUnpack } = require("./unpack/recursive");

// 简单的路径评分：尽量避免 parent- 开头的占位目录，优先选择更“干净”的真实路径
function pathScore(p) {
  const segments = String(p).split("/");
  const placeholderCount = segments.filter((s) => s.startsWith("parent")).length;
  // 占位目录越多，分数越低；路径越短，稍微加一点分
  return -placeholderCount * 10 - segments.length;
}

/**
 * 解包任意 JavaScript bundle（支持 Browserify / AMD）
 * @param {Object} initialModule { path, source }
 * @returns {Array} 标准模块列表 [{ path, source }]
 */
function unpackBundle(initialModule) {
  return unpackBundles([initialModule]);
}

/**
 * 解包多个 JavaScript bundle（支持 Browserify / AMD）
 * 多输入场景会跨输入去重，同一依赖关系可避免重复输出。
 * @param {Array<{path:string, source:string}>} initialModules
 * @returns {Array<{path:string, source:string}>}
 */
function unpackBundles(initialModules = []) {
  const seenRecursive = new Set(); // 跨初始输入共享，避免重复递归处理
  const ctx = {}; // 共享上下文（如 Browserify 解析会话）
  const aggregated = [];

  for (const mod of initialModules) {
    if (!mod || !mod.path || !mod.source) continue;
    const sub = recursiveUnpack(mod, seenRecursive, ctx);
    aggregated.push(...sub);
  }

  // 先按“逻辑模块 id”去重（Browserify 场景下由 unpack/browserify 暴露的 id 字段）
  const byLogicalId = new Map(); // id(string) -> { id, path, source }
  const rest = []; // 其它没有 id 的模块（AMD / 非 Browserify）

  for (const m of aggregated) {
    if (!m || !m.path || !m.source) continue;
    if (m.id != null) {
      const key = String(m.id);
      const existing = byLogicalId.get(key);
      if (!existing || pathScore(m.path) > pathScore(existing.path)) {
        byLogicalId.set(key, m);
      }
    } else {
      rest.push(m);
    }
  }

  // 再按最终 path 去重，避免同一路径被多个模块占用
  const seenPaths = new Set();
  const result = [];

  for (const m of [...byLogicalId.values(), ...rest]) {
    if (!m.path || !m.source) continue;
    if (seenPaths.has(m.path)) continue;
    seenPaths.add(m.path);
    // 对外仍只暴露 { path, source }，内部 id 字段不向调用方泄露
    result.push({ path: m.path, source: m.source });
  }

  return result;
}

module.exports = { unpackBundle, unpackBundles };
