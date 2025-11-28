const path = require("path");
const crypto = require("crypto");
const parser = require("@babel/parser");
const t = require("@babel/types");
const { restoreParams } = require("./utils");
const { FileTree } = require("./pathResolver");

function isBrowserifyBundle(body) {
  const nonEmptyBody = body.filter((node) => !t.isEmptyStatement(node));
  if (nonEmptyBody.length === 0 || nonEmptyBody.length > 2) return false;

  const expression = nonEmptyBody[nonEmptyBody.length - 1];
  if (!t.isExpressionStatement(expression)) return false;

  let funcExpr = expression.expression;
  if (t.isUnaryExpression(funcExpr)) {
    funcExpr = funcExpr.argument;
  } else if (t.isAssignmentExpression(funcExpr)) {
    funcExpr = funcExpr.right;
  }

  if (!t.isCallExpression(funcExpr)) return false;

  let args = funcExpr.arguments;
  if (args.length === 1) {
    const extracted = extractStandalone(args);
    if (extracted) {
      args = extracted;
    }
  }

  if (args.length !== 3) return false;

  return (
    t.isObjectExpression(args[0]) &&
    t.isObjectExpression(args[1]) &&
    t.isArrayExpression(args[2])
  );
}

function ensureSession(session) {
  const s = session || {};
  s.moduleMap = s.moduleMap || new Map(); // canonicalId -> { id, source, deps, isExternalStub }
  s.depFromMap = s.depFromMap || new Map(); // depId -> Set(fromIds)
  s.depScoreMap = s.depScoreMap || new Map(); // depId -> bestScore
  s.fileTree = s.fileTree || new FileTree();
  // hashToCanonicalId: sourceHash -> canonicalId（跨 bundle 统一同一模块）
  s.hashToCanonicalId = s.hashToCanonicalId || new Map();
  // idAlias: raw browserify id -> canonicalId
  s.idAlias = s.idAlias || new Map();
  return s;
}

function getSourceHash(source) {
  return crypto.createHash("md5").update(source).digest("hex");
}

function unpackBrowserify(code, session) {
  const ast = parser.parse(code, {});
  let body = ast.program.body;
  body = body.filter(function (node) {
    return !t.isEmptyStatement(node);
  });

  let expression;
  if (body.length <= 2) {
    expression = body[body.length - 1];
  } else {
    return;
  }
  if (!t.isExpressionStatement(expression)) return;

  let func;
  if (t.isUnaryExpression(expression.expression)) {
    func = expression.expression.argument;
  } else if (t.isAssignmentExpression(expression.expression)) {
    func = expression.expression.right;
  } else {
    func = expression.expression;
  }
  if (!t.isCallExpression(func)) return;

  let args = func.arguments;
  if (args.length === 1) args = extractStandalone(args) || args;
  if (args.length !== 3) return;

  if (!t.isObjectExpression(args[0])) return;
  if (!t.isObjectExpression(args[1])) return;
  if (!t.isArrayExpression(args[2])) return;

  const files = args[0].properties;
  if (!files || files.length === 0) return [];
  // let cache = args[1];
  // let entries = args[2].elements.map(function (e) {
  //   return e.value;
  // });

  const sess = ensureSession(session);
  const moduleMap = sess.moduleMap; // shared across calls（按 canonicalId 存储）
  const depFromMap = sess.depFromMap;
  const depScoreMap = sess.depScoreMap;
  const hashToCanonicalId = sess.hashToCanonicalId;
  const idAlias = sess.idAlias;

  // ===== 工具函数部分 =====
  function fileNameScore(p) {
    if (p.endsWith(".js")) return 3;
    if (p.endsWith("index")) return 2;
    return 1;
  }

  function normalizePathByScore(path, score) {
    const currentScore = fileNameScore(path);
    if (score >= 2 && currentScore < 2) path += "/index";
    if (score >= 3 && currentScore < 3) path += ".js";
    return path;
  }


  function resolveDepPathConflict(depId, rawPath, fromId) {
    // 第一步：补上 index（如果以 / 结尾）
    if (rawPath.endsWith("/")) {
      rawPath += "index";
    }

    // 计算当前路径的优先级得分
    const score = fileNameScore(rawPath);
    const bestScore = depScoreMap.get(depId) || 1;

    if (!depScoreMap.has(depId)) {
      depScoreMap.set(depId, score);
      return rawPath;
    } else if (score > bestScore) {
      depScoreMap.set(depId, score);
      const finalPath = normalizePathByScore(rawPath, score);

      // 回填所有引用过这个 depId 的模块中的路径
      for (const fid of depFromMap.get(depId) || []) {
        const mod = moduleMap.get(String(fid));
        if (mod && mod.deps[depId]) {
          mod.deps[depId] = finalPath;
        }
      }

      return finalPath;
    } else {
      // 当前路径优先级较低 → 使用已有优先级补全路径
      return normalizePathByScore(rawPath, bestScore);
    }
  }

  for (const file of files) {
    try {
      const id = t.isLiteral(file.key) ? file.key.value : file.key.name;
      const elements = file.value.elements;
      if (!elements || elements.length < 2) {
        console.warn(`Invalid module format for id: ${id}`);
        continue;
      }

      const funcNode = elements[0];
      const depsNode = elements[1];

      const rawCode = code.slice(funcNode.start, funcNode.end);
      const restored = restoreParams(rawCode);

      // 为模块建立“逻辑 id”：使用源码 hash 将跨 bundle 的相同模块折叠到同一个 canonicalId
      const rawIdStr = String(id);
      const logicalHash = getSourceHash(restored);
      let canonicalId = hashToCanonicalId.get(logicalHash);
      if (!canonicalId) {
        canonicalId = rawIdStr;
        hashToCanonicalId.set(logicalHash, canonicalId);
      }
      idAlias.set(rawIdStr, canonicalId);

      const deps = {};

      for (const prop of depsNode.properties) {
        let rawPath = t.isLiteral(prop.key) ? prop.key.value : prop.key.name;
        const originalPath = String(rawPath);
        rawPath = path.posix.normalize(originalPath);
        // 保留以 ./ 开头的相对路径前缀，便于后续在路径解析阶段识别相对路径
        // path.posix.normalize("./foo") 会变成 "foo"，这里把信息加回来
        if (originalPath.startsWith("./") && !rawPath.startsWith(".")) {
          rawPath = "./" + rawPath;
        }

        let depId = prop.value && prop.value.value;

        if (depId === undefined) {
          // Browserify 在多 bundle 场景下会把跨 bundle 依赖的 id 写成 void 0，
          // 运行时再用 require 的字符串去全局查找实际模块：
          // - 相对路径（包含 ./ 或 ../）会在运行时回退到最后一段文件名
          // - 包名 / 绝对模块名（如 ts-md5、buffer、@o4e/cc-mobx、@jimu/basis）直接用完整名字查找
          //
          // 这里一律为 void 0 依赖生成一个“逻辑 id”，以便跨 bundle 合并：
          // - 相对路径：使用最后一段文件名
          // - 其它（包名、@scope/name 等）：使用最后一段（对 ts-md5 / buffer 就是自身）
          if (typeof originalPath === "string") {
            const segments = originalPath.split("/");
            depId = segments[segments.length - 1] || originalPath;

            let kind;
            if (originalPath.startsWith("./") || originalPath.startsWith("../")) {
              kind = "Cross-bundle dependency";
            } else if (originalPath.startsWith("@")) {
              kind = "Scoped cross-bundle dependency";
            } else {
              // 例如 ts-md5、buffer 这类包名 / 绝对模块名
              kind = "Bare cross-bundle dependency";
            }

            console.info(`${kind}: ${originalPath} -> ${depId}`);
          } else {
            // 理论上这里很难命中，保守地当作真正外部依赖
            console.info(`External dependency: ${rawPath}`);
            continue;
          }
        }

        depId = String(depId);

        // 标准化 & 优先级冲突处理
        const finalPath = resolveDepPathConflict(depId, rawPath, id);
        deps[depId] = finalPath;

        // 记录依赖来源（按 canonicalId 记录，方便之后回填）
        if (!depFromMap.has(depId)) {
          depFromMap.set(depId, new Set());
        }
        depFromMap.get(depId).add(canonicalId);
      }

      const isExternalStub =
        restored.trim() === "" && Object.keys(deps).length === 0;

      const canonicalIdStr = String(canonicalId);
      const existing = moduleMap.get(canonicalIdStr);

      if (!existing) {
        moduleMap.set(canonicalIdStr, {
          id: canonicalIdStr,
          source: restored,
          deps,
          isExternalStub,
        });
      } else {
        // 同一个逻辑模块出现在多个 bundle 中：
        // 合并依赖信息；如果任一实现不是 stub，则视为非 stub。
        Object.assign(existing.deps, deps);
        existing.isExternalStub = existing.isExternalStub && isExternalStub;
      }
    } catch (err) {
      console.warn("Failed to parse module:", err.message);
      continue;
    }
  }

  // 构建路径树
  const fileTree = sess.fileTree;
  for (const [cid, mod] of moduleMap.entries()) {
    if (!fileTree.hasNode(cid)) {
      fileTree.addFile(cid, cid, true);
    }

    for (const [depId, depPath] of Object.entries(mod.deps)) {
      const depCanonicalId = idAlias.get(String(depId)) || String(depId);
      const depModule = moduleMap.get(depCanonicalId);
      if (depModule?.isExternalStub) {
        console.info(`Skipped external stub: ${depPath} → ${depCanonicalId}`);
        continue;
      }

      try {
        fileTree.parseRequirePath(cid, depCanonicalId, depPath);
      } catch (e) {
        console.warn(
          `Failed to resolve path for ${cid} → ${depPath}: ${e.message}`
        );
      }
    }
  }

  // 返回结果：仅保留 path 和 source
  const outputModules = [];
  for (const [cid, mod] of moduleMap.entries()) {
    if (mod.isExternalStub) continue;

    outputModules.push({
      // 暴露逻辑模块 id，便于在最终聚合阶段按模块维度去重
      id: cid,
      path: fileTree.getNodeAbsolutePath(cid),
      source: mod.source,
    });
  }
  return outputModules;
}

function extractStandalone(args) {
  if (!t.isFunctionExpression(args[0])) return;
  if (args[0].body.length < 2) return;
  if (args[0].body.body.length < 2) return;

  args = args[0].body.body[1].argument;
  if (!t.isCallExpression(args)) return;
  if (!t.isCallExpression(args.callee)) return;

  return args.callee.arguments;
}

module.exports = {
  isBrowserifyBundle,
  unpackBrowserify,
};
