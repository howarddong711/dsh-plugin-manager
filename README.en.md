# DSH Plugin Manager

Public plugin management for [DeepSeek Harness](https://www.deepseek.com/harness/).

**中文文档：[README.md](README.md)**

DSH Plugin Manager adds an independent Plugin Center page to DSH Web without changing the native DSH Plugins page:

- browse the community registry;
- open GitHub repository links and see Star counts, sorted by Stars;
- filter and sort by plugin type, name, version, or Stars;
- open plugin details with version, source, package, permissions, and requirements;
- preview compatibility and requested permissions;
- install from GitHub or npm;
- enable or disable plugins per DSH profile;
- update with staging and package backups;
- roll back failed updates and restore profile state;
- watch installation stages and live logs;
- distinguish queued, running, installed, enabled, and failed states;
- restore the profile and package files when an installation fails.
- clean staging files automatically after install, update, or uninstall operations.

The page follows DSH's default language, theme, and active profile. Marketplace, installed plugins, and operation logs live in one independent entry.

## Install in DSH

From a DSH installation with the `web` profile:

```sh
dsh plugin --profile web add github:howarddong711/dsh-plugin-manager
```

Restart DSH after installation and open Settings → Plugin Center.

For a local checkout:

```sh
dsh plugin --profile web add ./dsh-plugin-manager
```

## Configuration

The default registry is cached at `$DSH_HOME/plugin-manager/registry.json`. When no cache exists, the manager loads the public [DSH Plugins Marketplace](https://github.com/bradeGithub/DSH-Plugins-Marketplace) registry. The registry can be overridden in the profile patch:

```yaml
- id: dsh-plugin-manager
  name: dsh-plugin-manager
  config:
    profile: web
    registryPath: /absolute/path/to/registry.json
    registryUrl: https://example.com/registry.json
```

Set `registryUrl: false` to disable remote registry loading. A registry file may be an array, `{ "plugins": [] }`, or the marketplace's `{ "repos": [] }` format.

## API

The manager's host API is available under `/api/dsh-plugin-manager`:

```text
GET  /plugins?query=...&kind=...
GET  /installed
GET  /status
GET  /plan?id=owner/repository
GET  /operations              # each task includes progress (0-100) and live logs
GET  /operations/:operationId
POST /refresh
POST /action       # returns 202 and an operationId; the task runs in the background
```

## Security

Installing a third-party plugin executes code in the DSH profile. The manager does not run npm lifecycle scripts by default; build steps require an explicit `allowScripts` option. Review the repository, permissions, dependency changes, and install preview before enabling an unfamiliar plugin.

This is an unofficial community project and is not affiliated with DeepSeek.

## License

MIT. See [LICENSE](LICENSE).
