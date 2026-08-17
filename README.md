<div align="right"><a href="README.en.md">English</a></div>

# DSH Plugin Manager

面向 [DeepSeek Harness](https://www.deepseek.com/harness/) 的开源插件管理器。

DSH Plugin Manager 在 DSH Web UI 中提供一个独立的“插件中心”页面，不修改 DSH 原生插件页：

- 浏览社区插件市场；
- 查看 GitHub 仓库链接和 Star 数，并按 Star 数排序；
- 按插件类型、名称、版本或 Star 数筛选和排序；
- 打开插件详情，查看版本、来源、包名、权限和运行要求；
- 安装前检查 DSH 版本、平台和权限；
- 从 GitHub 或 npm 安装插件；
- 按 DSH profile 启用或禁用插件；
- 更新时使用 staging 和备份；
- 更新失败后回滚包文件与 profile 状态；
- 安装时实时查看任务进度和安装日志；
- 区分排队中、安装中、已安装、已启用和失败状态；
- 安装失败时恢复 profile 和插件文件。
- 安装、更新或卸载完成后自动清理 staging 临时文件。

页面跟随 DSH 默认语言、主题和 profile，市场、已安装插件和任务日志集中在同一个独立入口中。

## 在 DSH 中安装

对使用 `web` profile 的 DSH：

```sh
dsh plugin --profile web add github:howarddong711/dsh-plugin-manager
```

安装后重启 DSH，然后打开“设置”中的“插件中心”。

从本地源码安装：

```sh
dsh plugin --profile web add ./dsh-plugin-manager
```

## 配置

默认 registry 缓存位置为 `$DSH_HOME/plugin-manager/registry.json`。没有缓存时，插件会加载公开的 [DSH Plugins Marketplace](https://github.com/bradeGithub/DSH-Plugins-Marketplace) registry。也可以在 profile patch 中指定自己的 registry：

```yaml
- id: dsh-plugin-manager
  name: dsh-plugin-manager
  config:
    profile: web
    registryPath: /absolute/path/to/registry.json
    registryUrl: https://example.com/registry.json
```

设置 `registryUrl: false` 可以禁用远程 registry。registry 文件支持数组、`{ "plugins": [] }`，以及 Marketplace 使用的 `{ "repos": [] }` 格式。

## 管理接口

管理器的宿主 API 位于 `/api/dsh-plugin-manager`：

```text
GET  /plugins?query=...&kind=...
GET  /installed
GET  /status
GET  /plan?id=owner/repository
GET  /operations              # 每个任务包含 progress（0-100）和实时日志
GET  /operations/:operationId
POST /refresh
POST /action       # 返回 202 和 operationId，任务在后台执行
```

## 安全提示

安装第三方插件意味着在 DSH profile 中运行第三方代码。管理器默认不执行 npm lifecycle scripts，构建步骤必须显式传入 `allowScripts`。启用陌生插件前，请检查代码仓库、权限、依赖变更和安装预览。

这是非官方社区项目，与 DeepSeek 无隶属关系。

## License

MIT，详见 [LICENSE](LICENSE)。
