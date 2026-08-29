# pi-tui

为 [Pi](https://github.com/badlogic/pi-mono) 提供完整的终端界面增强：传统长方形输入框、项目与 Git 状态、会话遥测，以及供应商余额与订阅额度。主题使用 Pi 宿主自身提供的主题。

> 当前公开版本为 `v0.0.1`。安装前请阅读本页的隐私说明；Pi 扩展与 Pi 进程拥有相同的本机权限。

## 公开仓结构

```text
pi-src/       # Pi 插件源码、测试和编译产物
packages/     # Pi 与其它宿主共用的供应商能力
```

安装入口是根目录 `package.json`；用户不需要安装或维护源码目录中的开发依赖。

## 功能

- 保留 Pi 原生输入、历史、自动补全、粘贴、快捷键和 IME 行为，只替换界面外壳。
- 输入框顶边显示供应商、模型、Thinking、API 余额和订阅额度。
- 输入框下方显示项目路径、Git 状态和会话遥测；后台 Git 刷新不会让状态行反复跳动。
- 回复尾保存首 Token 延迟、生成速度、Token、Cache 和预估费用，不进入模型上下文。
- 复用同一套供应商查询代码，展示可用的 API 余额和订阅窗口；切换账号后立即隔离旧数据。
- 冷启动和 `/reload` 期间隐藏宿主中间帧，准备完成后一次揭示完整界面。

## 安装

要求：Pi `0.84.2` 至 `0.84.x`，Node.js `22.19+`。

```bash
pi install git:github.com/buyi1net/pi-tui
```

安装后重启 Pi。插件首次启动时会把自身调整到全局 `packages` 列表首位，使界面闸门尽早加载；其它包的顺序保持不变。禁止自动调整：

```json
{
  "piTuiKeepPackageOrder": true
}
```

也可以设置环境变量 `PI_TUI_KEEP_PACKAGE_ORDER=1`。

## 更新与卸载

更新时重新安装 GitHub 默认分支：

```bash
pi install git:github.com/buyi1net/pi-tui
```

卸载：

```bash
pi remove git:github.com/buyi1net/pi-tui
```

卸载或停用后，插件会恢复 Pi 默认的 Editor、Footer、工作指示器和终端光标状态。

## 配置

插件不内置主题，主题通过 Pi 原生 `/settings` 切换。插件配置位于 Pi 全局配置目录中的 `pi-tui.json`；修改后执行 `/reload`。环境变量优先于配置文件。

常用环境变量：

- `PI_UI_STATUS_PRESET=minimal|default|full`：选择状态预设。
- `PI_UI_STATUS_SEGMENTS=<逗号列表>`：控制状态段和区域内顺序。
- `PI_TUI_KEEP_PACKAGE_ORDER=1`：禁止自动调整包顺序。

## 隐私与安全

- Git 与 Runtime 查询只在本机执行。
- 供应商查询使用 Pi 当前模型注册表解析后的地址与凭据；未知地址不会被探测，也不会把凭据发送到其它域名。
- 缓存只保存不可逆账号指纹和归一化用量快照，不保存 API Key 原文。
- 会话遥测作为 Pi 自定义条目保存在本机会话文件中，不会进入模型上下文。
- 详细边界见 [PRIVACY.md](./PRIVACY.md)。

## 反馈

请在 [GitHub Issues](https://github.com/buyi1net/pi-tui/issues) 报告问题，并附上 Pi 版本、操作系统、终端名称和复现步骤。不要上传 API Key、完整配置或包含凭据的日志。

## License

[MIT](./LICENSE)。
