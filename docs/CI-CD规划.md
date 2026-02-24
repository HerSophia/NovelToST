# CI/CD 规划（v2）

> 目标：只保留两条核心工作流——测试（test）与构建（build），流程简单、可审计、可维护。

## 1. 目标状态（仅两条工作流）

仓库只维护以下两条工作流：

1. `test.yaml`
2. `build.yaml`

不再使用：

- 模板同步工作流
- 依赖自动升级工作流

## 2. 工作流职责划分

### 2.1 `test.yaml`（质量门禁）

触发时机：

- `pull_request` 到 `main/master`
- `push` 到 `main/master`
- 手动触发 `workflow_dispatch`

执行内容：

1. `pnpm install --frozen-lockfile`
2. `pnpm lint`
3. `pnpm build:dev`

目标：

- 在合并前尽早发现问题
- 保证基础可构建与静态检查通过

### 2.2 `build.yaml`（交付构建）

触发时机：

- `push` 到 `main/master`（忽略 `dist/**` 变更触发）
- 手动触发 `workflow_dispatch`

执行内容：

1. 清理 `dist`
2. `pnpm install --frozen-lockfile`
3. `pnpm build`
4. 自动提交 `dist` 产物

目标：

- 让仓库中的 `dist` 始终对应当前主分支源码
- 让分发（例如 jsdelivr 引用）稳定可用

## 3. 质量门禁（DoD for CI）

一个可合并 PR 至少满足：

- [ ] `test` 工作流全绿
- [ ] 影响行为的改动有文档更新（`docs/` 或计划文档）
- [ ] workflow / 构建策略改动在 PR 描述中写明风险与回滚方式

## 4. 分支保护建议

在 GitHub 分支保护规则中：

- 仅允许 PR 合并到 `main`
- 将 `test` 设为 Required status checks
- 禁止直接 push 到 `main`（管理员可按需保留例外）

## 5. 环境基线

- Node.js：24
- pnpm：10
- 安装策略：`--frozen-lockfile`

> 本地开发建议也使用同版本，减少“本地可过、CI 失败”的偏差。

## 6. 变更记录

- 2026-02-24：升级为 v2，CI/CD 缩减为 test + build 两条主流程，移除模板同步与依赖自动升级流程。
