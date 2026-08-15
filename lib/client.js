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
		//#region src/dsh-client.js
		const inject = ["slots"];
		const sectionLabel = "Plugin Manager";
		function confirmAction(message) {
			return typeof globalThis.confirm !== "function" || globalThis.confirm(message);
		}
		function button(label, onClick, disabled = false, key) {
			return (0, react.createElement)("button", {
				key,
				type: "button",
				onClick,
				disabled
			}, label);
		}
		function pluginCard(plugin, installed, busy, onAction) {
			const current = installed?.[plugin.id];
			const actions = [];
			if (!current) actions.push(button("Install", () => onAction("install", plugin), busy, "install"));
			else {
				actions.push(button(current.enabled ? "Disable" : "Enable", () => onAction(current.enabled ? "disable" : "enable", plugin), busy, "toggle"));
				actions.push(button("Update", () => onAction("update", plugin), busy, "update"));
				if (current.previousState) actions.push(button("Rollback", () => onAction("rollback", plugin), busy, "rollback"));
				actions.push(button("Uninstall", () => onAction("uninstall", plugin), busy, "uninstall"));
			}
			return (0, react.createElement)("article", {
				key: plugin.id,
				style: {
					borderBottom: "1px solid #ddd",
					padding: "12px 0"
				}
			}, [
				(0, react.createElement)("div", {
					key: "heading",
					style: {
						display: "flex",
						justifyContent: "space-between",
						gap: "12px"
					}
				}, [(0, react.createElement)("strong", { key: "name" }, plugin.name ?? plugin.id), (0, react.createElement)("small", { key: "kind" }, plugin.kind ?? "unknown")]),
				plugin.description ? (0, react.createElement)("p", { key: "description" }, plugin.description) : null,
				(0, react.createElement)("small", { key: "meta" }, current ? `${current.enabled ? "Enabled" : "Disabled"} · ${current.version ?? "version unknown"}` : `${plugin.version ?? "version unknown"} · ${plugin.repository ?? plugin.id}`),
				(0, react.createElement)("div", {
					key: "actions",
					style: {
						display: "flex",
						gap: "8px",
						marginTop: "8px",
						flexWrap: "wrap"
					}
				}, actions)
			]);
		}
		function ManagerSection() {
			const api = (0, react.useMemo)(() => createManagerClient(), []);
			const [tab, setTab] = (0, react.useState)("discover");
			const [query, setQuery] = (0, react.useState)("");
			const [plugins, setPlugins] = (0, react.useState)([]);
			const [installed, setInstalled] = (0, react.useState)([]);
			const [operations, setOperations] = (0, react.useState)([]);
			const [profile, setProfile] = (0, react.useState)("web");
			const [busy, setBusy] = (0, react.useState)(false);
			const [error, setError] = (0, react.useState)("");
			const installedById = (0, react.useMemo)(() => new Map(installed.map((plugin) => [plugin.id, plugin])), [installed]);
			async function refresh() {
				const [discovered, installedResult, status] = await Promise.all([
					api.list(query),
					api.installed(),
					api.status()
				]);
				setPlugins(discovered.plugins ?? []);
				setInstalled(installedResult.plugins ?? []);
				setProfile(status.profile ?? "web");
			}
			(0, react.useEffect)(() => {
				let active = true;
				setError("");
				refresh().catch((cause) => {
					if (active) setError(cause.message);
				});
				return () => {
					active = false;
				};
			}, [query]);
			async function runAction(action, plugin) {
				if (busy) return;
				setBusy(true);
				setError("");
				try {
					if (action === "install") {
						const { plan } = await api.plan(plugin.id);
						const warning = plan.preflight.warnings.length > 0 ? `\nWarnings: ${plan.preflight.warnings.join("; ")}` : "";
						if (!confirmAction(`Install ${plugin.name}?\n\n${plan.actions.join("\n")}${warning}`)) return;
					} else if (action === "uninstall" && !confirmAction(`Uninstall ${plugin.name}?`)) return;
					await api.action(action, plugin.id);
					await refresh();
					setTab("installed");
				} catch (cause) {
					setError(cause.message);
				} finally {
					setBusy(false);
				}
			}
			const rows = tab === "logs" ? [(0, react.createElement)("pre", {
				key: "logs",
				style: { whiteSpace: "pre-wrap" }
			}, JSON.stringify(operations, null, 2))] : (tab === "installed" ? installed : plugins).map((plugin) => pluginCard(plugin, installedById.get(plugin.id), busy, runAction));
			(0, react.useEffect)(() => {
				if (tab !== "logs") return void 0;
				let active = true;
				api.operations().then((result) => {
					if (active) setOperations(result.operations ?? []);
				}).catch((cause) => {
					if (active) setError(cause.message);
				});
				return () => {
					active = false;
				};
			}, [tab]);
			return (0, react.createElement)("div", { style: {
				display: "grid",
				gap: "12px"
			} }, [
				(0, react.createElement)("div", {
					key: "header",
					style: {
						display: "flex",
						justifyContent: "space-between",
						gap: "12px",
						alignItems: "center"
					}
				}, [(0, react.createElement)("div", { key: "title" }, [(0, react.createElement)("strong", { key: "name" }, sectionLabel), (0, react.createElement)("small", {
					key: "profile",
					style: { display: "block" }
				}, `Profile: ${profile}`)]), button("Refresh", () => {
					api.refresh().then(refresh).catch((cause) => setError(cause.message));
				}, busy, "refresh")]),
				(0, react.createElement)("nav", {
					key: "tabs",
					style: {
						display: "flex",
						gap: "8px"
					}
				}, [
					button("Discover", () => setTab("discover"), busy, "discover"),
					button("Installed", () => setTab("installed"), busy, "installed"),
					button("Logs", () => setTab("logs"), busy, "logs")
				]),
				tab !== "logs" ? (0, react.createElement)("input", {
					key: "search",
					value: query,
					placeholder: "Search plugins",
					onChange: (event) => setQuery(event.target.value)
				}) : null,
				error ? (0, react.createElement)("p", {
					key: "error",
					role: "alert",
					style: { color: "#b42318" }
				}, error) : null,
				(0, react.createElement)("div", { key: "list" }, rows.length > 0 ? rows : (0, react.createElement)("p", { key: "empty" }, "No plugins found."))
			]);
		}
		function apply(ctx) {
			ctx.slots.inject("settings.section", () => ctx.slots.register({
				name: "settings.section",
				id: "dsh-plugin-manager",
				order: 80,
				label: sectionLabel
			}, ManagerSection));
		}
		//#endregion
		exports.ManagerSection = ManagerSection;
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map