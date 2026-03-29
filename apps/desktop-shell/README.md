# @dingclaw/desktop-shell

DingClaw 的应用端主入口。

当前这版聚焦于最小可运行闭环：

- 启动或附着现有 OpenClaw Gateway
- 展示终端风格日志
- 从程序内打开管理端

## 运行

在仓库根目录执行：

```bash
pnpm desktop:dev
```

或直接在应用目录执行：

```bash
pnpm dev
```

默认行为：

- 使用系统 `node` 启动仓库根目录 `scripts/run-node.mjs`
- 默认命令为 `gateway --port 18789 --verbose`
- 如检测到已有网关实例，则进入附着模式
- 点击“进入管理端”会打开 `http://127.0.0.1:18789/`

## 环境变量

- `OPENCLAW_DESKTOP_NODE_PATH`

  可选。用于显式指定桌面壳启动网关时使用的 `node` 可执行文件路径。

## 当前边界

- 当前管理端复用现有 `gateway + control-ui`
- 还未切换到最终企业版 `apps/admin-console`
- 还未完成内嵌运行时和正式打包链
