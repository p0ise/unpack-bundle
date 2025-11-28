# unpack-bundle

[简体中文](README.md) · [English](README.en.md)

一个用于**解包 JavaScript Bundle** 的小型 Node.js 工具，支持：

- Browserify 打包
- 简单 AMD 形式（`define("xxx.js", function (require, module, exports) { ... })`）

它既可以作为 **命令行工具（CLI）** 使用，也可以作为 **库** 集成到你的脚本中。

## 安装

全局安装（用于命令行）：

```bash
npm install -g unpack-bundle
```

作为项目依赖安装（用于代码中调用）：

```bash
npm install unpack-bundle --save-dev
```

## CLI 使用方式

```bash
unpack-bundle [--quiet|-q] [--verbose|-v] <bundle1> [bundle2 ...] <outputDir>
```

- `bundleX`：输入的打包文件（支持 Browserify / AMD）。
- `outputDir`：解包后模块输出目录。
- `--quiet` / `-q`：静默模式，只输出汇总和错误，不打印每个模块的详细信息。
- `--verbose` / `-v`：详细模式，打印全部内部信息和每个模块的详细日志。

示例：

```bash
unpack-bundle ./examples/browserify-bundle.js ./out/browserify
unpack-bundle ./examples/amd-bundle.js ./out/amd
```

上述命令会：

- 解析 bundle；
- 自动识别 Browserify / AMD 模块；
- 递归解包嵌套 bundle；
- 在多输入场景下对模块进行**去重**；
- 利用模块 id 和相对 `require(...)` 调用，**尽可能还原文件路径结构**；
- 将每个模块写为单独的 `.js` 文件到 `./out/...`。

默认情况下，CLI 会：

- 对部分模块输出：路径、体积、MD5 哈希；
- 对大 bundle，按一定间隔输出进度；
- 你可以通过 `--verbose` 查看所有模块的详细信息。

## 库 API

```js
const { unpackBundle, unpackBundles } = require("unpack-bundle");

// 解包单个 bundle
const modules = unpackBundle({
  path: "bundle.js",
  source: bundleCodeString,
});

// 解包多个 bundle（跨输入去重）
const allModules = unpackBundles([
  { path: "bundle1.js", source: code1 },
  { path: "bundle2.js", source: code2 },
]);

// 返回结果格式：
// [
//   { path: "path/to/moduleA.js", source: "module source code..." },
//   { path: "path/to/moduleB.js", source: "..." },
//   ...
// ]
```

### 支持的打包格式

- 标准 Browserify wrapper 形式的 bundle。
- 简单 AMD 形式：

  ```js
  define("path/to/module.js", function (require, module, exports) {
    // module body
  });
  ```

如果输入既不是 Browserify 也不是 AMD，库会直接返回原始模块，不做强制解包。

## 路径还原示例（Path reconstruction）

本项目的一个核心能力是：根据 bundle 中的模块 id 和相对 `require(...)` 调用，
尽可能还原模块之间的**路径结构关系**。

你可以使用内置示例来观察这一点：

```bash
node examples/inspect-paths.js ./examples/browserify-bundle.js ./examples/amd-bundle.js
```

典型输出：

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

可以看到：

- Browserify 示例中，入口模块 `1` 通过相对路径 `./lib/add`、`../shared/log` 逐步还原出了
  `parent-1/lib/add`、`parent-1/shared/log` 这种层级关系；
- AMD 示例中，模块 id `examples/amd/app/main.js` / `examples/amd/app/util/math.js`
  会直接作为路径使用。

## 内部工作原理（概览）

- `unpack/recursive.js`  
  解析顶层代码，判断是 Browserify 还是 AMD，并递归下钻到内层 bundle。

- `unpack/browserify.js` / `unpack/amd.js`  
  针对不同打包格式，把 bundle 还原成统一的模块图结构。

- `unpack/pathResolver.js`  
  构建一个虚拟文件树（FileTree），把模块 id 与 `require(...)` 的相对路径组合起来，
  尽可能推导出合理的文件路径，并处理多 bundle / 多别名等冲突情况。

- `unpack/utils.js`  
  提供一些 AST 级别的辅助函数（如参数还原）。

- `plugins/rename-exports.js`  
  一个 Babel 插件，CLI 在写出文件前会用它把 `exports.xxx = LocalName` 等形式的导出
  尽量重命名为更接近源码语义的名字（例如 `class MyClass {}`）。

## 项目结构

- `index.js`：主库入口，导出 `unpackBundle` / `unpackBundles`。
- `bin/unpack-bundle.js`：CLI 实现，对应 `unpack-bundle` 命令。
- `cli.js`：向后兼容的薄封装，内部转发到 `bin/unpack-bundle.js`。
- `unpack/`：核心解包逻辑（Browserify / AMD / 递归解包 / 路径还原）。
- `plugins/`：CLI 使用的 Babel 插件。
- `examples/`：用于演示路径还原的极简 bundle 示例与辅助脚本。
- `test/`：更大、更接近真实项目的 bundle 示例（主要用于开发时手动测试）。

## 开发与发布

安装依赖：

```bash
npm install
```

本地运行 CLI 示例：

```bash
node bin/unpack-bundle.js ./examples/browserify-bundle.js ./out/browserify
```

发布流程（概览）：

- 提交信息使用类似 `feat: ...` / `fix: ...` 的 Conventional Commits 风格；
- 项目使用 `standard-version` 自动维护版本号和 `CHANGELOG.md`；
- 可以在本地执行：

  ```bash
  npm run release
  git push --follow-tags origin main
  npm publish
  ```

- 或使用 GitHub Actions 中的 **Release** 工作流，自动：
  - 更新版本号和 changelog；
  - 创建 GitHub Release（自动生成 Release Notes）。

之后你可以根据新 tag 选择在本地或其他 CI 流程中手动执行 `npm publish`。

更详细的贡献规范与 Git 流程，请参考中文文档 `CONTRIBUTING.md`，
或英文文档 `CONTRIBUTING.en.md`。
