# 贡献指南

[简体中文](CONTRIBUTING.md) · [English](CONTRIBUTING.en.md)

感谢你愿意为本项目贡献代码或反馈问题！

本项目是一个用于解包 JavaScript Bundle（Browserify / AMD）的 Node.js 小工具，
目标是：代码简单、行为稳定、易于理解和维护。

## 如何报告 Bug

1. 先在 issue 中搜索，看是否已经有人报告过类似问题。
2. 如果没有，请尽量提供：
   - Node.js 版本
   - 操作系统信息
   - 尝试解包的 bundle 文件（或最小可复现的示例）
   - 运行的命令及完整输出

如果你能把 bundle 精简成“最小仍能复现问题”的版本，会非常有帮助。

## 如何提交修改

1. Fork 仓库，并基于 `develop` 分支创建新分支：

   - `feature/...`：新功能
   - `fix/...`：缺陷修复
   - `chore/...`：工具、CI、文档等维护性改动

2. 修改代码时尽量让每个提交**聚焦一个主题**。
3. 在提交前运行至少一条验证命令：

   - 如果定义了 `test` 脚本：

     ```bash
     npm test
     ```

   - 最少也要跑一下 README 中的 CLI 示例，例如：

     ```bash
     node bin/unpack-bundle.js ./examples/browserify-bundle.js ./out/browserify
     node bin/unpack-bundle.js ./examples/amd-bundle.js ./out/amd
     ```

4. 向 `develop` 分支发起 Pull Request，并在描述中说明：
   - 这次修改做了什么；
   - 为什么要做这个修改；
   - 是否存在潜在的兼容性变化。

## Git 工作流与历史

- 分支角色：
  - `main`：稳定分支，用于打发布 tag（如 `v1.0.0`、`v1.0.1`）。
  - `develop`：日常开发的集成分支。
  - `feature/*`：新功能（例如 `feature/add-path-examples`）。
  - `fix/*`：缺陷修复（例如 `fix/handle-cross-bundle-id-conflicts`）。
  - `chore/*`：工具、CI、文档等维护工作。

- 推荐工作流：
  1. 从 `develop` 起步（`git checkout develop`）。
  2. 创建主题分支（`feature/...`、`fix/...` 或 `chore/...`）。
  3. 保持提交小而专一，避免提交生成的构建产物。
  4. 在发起 PR 前，将分支 rebase 到最新的 `develop`。
  5. 合并时尽量使用 squash merge 或少量结构清晰的提交。

- 提交信息约定（类似 Conventional Commits）：
  - 使用前缀：
    - `feat: add path reconstruction examples`
    - `fix: handle empty browserify module objects`
    - `docs: document CLI logging options`
    - `refactor: simplify FileTree merge logic`
    - `test: add examples-based smoke tests`
    - `chore: update dependencies`
  - 使用英文、祈使语（用 “add”，不要用 “added”）。
  - 修修补补的提交在合并前尽量 squash 成一个。

- 发布（Release）：
  - 项目使用 `standard-version` 自动维护版本号和 `CHANGELOG.md`。
  - 提交信息遵循上述前缀，便于自动工具正确分类变更。
  - 有两种发布方式：

    1. **本地通过 npm 脚本发布**

       - 确认 `main` 已包含所有需要发布的提交，且工作区干净；
       - 然后执行：

         ```bash
         npm run release
         git push --follow-tags origin main
         npm publish
         ```

    2. **通过 GitHub Actions（推荐仓库托管在 GitHub 时使用）**

       - 打开仓库页面，进入 **Actions → Release**；
       - 点击 **Run workflow** 触发发布；
       - 工作流会自动：
         - 安装依赖；
         - 运行测试（如未定义测试则给出提示但不中断发布）；
         - 运行 `standard-version`，更新版本号和 `CHANGELOG.md`；
         - 将发布提交和 tag 推回 `main`；
         - 创建带自动 Release Notes 的 GitHub Release。
       - 然后你可以在本地或单独的 CI 步骤中使用新的 tag 手动发布到 npm（如果需要）。

## 代码风格

- 参考现有代码风格，保持一致；
- 更倾向于小而专一的函数，而不是超长函数；
- 只在必要时添加注释，解释不明显的逻辑，而不是陈述显而易见的事情。

## 测试

- 修 Bug 或加功能时，请一并补充或更新测试（如果项目未来增加测试基础设施）；
- 测试应保持体量小、可重复、运行快速。

## 行为准则（Code of conduct）

- 在任何交流中保持尊重和建设性；
- 友善对待其他使用者和贡献者；
- 不接受任何形式的骚扰、歧视或人身攻击。
