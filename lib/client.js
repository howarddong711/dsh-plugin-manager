window.__ModuleLoader__.load({
	id: "dsh-plugin-manager",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		//#region src/client.js
		function createManagerClient({ fetchImpl = globalThis.fetch, basePath = "/api/dsh-plugin-manager" } = {}) {
			if (typeof fetchImpl !== "function") throw new TypeError("fetchImpl is required");
			const request = async (path, options) => {
				const response = await fetchImpl(`${basePath}${path}`, {
					...options,
					headers: {
						"content-type": "application/json",
						...options?.headers ?? {}
					}
				});
				const payload = await response.json();
				if (!response.ok) throw new Error(payload.error ?? `Request failed: ${response.status}`);
				return payload;
			};
			return {
				list: (query = "") => request(`/plugins?query=${encodeURIComponent(query)}`),
				installed: () => request("/installed"),
				status: () => request("/status"),
				plan: (id) => request(`/plan?id=${encodeURIComponent(id)}`),
				refresh: () => request("/refresh", {
					method: "POST",
					body: "{}"
				}),
				operations: () => request("/operations"),
				action: (action, id, options = {}) => request("/action", {
					method: "POST",
					body: JSON.stringify({
						action,
						id,
						options
					})
				})
			};
		}
		//#endregion
		//#region src/locales.js
		const zh = {
			managerTab: "插件管理",
			marketplaceTab: "插件市场",
			managerTitle: "插件管理",
			managerIntro: "管理当前 DSH profile 中已安装的插件。",
			marketplaceTitle: "插件市场",
			marketplaceIntro: "浏览社区插件并一键安装。",
			profile: "Profile：{profile}",
			refresh: "刷新",
			refreshMarket: "刷新市场",
			searchInstalled: "搜索已安装插件",
			searchMarketplace: "搜索插件",
			installedView: "已安装",
			logsView: "操作日志",
			installed: "已安装",
			enabled: "已启用",
			disabled: "已停用",
			install: "安装",
			enable: "启用",
			disable: "停用",
			update: "更新",
			rollback: "回滚",
			uninstall: "卸载",
			noInstalled: "暂未安装插件。",
			noResults: "没有找到匹配的插件。",
			versionUnknown: "版本未知",
			kindWebClient: "Web 客户端",
			kindCordisBundle: "Cordis 组合包",
			kindUnknown: "未知类型",
			confirmInstall: "确定安装“{name}”吗？",
			confirmUninstall: "确定卸载“{name}”吗？",
			warnings: "警告",
			errorPrefix: "操作失败",
			ariaViews: "插件管理视图",
			ariaPluginActions: "插件操作"
		};
		const en = {
			managerTab: "Plugin management",
			marketplaceTab: "Plugin marketplace",
			managerTitle: "Plugin management",
			managerIntro: "Manage plugins installed in the current DSH profile.",
			marketplaceTitle: "Plugin marketplace",
			marketplaceIntro: "Browse community plugins and install them with one click.",
			profile: "Profile: {profile}",
			refresh: "Refresh",
			refreshMarket: "Refresh marketplace",
			searchInstalled: "Search installed plugins",
			searchMarketplace: "Search plugins",
			installedView: "Installed",
			logsView: "Operation logs",
			installed: "Installed",
			enabled: "Enabled",
			disabled: "Disabled",
			install: "Install",
			enable: "Enable",
			disable: "Disable",
			update: "Update",
			rollback: "Rollback",
			uninstall: "Uninstall",
			noInstalled: "No plugins installed yet.",
			noResults: "No matching plugins found.",
			versionUnknown: "Version unknown",
			kindWebClient: "Web client",
			kindCordisBundle: "Cordis bundle",
			kindUnknown: "Unknown type",
			confirmInstall: "Install “{name}”?",
			confirmUninstall: "Uninstall “{name}”?",
			warnings: "Warnings",
			errorPrefix: "Operation failed",
			ariaViews: "Plugin management views",
			ariaPluginActions: "Plugin actions"
		};
		//#endregion
		//#region src/dsh-client.js
		const inject = ["slots", "locale"];
		const LOCALE_NAMESPACE = "dsh-plugin-manager";
		const MARKETPLACE_MODE = "marketplace";
		const MANAGER_MODE = "manager";
		function confirmAction(message) {
			return typeof globalThis.confirm !== "function" || globalThis.confirm(message);
		}
		function button(label, onClick, disabled = false, key, extra = {}) {
			const style = {
				border: "1px solid var(--dsw-alias-border-l2, #d9d9d9)",
				background: "var(--dsw-alias-bg-base, #fff)",
				color: "var(--dsw-alias-label-primary, inherit)",
				borderRadius: "8px",
				padding: "6px 10px",
				cursor: disabled ? "default" : "pointer",
				...extra.style
			};
			return (0, react.createElement)("button", {
				key,
				type: "button",
				onClick,
				disabled,
				...extra,
				style
			}, label);
		}
		function kindLabel(kind, t) {
			if (kind === "web-client") return t("kindWebClient");
			if (kind === "cordis-bundle") return t("kindCordisBundle");
			return t("kindUnknown");
		}
		function matchesQuery(plugin, query) {
			const normalized = query.trim().toLowerCase();
			if (!normalized) return true;
			return [
				plugin.id,
				plugin.name,
				plugin.description,
				plugin.repository,
				plugin.kind
			].filter(Boolean).join(" ").toLowerCase().includes(normalized);
		}
		function pluginCard({ plugin, current, mode, busy, onAction, t }) {
			const actions = [];
			const name = plugin.name ?? plugin.id;
			if (mode === MARKETPLACE_MODE) actions.push(current ? (0, react.createElement)("span", {
				key: "installed",
				style: {
					color: "var(--dsw-alias-state-success-primary, #16a34a)",
					padding: "6px 0"
				}
			}, current.enabled ? t("installed") : `${t("installed")} · ${t("disabled")}`) : button(t("install"), () => onAction("install", plugin), busy, "install"));
			else {
				actions.push(button(current.enabled ? t("disable") : t("enable"), () => onAction(current.enabled ? "disable" : "enable", plugin), busy, "toggle"));
				actions.push(button(t("update"), () => onAction("update", plugin), busy, "update"));
				if (current.previousState) actions.push(button(t("rollback"), () => onAction("rollback", plugin), busy, "rollback"));
				actions.push(button(t("uninstall"), () => onAction("uninstall", plugin), busy, "uninstall"));
			}
			const metadata = current ? `${current.enabled ? t("enabled") : t("disabled")} · ${current.version ?? t("versionUnknown")}` : `${plugin.version ?? t("versionUnknown")} · ${plugin.repository ?? plugin.id}`;
			return (0, react.createElement)("article", {
				key: plugin.id,
				style: {
					border: "1px solid var(--dsw-alias-border-l2, #e1e1e1)",
					borderRadius: "12px",
					padding: "14px",
					display: "grid",
					gap: "8px",
					minWidth: 0,
					background: "var(--dsw-alias-bg-base, #fff)"
				}
			}, [
				(0, react.createElement)("div", {
					key: "heading",
					style: {
						display: "flex",
						justifyContent: "space-between",
						gap: "12px",
						alignItems: "baseline"
					}
				}, [(0, react.createElement)("strong", {
					key: "name",
					style: {
						overflow: "hidden",
						textOverflow: "ellipsis"
					}
				}, name), (0, react.createElement)("small", {
					key: "kind",
					style: { flexShrink: 0 }
				}, kindLabel(plugin.kind, t))]),
				plugin.description ? (0, react.createElement)("p", {
					key: "description",
					style: {
						margin: 0,
						lineHeight: 1.5
					}
				}, plugin.description) : null,
				(0, react.createElement)("small", {
					key: "meta",
					style: { color: "var(--dsw-alias-label-secondary, #777)" }
				}, metadata),
				(0, react.createElement)("div", {
					key: "actions",
					role: "group",
					"aria-label": t("ariaPluginActions"),
					style: {
						display: "flex",
						gap: "8px",
						marginTop: "4px",
						flexWrap: "wrap"
					}
				}, actions)
			]);
		}
		function ManagerPanel({ mode, t }) {
			const api = (0, react.useMemo)(() => createManagerClient(), []);
			const [view, setView] = (0, react.useState)(mode === MARKETPLACE_MODE ? "marketplace" : "installed");
			const [query, setQuery] = (0, react.useState)("");
			const [plugins, setPlugins] = (0, react.useState)([]);
			const [installed, setInstalled] = (0, react.useState)([]);
			const [operations, setOperations] = (0, react.useState)([]);
			const [profile, setProfile] = (0, react.useState)("web");
			const [busy, setBusy] = (0, react.useState)(false);
			const [error, setError] = (0, react.useState)("");
			const installedById = (0, react.useMemo)(() => new Map(installed.map((plugin) => [plugin.id, plugin])), [installed]);
			async function load() {
				const status = await api.status();
				setProfile(status.profile ?? "web");
				if (mode === MARKETPLACE_MODE) {
					const [discovered, installedResult] = await Promise.all([api.list(query), api.installed()]);
					setPlugins(discovered.plugins ?? []);
					setInstalled(installedResult.plugins ?? []);
				} else if (view === "logs") {
					const result = await api.operations();
					setOperations(result.operations ?? []);
				} else {
					const result = await api.installed();
					setInstalled(result.plugins ?? []);
				}
			}
			(0, react.useEffect)(() => {
				let active = true;
				setError("");
				load().catch((cause) => {
					if (active) setError(`${t("errorPrefix")}: ${cause.message}`);
				});
				return () => {
					active = false;
				};
			}, [
				mode,
				query,
				view
			]);
			async function runAction(action, plugin) {
				if (busy) return;
				setBusy(true);
				setError("");
				try {
					if (action === "install") {
						const { plan } = await api.plan(plugin.id);
						const warning = plan.preflight.warnings.length > 0 ? `\n\n${t("warnings")}: ${plan.preflight.warnings.join("; ")}` : "";
						const details = plan.actions.length > 0 ? `\n\n${plan.actions.join("\n")}` : "";
						if (!confirmAction(`${t("confirmInstall", { name: plugin.name ?? plugin.id })}${details}${warning}`)) return;
					} else if (action === "uninstall" && !confirmAction(t("confirmUninstall", { name: plugin.name ?? plugin.id }))) return;
					await api.action(action, plugin.id);
					await load();
				} catch (cause) {
					setError(`${t("errorPrefix")}: ${cause.message}`);
				} finally {
					setBusy(false);
				}
			}
			async function refreshMarketplace() {
				if (busy) return;
				setBusy(true);
				setError("");
				try {
					await api.refresh();
					await load();
				} catch (cause) {
					setError(`${t("errorPrefix")}: ${cause.message}`);
				} finally {
					setBusy(false);
				}
			}
			const visible = (mode === MARKETPLACE_MODE ? plugins : installed).filter((plugin) => matchesQuery(plugin, query));
			const rows = mode === MANAGER_MODE && view === "logs" ? [(0, react.createElement)("pre", {
				key: "logs",
				style: {
					whiteSpace: "pre-wrap",
					margin: 0,
					padding: "12px",
					borderRadius: "8px",
					background: "var(--dsw-alias-bg-secondary, #f7f7f7)",
					overflow: "auto"
				}
			}, JSON.stringify(operations, null, 2))] : visible.map((plugin) => pluginCard({
				plugin,
				current: installedById.get(plugin.id),
				mode,
				busy,
				onAction: runAction,
				t
			}));
			return (0, react.createElement)("div", { style: {
				display: "grid",
				gap: "14px"
			} }, [
				(0, react.createElement)("div", {
					key: "header",
					style: {
						display: "flex",
						justifyContent: "space-between",
						gap: "12px",
						alignItems: "flex-start"
					}
				}, [(0, react.createElement)("div", { key: "title" }, [
					(0, react.createElement)("strong", {
						key: "name",
						style: {
							display: "block",
							fontSize: "16px"
						}
					}, t(mode === MARKETPLACE_MODE ? "marketplaceTitle" : "managerTitle")),
					(0, react.createElement)("small", {
						key: "intro",
						style: {
							display: "block",
							marginTop: "4px"
						}
					}, t(mode === MARKETPLACE_MODE ? "marketplaceIntro" : "managerIntro")),
					(0, react.createElement)("small", {
						key: "profile",
						style: {
							display: "block",
							marginTop: "4px"
						}
					}, t("profile", { profile }))
				]), button(mode === MARKETPLACE_MODE ? t("refreshMarket") : t("refresh"), mode === MARKETPLACE_MODE ? refreshMarketplace : () => {
					load().catch((cause) => setError(`${t("errorPrefix")}: ${cause.message}`));
				}, busy, "refresh")]),
				mode === MANAGER_MODE ? (0, react.createElement)("nav", {
					key: "views",
					role: "tablist",
					"aria-label": t("ariaViews"),
					style: {
						display: "flex",
						gap: "8px"
					}
				}, [button(t("installedView"), () => setView("installed"), busy, "installed-view", {
					role: "tab",
					"aria-selected": view === "installed"
				}), button(t("logsView"), () => setView("logs"), busy, "logs-view", {
					role: "tab",
					"aria-selected": view === "logs"
				})]) : null,
				(0, react.createElement)("input", {
					key: "search",
					value: query,
					placeholder: t(mode === MARKETPLACE_MODE ? "searchMarketplace" : "searchInstalled"),
					"aria-label": t(mode === MARKETPLACE_MODE ? "searchMarketplace" : "searchInstalled"),
					onChange: (event) => setQuery(event.target.value),
					style: {
						width: "100%",
						boxSizing: "border-box",
						border: "1px solid var(--dsw-alias-border-l2, #d9d9d9)",
						borderRadius: "10px",
						padding: "10px 12px",
						background: "var(--dsw-alias-bg-base, #fff)",
						color: "var(--dsw-alias-label-primary, inherit)"
					}
				}),
				error ? (0, react.createElement)("p", {
					key: "error",
					role: "alert",
					style: {
						color: "var(--dsw-alias-state-error-primary, #b42318)",
						margin: 0
					}
				}, error) : null,
				(0, react.createElement)("div", {
					key: "list",
					style: {
						display: "grid",
						gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
						gap: "12px"
					}
				}, rows.length > 0 ? rows : (0, react.createElement)("p", { key: "empty" }, mode === MANAGER_MODE ? t("noInstalled") : t("noResults")))
			]);
		}
		function apply(ctx) {
			ctx.effect(() => ctx.locale.register(LOCALE_NAMESPACE, {
				zh,
				en
			}), "dsh-plugin-manager: locale dictionaries");
			const t = ctx.locale.bind(LOCALE_NAMESPACE);
			ctx.slots.inject("settings.plugins.tab", function* () {
				yield ctx.slots.register({
					name: "settings.plugins.tab",
					id: "dsh-plugin-manager",
					order: 20,
					label: () => t("managerTab"),
					locale: LOCALE_NAMESPACE
				}, (props) => (0, react.createElement)(ManagerPanel, {
					...props,
					mode: MANAGER_MODE
				}));
				yield ctx.slots.register({
					name: "settings.plugins.tab",
					id: "dsh-plugin-marketplace",
					order: 30,
					label: () => t("marketplaceTab"),
					locale: LOCALE_NAMESPACE
				}, (props) => (0, react.createElement)(ManagerPanel, {
					...props,
					mode: MARKETPLACE_MODE
				}));
			});
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map