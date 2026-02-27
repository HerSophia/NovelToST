# Ignore 策略（v3）

> 目标：明确“哪些文件该入库，哪些应忽略”，减少协作噪音与敏感信息泄漏风险。

## 1. 当前规则盘点

### 1.1 `.gitignore`

当前已忽略：

- `node_modules`
- 常见日志文件（`*.log` / `pnpm-debug.log*` 等）
- `auto-imports.d.ts`
- `components.d.ts`
- 本地 AI/Agent 工作目录：`.augment/`、`.clinerules/`、`.kilocode/`、`.roo/`、`.limcode/`
- 本地参考目录：`参考项目/`
- 本地模板与示例目录：`初始模板/`、`示例/`
- 本地敏感配置：`.vscode/launch.json`
- 本地 MCP 配置：`.mcp.json`

### 1.2 `.prettierignore`

- 忽略 `dist`

### 1.3 `.gitattributes`

- `dist/** merge=ours`
  - 作用：降低 `dist` 冲突成本，交由 CI 重打包覆盖。

## 2. 总体原则

1. **可再生文件优先忽略**，但需评估是否影响团队开发体验。
2. **机器/个人环境文件不入库**。
3. **安全优先**：任何可能暴露地址、token、私有配置的文件不得入库。
4. **变更最小化**：无明确收益不新增 ignore 规则，避免误伤必要文件。

## 3. 本地私有配置建议

对于“只在自己机器生效”的改动，优先使用：

- `git update-index --skip-worktree <file>`
- 或 `.git/info/exclude`（仅本地生效，不影响团队）

示例（当文件仍被版本管理时）：

```bash
git update-index --skip-worktree .vscode/launch.json
```

> 当前仓库已将 `.vscode/launch.json` 纳入 `.gitignore`，常规情况下不再需要额外执行该命令。

## 4. 新增 ignore 规则的准入标准

提议新增某条规则前，请在 PR 描述里回答：

1. 该文件是否可由命令自动再生？
2. 该文件是否包含个人/敏感信息？
3. 忽略后是否会影响他人开发（如缺类型、缺配置）？
4. 是否有替代方案（例如改为本地 exclude）？

## 5. 如何新增 ignore 规则（操作步骤）

### 5.1 先选作用域

1. **仅你本地生效**（不影响团队）：写入 `.git/info/exclude`。
2. **团队都应生效**：写入 `.gitignore`，并在 PR 中说明理由。

### 5.2 添加规则

- 目录建议使用尾随 `/`（如 `cache/`）；
- 单文件写相对路径（如 `.vscode/launch.json`）；
- 建议按“规则 + 注释”成组维护，便于后续追溯。

### 5.3 若文件已被 Git 追踪（关键）

仅修改 ignore 不会让已追踪文件自动消失，需要执行：

```bash
git rm --cached <file>
# 目录可用：git rm -r --cached <dir>
```

然后与 ignore 规则一起提交。

### 5.4 自检命令

```bash
git check-ignore -v <path>
git status --short
```

- `git check-ignore -v`：确认是哪一条规则命中；
- `git status --short`：确认目标文件不再进入待提交列表。

## 6. 针对本仓库的建议

- 保持“运行必需文件入库、个人环境文件忽略”的边界。
- 若后续出现新的生成产物（例如缓存目录）造成频繁噪音，再按“准入标准”逐条引入。
- 每次调整 ignore 规则时，同步更新本文档并标注日期。

## 7. 变更记录

- 2026-02-24：建立初版文档。
- 2026-02-24：升级为 v2，移除模板同步相关策略描述，聚焦当前仓库的最小规则集。
- 2026-02-24：升级为 v3，新增本地 AI/Agent 目录、参考目录与本地 launch/mcp 配置忽略规则，并从仓库追踪中移除对应文件。
- 2026-02-24：补充将 `初始模板/` 与 `示例/` 本地化（纳入 ignore 并停止远端追踪）。
- 2026-02-27：新增“如何新增 ignore 规则（操作步骤）”，补充作用域选择、已追踪文件处理与自检命令。
