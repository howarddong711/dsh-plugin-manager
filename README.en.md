# DSH Plugin Manager

Public plugin management for [DeepSeek Harness](https://www.deepseek.com/harness/).

**中文文档：[README.md](README.md)**

DSH Plugin Manager adds a settings page and a safe lifecycle for community plugins:

- browse the community registry;
- preview compatibility and requested permissions;
- install from GitHub or npm;
- enable or disable plugins per DSH profile;
- update with staging and package backups;
- roll back failed updates and restore profile state;
- inspect operation history.

The host entry uses DSH's `webServer` route service. The browser entry uses DSH's settings slots, so the manager appears inside the existing Web UI settings shell.

## Install in DSH

From a DSH installation with the `web` profile:

```sh
dsh plugin --profile web add github:howarddong711/dsh-plugin-manager
```

Restart DSH after installation and open Settings → Plugin Manager.

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
GET  /plugins?query=...
GET  /installed
GET  /status
GET  /plan?id=owner/repository
GET  /operations
POST /refresh
POST /action
```

## Security

Installing a third-party plugin executes code in the DSH profile. The manager does not run npm lifecycle scripts by default; build steps require an explicit `allowScripts` option. Review the repository, permissions, dependency changes, and install preview before enabling an unfamiliar plugin.

This is an unofficial community project and is not affiliated with DeepSeek.

## License

MIT. See [LICENSE](LICENSE).
