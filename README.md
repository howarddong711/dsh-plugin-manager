<div align="right"><a href="README.en.md">English</a></div>

# DSH Plugin Manager

面向 [DeepSeek Harness](https://www.deepseek.com/harness/) 的开源插件管理器。

DSH Plugin Manager 把社区插件的发现、安装和生命周期管理集中到 DSH Web UI 中：

- 浏览社区插件市场；
- 安装前检查 DSH 版本、平台和权限；
- 从 GitHub 或 npm 安装插件；
- 按 DSH profile 启用或禁用插件；
- 更新时使用 staging 和备份；
- 更新失败后回滚包文件与 profile 状态；
- 查看完整操作日志。

宿主端使用 DSH 官方 `webServer` 路由服务，浏览器端使用 DSH 官方 settings slots，因此插件管理器会显示在现有的 Web UI 设置页中。

## 在 DSH 中安装

对使用 `web` profile 的 DSH：

```sh
dsh plugin --profile web add github:howarddong711/dsh-plugin-manager
```

安装后重启 DSH，然后打开“设置 → Plugin Manager”。

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

## 开发

```sh
npm install
npm test
npm start
npm pack --dry-run
```

`npm start` 是包级 smoke command。安装到 DSH 后，宿主服务器和浏览器运行时由 DSH 提供。

管理器的宿主 API 位于 `/api/dsh-plugin-manager`：

```text
GET  /plugins?query=...
GET  /installed
GET  /status
GET  /plan?id=owner/repository
GET  /operations
POST /refresh
POST /action
```

## 安全提示

安装第三方插件意味着在 DSH profile 中运行第三方代码。管理器默认不执行 npm lifecycle scripts，构建步骤必须显式传入 `allowScripts`。启用陌生插件前，请检查代码仓库、权限、依赖变更和安装预览。

这是非官方社区项目，与 DeepSeek 无隶属关系。

## License

MIT，详见 [LICENSE](LICENSE)。
