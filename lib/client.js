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
				operation: (id) => request(`/operations/${encodeURIComponent(id)}`),
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
			pageTitle: "插件中心",
			pageIntro: "在一个独立页面发现、安装和管理 DSH 插件，实时看到每一步操作。",
			marketTab: "插件市场",
			installedTab: "已安装",
			activityTab: "任务日志",
			marketTitle: "发现适合你的插件",
			marketIntro: "按 GitHub Star 从高到低浏览社区插件，安装过程会在任务日志中实时显示。",
			installedTitle: "管理已安装插件",
			installedIntro: "查看插件状态，执行启用、停用、更新或卸载。",
			activityTitle: "安装任务与操作日志",
			activityIntro: "每个操作都有独立任务和日志，失败时可以直接定位原因。",
			pageNavigation: "插件中心导航",
			profile: "Profile：{profile}",
			totalPlugins: "市场插件",
			installedCount: "已安装",
			activeTasks: "进行中的任务",
			updatesAvailable: "可更新",
			searchPlugins: "搜索插件名称、作者或描述",
			kindFilter: "插件类型",
			allKinds: "全部类型",
			sortLabel: "排序方式",
			sortStars: "按 Star 排序",
			sortName: "按名称排序",
			sortVersion: "按版本排序",
			results: "个结果",
			github: "GitHub",
			stars: "★ {count}",
			starsUnknown: "★ 未知",
			versionUnknown: "版本未知",
			noDescription: "暂无简介",
			refresh: "刷新",
			refreshing: "刷新中…",
			install: "安装并启用",
			installing: "正在安装…",
			enable: "启用",
			disable: "停用",
			update: "更新",
			uninstall: "卸载",
			installed: "已安装",
			enabled: "已启用",
			disabled: "已停用",
			needsReload: "需刷新/重启",
			unsupported: "暂不支持此类型",
			noInstalled: "暂未安装插件。",
			noResults: "没有找到匹配的插件。",
			noOperations: "还没有插件操作记录。",
			noLogs: "等待安装输出…",
			latestOperation: "最近任务",
			viewActivity: "查看完整日志",
			selectOperation: "选择一个任务查看详细日志。",
			operationProgress: "任务进度",
			details: "详情",
			detailTitle: "插件详情",
			close: "关闭",
			starsLabel: "GitHub Star",
			versionLabel: "版本",
			sourceLabel: "安装来源",
			sourceNpm: "npm 包",
			sourceGithub: "GitHub 仓库",
			packageLabel: "包名",
			branchLabel: "默认分支",
			buildLabel: "需要构建",
			permissionsLabel: "权限要求",
			requirementsLabel: "运行要求",
			notProvided: "未提供",
			none: "无",
			yes: "是",
			no: "否",
			confirmInstall: "确定安装并启用“{name}”吗？",
			confirmUninstall: "确定卸载“{name}”吗？",
			warnings: "警告",
			errorPrefix: "操作失败",
			kindWebClient: "Web 客户端",
			kindCordisBundle: "Cordis 组合包",
			kindSkill: "Skill",
			kindPreset: "Preset",
			kindUnknown: "未知类型",
			action_install: "安装",
			action_enable: "启用",
			action_disable: "停用",
			action_update: "更新",
			action_rollback: "回滚",
			action_uninstall: "卸载",
			status_queued: "排队中",
			status_running: "进行中",
			status_completed: "已完成",
			status_failed: "失败",
			stage_queued: "排队中",
			stage_preflight: "检查兼容性",
			stage_download: "下载与安装依赖",
			stage_register: "注册到 DSH profile",
			stage_enable: "启用插件",
			stage_disable: "停用插件",
			stage_remove_profile: "从 profile 移除",
			stage_remove_files: "删除插件文件",
			stage_rollback: "恢复旧版本",
			stage_verify: "验证结果",
			stage_completed: "已完成",
			stage_failed: "失败"
		};
		const en = {
			pageTitle: "Plugin Center",
			pageIntro: "Discover, install, and manage DSH plugins in one independent page with visible progress.",
			marketTab: "Marketplace",
			installedTab: "Installed",
			activityTab: "Activity",
			marketTitle: "Find your next plugin",
			marketIntro: "Browse community plugins by GitHub Stars. Every install is visible in the activity log.",
			installedTitle: "Manage installed plugins",
			installedIntro: "Inspect plugin state and enable, disable, update, or uninstall it.",
			activityTitle: "Tasks and operation logs",
			activityIntro: "Every action has its own task and log so failures are easy to diagnose.",
			pageNavigation: "Plugin Center navigation",
			profile: "Profile: {profile}",
			totalPlugins: "Marketplace plugins",
			installedCount: "Installed",
			activeTasks: "Active tasks",
			updatesAvailable: "Updates available",
			searchPlugins: "Search by name, author, or description",
			kindFilter: "Plugin type",
			allKinds: "All types",
			sortLabel: "Sort order",
			sortStars: "Sort by Stars",
			sortName: "Sort by Name",
			sortVersion: "Sort by Version",
			results: "results",
			github: "GitHub",
			stars: "★ {count}",
			starsUnknown: "★ unknown",
			versionUnknown: "Version unknown",
			noDescription: "No description yet",
			refresh: "Refresh",
			refreshing: "Refreshing…",
			install: "Install and enable",
			installing: "Installing…",
			enable: "Enable",
			disable: "Disable",
			update: "Update",
			uninstall: "Uninstall",
			installed: "Installed",
			enabled: "Enabled",
			disabled: "Disabled",
			needsReload: "Refresh/restart needed",
			unsupported: "Type not supported yet",
			noInstalled: "No plugins installed yet.",
			noResults: "No matching plugins found.",
			noOperations: "No plugin operations yet.",
			noLogs: "Waiting for installation output…",
			latestOperation: "Latest task",
			viewActivity: "View full log",
			selectOperation: "Select a task to inspect its detailed log.",
			operationProgress: "Operation progress",
			details: "Details",
			detailTitle: "Plugin details",
			close: "Close",
			starsLabel: "GitHub Stars",
			versionLabel: "Version",
			sourceLabel: "Install source",
			sourceNpm: "npm package",
			sourceGithub: "GitHub repository",
			packageLabel: "Package name",
			branchLabel: "Default branch",
			buildLabel: "Build required",
			permissionsLabel: "Permissions",
			requirementsLabel: "Requirements",
			notProvided: "Not provided",
			none: "None",
			yes: "Yes",
			no: "No",
			confirmInstall: "Install and enable “{name}”?",
			confirmUninstall: "Uninstall “{name}”?",
			warnings: "Warnings",
			errorPrefix: "Operation failed",
			kindWebClient: "Web client",
			kindCordisBundle: "Cordis bundle",
			kindSkill: "Skill",
			kindPreset: "Preset",
			kindUnknown: "Unknown type",
			action_install: "Install",
			action_enable: "Enable",
			action_disable: "Disable",
			action_update: "Update",
			action_rollback: "Rollback",
			action_uninstall: "Uninstall",
			status_queued: "Queued",
			status_running: "Running",
			status_completed: "Completed",
			status_failed: "Failed",
			stage_queued: "Queued",
			stage_preflight: "Checking compatibility",
			stage_download: "Downloading and installing dependencies",
			stage_register: "Registering in DSH profile",
			stage_enable: "Enabling plugin",
			stage_disable: "Disabling plugin",
			stage_remove_profile: "Removing from profile",
			stage_remove_files: "Removing plugin files",
			stage_rollback: "Restoring previous version",
			stage_verify: "Verifying result",
			stage_completed: "Completed",
			stage_failed: "Failed"
		};
		//#endregion
		//#region src/dsh-client.js
		const inject = ["slots", "locale"];
		const LOCALE_NAMESPACE = "dsh-plugin-manager";
		const PAGE_MODE = {
			market: "market",
			installed: "installed",
			activity: "activity"
		};
		const colors = {
			ink: "var(--dsw-alias-label-primary, #172033)",
			muted: "var(--dsw-alias-label-secondary, #667085)",
			border: "var(--dsw-alias-border-l2, #e5e7eb)",
			surface: "var(--dsw-alias-bg-base, #ffffff)",
			soft: "var(--dsw-alias-bg-secondary, #f7f8fb)",
			accent: "var(--dsw-alias-brand-primary, #4f46e5)",
			success: "var(--dsw-alias-state-success-primary, #15803d)",
			warning: "var(--dsw-alias-state-warning-primary, #b45309)",
			error: "var(--dsw-alias-state-error-primary, #b42318)"
		};
		function confirmAction(message) {
			return typeof globalThis.confirm !== "function" || globalThis.confirm(message);
		}
		function formatStars(plugin) {
			const count = Number(plugin?.stars);
			return Number.isFinite(count) && count >= 0 ? new Intl.NumberFormat().format(count) : null;
		}
		function githubUrl(plugin) {
			for (const value of [plugin?.homepage, plugin?.repository]) {
				if (typeof value !== "string" || !value.trim()) continue;
				const normalized = value.trim().replace(/^github:/i, "");
				const candidate = /^https?:\/\//i.test(normalized) ? normalized : `https://github.com/${normalized}`;
				try {
					const url = new URL(candidate);
					if (url.hostname.toLowerCase() !== "github.com") continue;
					const path = url.pathname.replace(/\.git$/, "").replace(/\/$/, "");
					if (/^\/[^/]+\/[^/]+/.test(path)) return `https://github.com${path}`;
				} catch {}
			}
			return null;
		}
		function ownerOf(plugin) {
			return String(plugin?.repository ?? plugin?.id ?? "").replace(/^https?:\/\/github\.com\//i, "").replace(/^github:/i, "").split("/")[0] || "DSH";
		}
		function avatarColor(value) {
			let hash = 0;
			for (const char of String(value)) hash = (hash << 5) - hash + char.charCodeAt(0);
			const palette = [
				"#4f46e5",
				"#0f766e",
				"#c2410c",
				"#7c3aed",
				"#0369a1",
				"#be123c"
			];
			return palette[Math.abs(hash) % palette.length];
		}
		function kindLabel(kind, t) {
			if (kind === "web-client") return t("kindWebClient");
			if (kind === "cordis-bundle") return t("kindCordisBundle");
			if (kind === "skill") return t("kindSkill");
			if (kind === "preset") return t("kindPreset");
			return t("kindUnknown");
		}
		function installable(plugin) {
			return plugin?.kind === "web-client" || plugin?.kind === "cordis-bundle";
		}
		function matchesQuery(plugin, query) {
			const normalized = query.trim().toLowerCase();
			if (!normalized) return true;
			return [
				plugin.id,
				plugin.name,
				plugin.description,
				plugin.repository,
				plugin.homepage,
				plugin.kind
			].filter(Boolean).join(" ").toLowerCase().includes(normalized);
		}
		function sortPlugins(plugins, sort) {
			return [...plugins].sort((left, right) => {
				if (sort === "name") return String(left.name ?? left.id).localeCompare(String(right.name ?? right.id));
				if (sort === "version") return String(right.version ?? "").localeCompare(String(left.version ?? ""), void 0, { numeric: true });
				return Number(right.stars ?? -1) - Number(left.stars ?? -1) || String(left.name ?? left.id).localeCompare(String(right.name ?? right.id));
			});
		}
		function statusTone(status) {
			if (status === "completed" || status === "enabled" || status === "active") return "success";
			if (status === "failed") return "error";
			if (status === "queued" || status === "running" || status === "disabled") return "warning";
			return "neutral";
		}
		function Badge({ children, tone = "neutral" }) {
			const toneColors = {
				success: {
					color: colors.success,
					background: "rgba(22, 163, 74, .10)"
				},
				warning: {
					color: colors.warning,
					background: "rgba(217, 119, 6, .12)"
				},
				error: {
					color: colors.error,
					background: "rgba(220, 38, 38, .10)"
				},
				neutral: {
					color: colors.muted,
					background: colors.soft
				}
			};
			return (0, react.createElement)("span", { style: {
				display: "inline-flex",
				alignItems: "center",
				gap: "5px",
				borderRadius: "999px",
				padding: "4px 8px",
				fontSize: "11px",
				fontWeight: 700,
				whiteSpace: "nowrap",
				...toneColors[tone]
			} }, [(0, react.createElement)("span", {
				key: "dot",
				style: {
					width: "6px",
					height: "6px",
					borderRadius: "50%",
					background: "currentColor"
				}
			}), children]);
		}
		function ActionButton({ children, onClick, disabled = false, primary = false, danger = false, title }) {
			return (0, react.createElement)("button", {
				type: "button",
				onClick,
				disabled,
				title,
				style: {
					border: primary ? "1px solid transparent" : `1px solid ${colors.border}`,
					background: primary ? colors.accent : colors.surface,
					color: primary ? "#fff" : danger ? colors.error : colors.ink,
					borderRadius: "9px",
					padding: "8px 12px",
					fontSize: "12px",
					fontWeight: 700,
					cursor: disabled ? "not-allowed" : "pointer",
					opacity: disabled ? .55 : 1,
					transition: "transform .15s ease, box-shadow .15s ease",
					boxShadow: primary && !disabled ? "0 5px 12px rgba(79,70,229,.20)" : "none"
				}
			}, children);
		}
		function Avatar({ plugin }) {
			const owner = ownerOf(plugin);
			return (0, react.createElement)("div", {
				"aria-hidden": "true",
				style: {
					width: "42px",
					height: "42px",
					flexShrink: 0,
					display: "grid",
					placeItems: "center",
					borderRadius: "12px",
					color: "#fff",
					background: avatarColor(owner),
					fontSize: "17px",
					fontWeight: 800,
					boxShadow: "inset 0 0 0 1px rgba(255,255,255,.25)"
				}
			}, owner.slice(0, 1).toUpperCase());
		}
		function stageLabel(stage, t) {
			return t(`stage_${stage}`) || stage;
		}
		function operationProgress(operation) {
			if (Number.isFinite(Number(operation?.progress))) return Math.max(0, Math.min(100, Number(operation.progress)));
			if (operation?.status === "completed") return 100;
			return {
				queued: 0,
				preflight: 12,
				download: 34,
				register: 58,
				enable: 74,
				disable: 68,
				"remove-profile": 42,
				"remove-files": 70,
				rollback: 58,
				verify: 90,
				failed: 100
			}[operation?.stage] ?? 0;
		}
		function ProgressBar({ operation, t }) {
			const percent = operationProgress(operation);
			const tone = operation.status === "failed" ? colors.error : operation.status === "completed" ? colors.success : colors.accent;
			return (0, react.createElement)("div", {
				key: "progress",
				style: {
					display: "grid",
					gap: "6px"
				}
			}, [(0, react.createElement)("div", {
				key: "labels",
				style: {
					display: "flex",
					justifyContent: "space-between",
					gap: "8px",
					color: colors.muted,
					fontSize: "11px"
				}
			}, [(0, react.createElement)("span", { key: "stage" }, operation.status === "failed" ? t("status_failed") : stageLabel(operation.stage, t)), (0, react.createElement)("span", {
				key: "percent",
				style: { fontVariantNumeric: "tabular-nums" }
			}, `${percent}%`)]), (0, react.createElement)("div", {
				key: "track",
				role: "progressbar",
				"aria-label": t("operationProgress"),
				"aria-valuemin": 0,
				"aria-valuemax": 100,
				"aria-valuenow": percent,
				style: {
					height: "6px",
					borderRadius: "999px",
					overflow: "hidden",
					background: "rgba(148,163,184,.24)"
				}
			}, (0, react.createElement)("div", { style: {
				width: `${percent}%`,
				height: "100%",
				borderRadius: "inherit",
				background: tone,
				transition: "width .25s ease"
			} }))]);
		}
		function OperationRow({ operation, t, onClick, selected }) {
			const statusKey = operation.status === "completed" ? "completed" : operation.status;
			return (0, react.createElement)("button", {
				type: "button",
				onClick,
				"aria-pressed": selected,
				style: {
					display: "grid",
					gridTemplateColumns: "1fr auto",
					gap: "8px",
					width: "100%",
					textAlign: "left",
					border: selected ? `1px solid ${colors.accent}` : `1px solid ${colors.border}`,
					background: selected ? "rgba(79,70,229,.06)" : colors.surface,
					borderRadius: "12px",
					padding: "12px",
					cursor: "pointer"
				}
			}, [(0, react.createElement)("span", {
				key: "main",
				style: { minWidth: 0 }
			}, [(0, react.createElement)("strong", {
				key: "title",
				style: {
					display: "block",
					color: colors.ink,
					fontSize: "13px"
				}
			}, `${t(`action_${operation.action}`)} · ${operation.pluginId}`), (0, react.createElement)("small", {
				key: "stage",
				style: {
					display: "block",
					color: colors.muted,
					marginTop: "4px"
				}
			}, operation.status === "failed" ? operation.error : stageLabel(operation.stage, t))]), (0, react.createElement)(Badge, {
				key: "status",
				tone: statusTone(operation.status)
			}, t(`status_${statusKey}`))]);
		}
		function LogPanel({ operation, t }) {
			const logRef = (0, react.useRef)(null);
			(0, react.useEffect)(() => {
				if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
			}, [operation?.operationId, operation?.logs?.length]);
			if (!operation) return (0, react.createElement)("div", { style: {
				border: `1px dashed ${colors.border}`,
				borderRadius: "14px",
				padding: "32px",
				color: colors.muted,
				textAlign: "center"
			} }, t("selectOperation"));
			return (0, react.createElement)("div", { style: {
				border: `1px solid ${colors.border}`,
				borderRadius: "14px",
				overflow: "hidden",
				background: "#101522"
			} }, [
				(0, react.createElement)("div", {
					key: "bar",
					style: {
						display: "flex",
						justifyContent: "space-between",
						gap: "12px",
						padding: "12px 14px",
						background: "#182033",
						color: "#dbe4ff"
					}
				}, [(0, react.createElement)("strong", {
					key: "title",
					style: { fontSize: "13px" }
				}, `${t(`action_${operation.action}`)} · ${operation.pluginId}`), (0, react.createElement)(Badge, {
					key: "status",
					tone: statusTone(operation.status)
				}, t(`status_${operation.status === "completed" ? "completed" : operation.status}`))]),
				(0, react.createElement)("div", {
					key: "progress",
					style: {
						padding: "11px 14px 0",
						background: "#101522"
					}
				}, (0, react.createElement)(ProgressBar, {
					operation,
					t
				})),
				(0, react.createElement)("pre", {
					key: "logs",
					ref: logRef,
					"aria-live": "polite",
					style: {
						margin: 0,
						padding: "14px",
						minHeight: "170px",
						maxHeight: "380px",
						overflow: "auto",
						color: "#d7e0f4",
						fontSize: "12px",
						lineHeight: 1.7,
						whiteSpace: "pre-wrap"
					}
				}, operation.logs?.length ? operation.logs.map((entry) => `[${entry.timestamp?.slice(11, 19) ?? "--:--:--"}] ${entry.line}`).join("\n") : t("noLogs"))
			]);
		}
		function DetailField({ label, value }) {
			return (0, react.createElement)("div", { style: {
				minWidth: 0,
				padding: "10px 11px",
				borderRadius: "10px",
				background: colors.soft
			} }, [(0, react.createElement)("small", {
				key: "label",
				style: {
					display: "block",
					color: colors.muted,
					fontSize: "10px",
					fontWeight: 700
				}
			}, label), (0, react.createElement)("div", {
				key: "value",
				style: {
					marginTop: "4px",
					color: colors.ink,
					fontSize: "12px",
					lineHeight: 1.45,
					overflowWrap: "anywhere"
				}
			}, value)]);
		}
		function DetailList({ title, values, empty }) {
			return (0, react.createElement)("section", { style: {
				display: "grid",
				gap: "7px"
			} }, [(0, react.createElement)("strong", {
				key: "title",
				style: {
					color: colors.ink,
					fontSize: "12px"
				}
			}, title), values?.length ? (0, react.createElement)("div", {
				key: "values",
				style: {
					display: "flex",
					gap: "6px",
					flexWrap: "wrap"
				}
			}, values.map((value) => (0, react.createElement)(Badge, {
				key: value,
				tone: "neutral"
			}, value))) : (0, react.createElement)("small", {
				key: "empty",
				style: { color: colors.muted }
			}, empty)]);
		}
		function PluginDetails({ plugin, current, operation, t, onClose, onAction }) {
			const repositoryUrl = githubUrl(plugin);
			const canInstall = installable(plugin);
			const isBusy = operation && (operation.status === "queued" || operation.status === "running");
			const enabled = current?.enabled === true;
			const primaryAction = current ? enabled ? "disable" : "enable" : "install";
			return (0, react.createElement)("div", {
				role: "presentation",
				onClick: onClose,
				style: {
					position: "fixed",
					inset: 0,
					zIndex: 20,
					display: "flex",
					justifyContent: "flex-end",
					background: "rgba(15,23,42,.36)",
					backdropFilter: "blur(2px)"
				}
			}, (0, react.createElement)("aside", {
				role: "dialog",
				"aria-modal": "true",
				"aria-label": t("detailTitle"),
				onClick: (event) => event.stopPropagation(),
				style: {
					width: "min(520px, 100%)",
					height: "100%",
					overflow: "auto",
					boxSizing: "border-box",
					padding: "22px",
					background: colors.surface,
					boxShadow: "-18px 0 45px rgba(15,23,42,.18)"
				}
			}, [
				(0, react.createElement)("div", {
					key: "top",
					style: {
						display: "flex",
						justifyContent: "space-between",
						gap: "12px",
						alignItems: "center",
						marginBottom: "20px"
					}
				}, [(0, react.createElement)("strong", {
					key: "title",
					style: {
						color: colors.ink,
						fontSize: "16px"
					}
				}, t("detailTitle")), (0, react.createElement)(ActionButton, {
					key: "close",
					onClick: onClose,
					title: t("close")
				}, t("close"))]),
				(0, react.createElement)("div", {
					key: "identity",
					style: {
						display: "flex",
						gap: "12px",
						alignItems: "flex-start"
					}
				}, [(0, react.createElement)(Avatar, {
					key: "avatar",
					plugin
				}), (0, react.createElement)("div", {
					key: "name",
					style: {
						minWidth: 0,
						flex: 1
					}
				}, [
					(0, react.createElement)("h2", {
						key: "heading",
						style: {
							margin: 0,
							color: colors.ink,
							fontSize: "22px",
							letterSpacing: "-.035em",
							overflowWrap: "anywhere"
						}
					}, plugin.name ?? plugin.id),
					(0, react.createElement)("div", {
						key: "owner",
						style: {
							marginTop: "5px",
							color: colors.muted,
							fontSize: "12px"
						}
					}, ownerOf(plugin)),
					(0, react.createElement)("div", {
						key: "badges",
						style: {
							display: "flex",
							gap: "6px",
							flexWrap: "wrap",
							marginTop: "9px"
						}
					}, [
						(0, react.createElement)(Badge, {
							key: "kind",
							tone: "neutral"
						}, kindLabel(plugin.kind, t)),
						current ? (0, react.createElement)(Badge, {
							key: "installed",
							tone: enabled ? "success" : "warning"
						}, enabled ? t("enabled") : t("disabled")) : null,
						current?.restartRequired ? (0, react.createElement)(Badge, {
							key: "restart",
							tone: "warning"
						}, t("needsReload")) : null
					])
				])]),
				(0, react.createElement)("p", {
					key: "description",
					style: {
						margin: "20px 0",
						color: colors.muted,
						fontSize: "13px",
						lineHeight: 1.75,
						whiteSpace: "pre-wrap"
					}
				}, plugin.description || t("noDescription")),
				(0, react.createElement)("div", {
					key: "fields",
					style: {
						display: "grid",
						gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
						gap: "8px",
						marginBottom: "18px"
					}
				}, [
					(0, react.createElement)(DetailField, {
						key: "stars",
						label: t("starsLabel"),
						value: formatStars(plugin) === null ? t("starsUnknown") : t("stars", { count: formatStars(plugin) })
					}),
					(0, react.createElement)(DetailField, {
						key: "version",
						label: t("versionLabel"),
						value: current?.version ?? plugin.version ?? t("versionUnknown")
					}),
					(0, react.createElement)(DetailField, {
						key: "source",
						label: t("sourceLabel"),
						value: plugin.source === "npm" ? t("sourceNpm") : t("sourceGithub")
					}),
					(0, react.createElement)(DetailField, {
						key: "package",
						label: t("packageLabel"),
						value: plugin.packageName ?? t("notProvided")
					}),
					(0, react.createElement)(DetailField, {
						key: "branch",
						label: t("branchLabel"),
						value: plugin.defaultBranch ?? t("notProvided")
					}),
					(0, react.createElement)(DetailField, {
						key: "build",
						label: t("buildLabel"),
						value: plugin.requiresBuild ? t("yes") : t("no")
					})
				]),
				(0, react.createElement)("div", {
					key: "lists",
					style: {
						display: "grid",
						gap: "16px",
						marginBottom: "20px"
					}
				}, [(0, react.createElement)(DetailList, {
					key: "permissions",
					title: t("permissionsLabel"),
					values: plugin.permissions,
					empty: t("none")
				}), (0, react.createElement)(DetailList, {
					key: "requires",
					title: t("requirementsLabel"),
					values: plugin.requires,
					empty: t("none")
				})]),
				repositoryUrl ? (0, react.createElement)("a", {
					key: "github",
					href: repositoryUrl,
					target: "_blank",
					rel: "noreferrer",
					style: {
						display: "block",
						marginBottom: "16px",
						color: colors.accent,
						fontSize: "12px",
						fontWeight: 700,
						overflowWrap: "anywhere"
					}
				}, `${t("github")}: ${repositoryUrl}`) : null,
				(0, react.createElement)("div", {
					key: "actions",
					style: {
						display: "flex",
						gap: "8px",
						flexWrap: "wrap"
					}
				}, [canInstall || current ? (0, react.createElement)(ActionButton, {
					key: "primary",
					primary: !enabled,
					disabled: isBusy || !current && !canInstall,
					onClick: () => onAction(primaryAction, plugin)
				}, current ? enabled ? t("disable") : t("enable") : isBusy ? t("installing") : t("install")) : (0, react.createElement)(ActionButton, {
					key: "unsupported",
					disabled: true
				}, t("unsupported")), current ? (0, react.createElement)(ActionButton, {
					key: "update",
					disabled: isBusy,
					onClick: () => onAction("update", plugin)
				}, t("update")) : null]),
				operation ? (0, react.createElement)("div", {
					key: "operation",
					style: { marginTop: "20px" }
				}, (0, react.createElement)(LogPanel, {
					operation,
					t
				})) : null
			]));
		}
		function PluginCard({ plugin, current, operation, mode, t, onAction, onDetails }) {
			const repositoryUrl = githubUrl(plugin);
			const stars = formatStars(plugin);
			const isBusy = operation && (operation.status === "queued" || operation.status === "running");
			const isInstalled = Boolean(current);
			const enabled = current?.enabled === true;
			const canInstall = installable(plugin);
			const primaryAction = mode === PAGE_MODE.market ? isInstalled ? t("installed") : t("install") : enabled ? t("disable") : t("enable");
			const actions = mode === PAGE_MODE.market ? [isInstalled ? (0, react.createElement)(ActionButton, {
				key: "installed",
				disabled: true
			}, primaryAction) : (0, react.createElement)(ActionButton, {
				key: "install",
				primary: canInstall,
				disabled: isBusy || !canInstall,
				onClick: () => onAction("install", plugin)
			}, !canInstall ? t("unsupported") : isBusy ? t("installing") : primaryAction), isInstalled ? (0, react.createElement)(ActionButton, {
				key: "update",
				disabled: isBusy,
				onClick: () => onAction("update", plugin)
			}, t("update")) : null] : [
				(0, react.createElement)(ActionButton, {
					key: "toggle",
					primary: !enabled,
					disabled: isBusy,
					onClick: () => onAction(enabled ? "disable" : "enable", plugin)
				}, primaryAction),
				(0, react.createElement)(ActionButton, {
					key: "update",
					disabled: isBusy,
					onClick: () => onAction("update", plugin)
				}, t("update")),
				(0, react.createElement)(ActionButton, {
					key: "uninstall",
					danger: true,
					disabled: isBusy,
					onClick: () => onAction("uninstall", plugin)
				}, t("uninstall"))
			];
			return (0, react.createElement)("article", { style: {
				display: "grid",
				gap: "14px",
				minWidth: 0,
				padding: "16px",
				borderRadius: "16px",
				border: `1px solid ${colors.border}`,
				background: colors.surface,
				boxShadow: "0 8px 24px rgba(16,24,40,.05)"
			} }, [
				(0, react.createElement)("div", {
					key: "header",
					style: {
						display: "flex",
						gap: "11px",
						alignItems: "flex-start"
					}
				}, [
					(0, react.createElement)(Avatar, {
						key: "avatar",
						plugin
					}),
					(0, react.createElement)("div", {
						key: "name",
						style: {
							minWidth: 0,
							flex: 1
						}
					}, [(0, react.createElement)("strong", {
						key: "title",
						style: {
							display: "block",
							overflow: "hidden",
							textOverflow: "ellipsis",
							whiteSpace: "nowrap",
							color: colors.ink,
							fontSize: "14px"
						}
					}, plugin.name ?? plugin.id), (0, react.createElement)("small", {
						key: "owner",
						style: {
							display: "block",
							overflow: "hidden",
							textOverflow: "ellipsis",
							whiteSpace: "nowrap",
							color: colors.muted,
							marginTop: "4px"
						}
					}, ownerOf(plugin))]),
					(0, react.createElement)(Badge, {
						key: "kind",
						tone: "neutral"
					}, kindLabel(plugin.kind, t))
				]),
				plugin.description ? (0, react.createElement)("p", {
					key: "description",
					style: {
						margin: 0,
						minHeight: "42px",
						color: colors.muted,
						fontSize: "12px",
						lineHeight: 1.65,
						display: "-webkit-box",
						WebkitLineClamp: 2,
						WebkitBoxOrient: "vertical",
						overflow: "hidden"
					}
				}, plugin.description) : (0, react.createElement)("p", {
					key: "description-empty",
					style: {
						margin: 0,
						minHeight: "42px",
						color: colors.muted,
						fontSize: "12px"
					}
				}, t("noDescription")),
				(0, react.createElement)("div", {
					key: "meta",
					style: {
						display: "flex",
						gap: "9px",
						flexWrap: "wrap",
						alignItems: "center",
						color: colors.muted,
						fontSize: "11px"
					}
				}, [
					repositoryUrl ? (0, react.createElement)("a", {
						key: "github",
						href: repositoryUrl,
						target: "_blank",
						rel: "noreferrer",
						style: {
							color: colors.accent,
							fontWeight: 700
						}
					}, "GitHub") : null,
					(0, react.createElement)("span", { key: "stars" }, stars === null ? t("starsUnknown") : t("stars", { count: stars })),
					(0, react.createElement)("span", { key: "version" }, current?.version ?? plugin.version ?? t("versionUnknown")),
					current ? (0, react.createElement)(Badge, {
						key: "installed-state",
						tone: enabled ? "success" : "warning"
					}, enabled ? t("enabled") : t("disabled")) : null,
					current?.restartRequired ? (0, react.createElement)(Badge, {
						key: "reload-state",
						tone: "warning"
					}, t("needsReload")) : null,
					isBusy ? (0, react.createElement)(Badge, {
						key: "operation-state",
						tone: "warning"
					}, operation.status === "queued" ? t("status_queued") : stageLabel(operation.stage, t)) : null
				]),
				(0, react.createElement)("div", {
					key: "actions",
					style: {
						display: "flex",
						gap: "8px",
						flexWrap: "wrap",
						paddingTop: "2px"
					}
				}, [(0, react.createElement)(ActionButton, {
					key: "details",
					onClick: () => onDetails(plugin)
				}, t("details")), ...actions])
			]);
		}
		function Stat({ label, value, accent }) {
			return (0, react.createElement)("div", { style: {
				border: `1px solid ${colors.border}`,
				borderRadius: "14px",
				padding: "12px 14px",
				background: colors.surface
			} }, [(0, react.createElement)("strong", {
				key: "value",
				style: {
					display: "block",
					color: accent ?? colors.ink,
					fontSize: "22px",
					letterSpacing: "-.04em"
				}
			}, String(value)), (0, react.createElement)("small", {
				key: "label",
				style: {
					display: "block",
					color: colors.muted,
					marginTop: "3px",
					fontSize: "11px"
				}
			}, label)]);
		}
		function ManagerPage({ t, locale }) {
			const api = (0, react.useMemo)(() => createManagerClient(), []);
			const subscribe = typeof locale?.subscribe === "function" ? (callback) => locale.subscribe(callback) : () => () => {};
			const getSnapshot = typeof locale?.getSnapshot === "function" ? () => locale.getSnapshot() : () => ({ active: "en" });
			(0, react.useSyncExternalStore)(subscribe, getSnapshot, getSnapshot);
			const [mode, setMode] = (0, react.useState)(PAGE_MODE.market);
			const [query, setQuery] = (0, react.useState)("");
			const [kindFilter, setKindFilter] = (0, react.useState)("all");
			const [sort, setSort] = (0, react.useState)("stars");
			const [plugins, setPlugins] = (0, react.useState)([]);
			const [installed, setInstalled] = (0, react.useState)([]);
			const [operations, setOperations] = (0, react.useState)([]);
			const [profile, setProfile] = (0, react.useState)("web");
			const [selectedOperationId, setSelectedOperationId] = (0, react.useState)(null);
			const [selectedPluginId, setSelectedPluginId] = (0, react.useState)(null);
			const [error, setError] = (0, react.useState)("");
			const [loading, setLoading] = (0, react.useState)(true);
			const [refreshing, setRefreshing] = (0, react.useState)(false);
			const load = (0, react.useCallback)(async ({ showLoading = false } = {}) => {
				if (showLoading) setLoading(true);
				try {
					const [status, installedResult, operationResult] = await Promise.all([
						api.status(),
						api.installed(),
						api.operations()
					]);
					setProfile(status.profile ?? "web");
					setInstalled(installedResult.plugins ?? []);
					setOperations(operationResult.operations ?? []);
					if (mode === PAGE_MODE.market) {
						const market = await api.list(query);
						setPlugins(market.plugins ?? []);
					}
					setError("");
				} catch (cause) {
					setError(`${t("errorPrefix")}: ${cause.message}`);
				} finally {
					if (showLoading) setLoading(false);
				}
			}, [
				api,
				mode,
				query,
				t
			]);
			(0, react.useEffect)(() => {
				load({ showLoading: true });
			}, [load]);
			(0, react.useEffect)(() => {
				const timer = setInterval(() => {
					load();
				}, 900);
				return () => clearInterval(timer);
			}, [load]);
			const installedById = (0, react.useMemo)(() => new Map(installed.map((plugin) => [plugin.id, plugin])), [installed]);
			const operationByPlugin = (0, react.useMemo)(() => new Map(operations.filter((operation) => operation.status === "queued" || operation.status === "running").map((operation) => [operation.pluginId, operation])), [operations]);
			const selectedOperation = operations.find((operation) => operation.operationId === selectedOperationId) ?? operations[0] ?? null;
			const selectedPlugin = [...plugins, ...installed].find((plugin) => plugin.id === selectedPluginId) ?? null;
			const visible = sortPlugins((mode === PAGE_MODE.market ? plugins : installed).filter((plugin) => kindFilter === "all" || plugin.kind === kindFilter).filter((plugin) => matchesQuery(plugin, query)), sort);
			async function refresh() {
				if (refreshing) return;
				setRefreshing(true);
				try {
					if (mode === PAGE_MODE.market) await api.refresh();
					await load();
				} catch (cause) {
					setError(`${t("errorPrefix")}: ${cause.message}`);
				} finally {
					setRefreshing(false);
				}
			}
			async function runAction(action, plugin) {
				if (operationByPlugin.has(plugin.id)) return;
				if (action === "install") {
					const { plan } = await api.plan(plugin.id);
					const warning = plan.preflight.warnings.length > 0 ? `\n\n${t("warnings")}: ${plan.preflight.warnings.join("; ")}` : "";
					if (!confirmAction(`${t("confirmInstall", { name: plugin.name ?? plugin.id })}${warning}`)) return;
				}
				if (action === "uninstall" && !confirmAction(t("confirmUninstall", { name: plugin.name ?? plugin.id }))) return;
				try {
					const operation = (await api.action(action, plugin.id)).operation;
					if (operation?.operationId) setSelectedOperationId(operation.operationId);
					await load();
				} catch (cause) {
					setError(`${t("errorPrefix")}: ${cause.message}`);
				}
			}
			const title = mode === PAGE_MODE.market ? t("marketTitle") : mode === PAGE_MODE.installed ? t("installedTitle") : t("activityTitle");
			const activeCount = operations.filter((operation) => operation.status === "queued" || operation.status === "running").length;
			const updateCount = installed.filter((plugin) => plugin.updateAvailable).length;
			return (0, react.createElement)("main", { style: {
				maxWidth: "1180px",
				margin: "0 auto",
				padding: "24px",
				color: colors.ink,
				fontFamily: "inherit",
				background: colors.soft,
				borderRadius: "22px",
				minHeight: "620px"
			} }, [
				(0, react.createElement)("section", {
					key: "hero",
					style: {
						position: "relative",
						overflow: "hidden",
						borderRadius: "20px",
						padding: "24px",
						color: "#fff",
						background: "linear-gradient(135deg, #202a5a 0%, #4f46e5 58%, #7c3aed 100%)",
						boxShadow: "0 16px 34px rgba(55,48,163,.24)"
					}
				}, [(0, react.createElement)("div", {
					key: "hero-content",
					style: {
						position: "relative",
						zIndex: 1,
						maxWidth: "680px"
					}
				}, [
					(0, react.createElement)("div", {
						key: "eyebrow",
						style: {
							display: "inline-flex",
							alignItems: "center",
							gap: "7px",
							fontSize: "11px",
							fontWeight: 800,
							letterSpacing: ".08em",
							textTransform: "uppercase",
							opacity: .78
						}
					}, "DSH PLUGIN MANAGER"),
					(0, react.createElement)("h1", {
						key: "title",
						style: {
							margin: "8px 0 7px",
							fontSize: "28px",
							letterSpacing: "-.04em"
						}
					}, t("pageTitle")),
					(0, react.createElement)("p", {
						key: "intro",
						style: {
							margin: 0,
							fontSize: "13px",
							lineHeight: 1.65,
							opacity: .86
						}
					}, t("pageIntro"))
				]), (0, react.createElement)("div", {
					key: "orb",
					"aria-hidden": "true",
					style: {
						position: "absolute",
						right: "-48px",
						top: "-88px",
						width: "240px",
						height: "240px",
						borderRadius: "50%",
						background: "rgba(255,255,255,.12)",
						boxShadow: "0 0 0 36px rgba(255,255,255,.05)"
					}
				})]),
				(0, react.createElement)("div", {
					key: "stats",
					style: {
						display: "grid",
						gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
						gap: "10px",
						margin: "14px 0"
					}
				}, [
					(0, react.createElement)(Stat, {
						key: "total",
						label: t("totalPlugins"),
						value: plugins.length || "—",
						accent: colors.accent
					}),
					(0, react.createElement)(Stat, {
						key: "installed",
						label: t("installedCount"),
						value: installed.length,
						accent: colors.success
					}),
					(0, react.createElement)(Stat, {
						key: "active",
						label: t("activeTasks"),
						value: activeCount,
						accent: activeCount ? colors.warning : colors.ink
					}),
					(0, react.createElement)(Stat, {
						key: "updates",
						label: t("updatesAvailable"),
						value: updateCount,
						accent: updateCount ? colors.warning : colors.ink
					})
				]),
				(0, react.createElement)("nav", {
					key: "nav",
					role: "tablist",
					"aria-label": t("pageNavigation"),
					style: {
						display: "flex",
						gap: "7px",
						flexWrap: "wrap",
						alignItems: "center",
						marginBottom: "10px"
					}
				}, [...[
					[PAGE_MODE.market, t("marketTab")],
					[PAGE_MODE.installed, t("installedTab")],
					[PAGE_MODE.activity, `${t("activityTab")}${activeCount ? ` (${activeCount})` : ""}`]
				].map(([value, label]) => (0, react.createElement)("button", {
					key: value,
					type: "button",
					role: "tab",
					"aria-selected": mode === value,
					onClick: () => setMode(value),
					style: {
						border: mode === value ? `1px solid ${colors.accent}` : `1px solid ${colors.border}`,
						background: mode === value ? colors.accent : colors.surface,
						color: mode === value ? "#fff" : colors.muted,
						borderRadius: "10px",
						padding: "9px 14px",
						fontSize: "12px",
						fontWeight: 800,
						cursor: "pointer"
					}
				}, label)), (0, react.createElement)(ActionButton, {
					key: "refresh",
					onClick: refresh,
					disabled: refreshing
				}, refreshing ? t("refreshing") : t("refresh"))]),
				(0, react.createElement)("div", {
					key: "section-heading",
					style: { margin: "0 0 12px" }
				}, [(0, react.createElement)("h2", {
					key: "title",
					style: {
						margin: 0,
						color: colors.ink,
						fontSize: "18px",
						letterSpacing: "-.025em"
					}
				}, title), (0, react.createElement)("p", {
					key: "intro",
					style: {
						margin: "4px 0 0",
						color: colors.muted,
						fontSize: "12px"
					}
				}, mode === PAGE_MODE.market ? t("marketIntro") : mode === PAGE_MODE.installed ? t("installedIntro") : t("activityIntro"))]),
				mode !== PAGE_MODE.activity ? (0, react.createElement)("div", {
					key: "toolbar",
					style: {
						display: "flex",
						gap: "8px",
						alignItems: "center",
						flexWrap: "wrap",
						marginBottom: "14px"
					}
				}, [
					(0, react.createElement)("input", {
						key: "search",
						value: query,
						placeholder: t("searchPlugins"),
						"aria-label": t("searchPlugins"),
						onChange: (event) => setQuery(event.target.value),
						style: {
							flex: 1,
							minWidth: "220px",
							boxSizing: "border-box",
							border: `1px solid ${colors.border}`,
							borderRadius: "11px",
							padding: "11px 13px",
							background: colors.surface,
							color: colors.ink,
							outline: "none"
						}
					}),
					(0, react.createElement)("select", {
						key: "kind",
						value: kindFilter,
						"aria-label": t("kindFilter"),
						onChange: (event) => setKindFilter(event.target.value),
						style: {
							minWidth: "138px",
							border: `1px solid ${colors.border}`,
							borderRadius: "11px",
							padding: "10px 11px",
							background: colors.surface,
							color: colors.ink,
							fontSize: "12px"
						}
					}, [
						(0, react.createElement)("option", {
							key: "all",
							value: "all"
						}, t("allKinds")),
						(0, react.createElement)("option", {
							key: "web-client",
							value: "web-client"
						}, t("kindWebClient")),
						(0, react.createElement)("option", {
							key: "cordis-bundle",
							value: "cordis-bundle"
						}, t("kindCordisBundle")),
						(0, react.createElement)("option", {
							key: "skill",
							value: "skill"
						}, t("kindSkill")),
						(0, react.createElement)("option", {
							key: "preset",
							value: "preset"
						}, t("kindPreset"))
					]),
					(0, react.createElement)("select", {
						key: "sort",
						value: sort,
						"aria-label": t("sortLabel"),
						onChange: (event) => setSort(event.target.value),
						style: {
							minWidth: "138px",
							border: `1px solid ${colors.border}`,
							borderRadius: "11px",
							padding: "10px 11px",
							background: colors.surface,
							color: colors.ink,
							fontSize: "12px"
						}
					}, [
						(0, react.createElement)("option", {
							key: "stars",
							value: "stars"
						}, t("sortStars")),
						(0, react.createElement)("option", {
							key: "name",
							value: "name"
						}, t("sortName")),
						(0, react.createElement)("option", {
							key: "version",
							value: "version"
						}, t("sortVersion"))
					]),
					(0, react.createElement)("span", {
						key: "count",
						style: {
							color: colors.muted,
							fontSize: "12px",
							whiteSpace: "nowrap"
						}
					}, `${visible.length} ${t("results")}`)
				]) : null,
				error ? (0, react.createElement)("div", {
					key: "error",
					role: "alert",
					style: {
						marginBottom: "14px",
						border: "1px solid rgba(220,38,38,.20)",
						borderRadius: "12px",
						padding: "11px 13px",
						background: "rgba(220,38,38,.07)",
						color: colors.error,
						fontSize: "12px"
					}
				}, error) : null,
				mode === PAGE_MODE.activity ? (0, react.createElement)("section", {
					key: "activity",
					style: {
						display: "grid",
						gridTemplateColumns: "minmax(240px, .85fr) minmax(0, 1.5fr)",
						gap: "14px"
					}
				}, [(0, react.createElement)("div", {
					key: "list",
					style: {
						display: "grid",
						gap: "8px",
						alignContent: "start"
					}
				}, operations.length > 0 ? operations.map((operation) => (0, react.createElement)(OperationRow, {
					key: operation.operationId ?? `${operation.action}-${operation.pluginId}`,
					operation,
					t,
					selected: operation.operationId === selectedOperation?.operationId,
					onClick: () => setSelectedOperationId(operation.operationId)
				})) : (0, react.createElement)("div", { style: {
					border: `1px dashed ${colors.border}`,
					borderRadius: "14px",
					padding: "28px 16px",
					color: colors.muted,
					textAlign: "center"
				} }, t("noOperations"))), (0, react.createElement)(LogPanel, {
					key: "log",
					operation: selectedOperation,
					t
				})]) : (0, react.createElement)("section", { key: "cards" }, loading ? (0, react.createElement)("div", { style: {
					display: "grid",
					gridTemplateColumns: "repeat(auto-fill, minmax(270px, 1fr))",
					gap: "12px"
				} }, [
					1,
					2,
					3,
					4
				].map((value) => (0, react.createElement)("div", {
					key: value,
					style: {
						height: "220px",
						borderRadius: "16px",
						background: colors.surface,
						border: `1px solid ${colors.border}`,
						opacity: .7
					}
				}))) : visible.length > 0 ? (0, react.createElement)("div", { style: {
					display: "grid",
					gridTemplateColumns: "repeat(auto-fill, minmax(270px, 1fr))",
					gap: "12px"
				} }, visible.map((plugin) => (0, react.createElement)(PluginCard, {
					key: plugin.id,
					plugin,
					current: installedById.get(plugin.id),
					operation: operationByPlugin.get(plugin.id),
					mode,
					t,
					onAction: runAction,
					onDetails: (value) => setSelectedPluginId(value.id)
				}))) : (0, react.createElement)("div", { style: {
					border: `1px dashed ${colors.border}`,
					borderRadius: "14px",
					padding: "44px 16px",
					color: colors.muted,
					textAlign: "center"
				} }, mode === PAGE_MODE.market ? t("noResults") : t("noInstalled"))),
				mode !== PAGE_MODE.activity && selectedOperation ? (0, react.createElement)("section", {
					key: "live-log",
					style: { marginTop: "14px" }
				}, [(0, react.createElement)("div", {
					key: "live-heading",
					style: {
						display: "flex",
						justifyContent: "space-between",
						alignItems: "center",
						marginBottom: "8px"
					}
				}, [(0, react.createElement)("strong", {
					key: "title",
					style: { fontSize: "13px" }
				}, t("latestOperation")), (0, react.createElement)(ActionButton, {
					key: "open",
					onClick: () => setMode(PAGE_MODE.activity)
				}, t("viewActivity"))]), (0, react.createElement)(LogPanel, {
					key: "live-log-panel",
					operation: selectedOperation,
					t
				})]) : null,
				selectedPlugin ? (0, react.createElement)(PluginDetails, {
					key: "details",
					plugin: selectedPlugin,
					current: installedById.get(selectedPlugin.id),
					operation: operationByPlugin.get(selectedPlugin.id),
					t,
					onClose: () => setSelectedPluginId(null),
					onAction: runAction
				}) : null
			]);
		}
		function apply(ctx) {
			ctx.effect(() => ctx.locale.register(LOCALE_NAMESPACE, {
				zh,
				en
			}), "dsh-plugin-manager: locale dictionaries");
			const t = ctx.locale.bind(LOCALE_NAMESPACE);
			ctx.slots.inject("settings.section", () => ctx.slots.register({
				name: "settings.section",
				id: "dsh-plugin-manager",
				order: 45,
				label: () => t("pageTitle"),
				locale: LOCALE_NAMESPACE
			}, () => (0, react.createElement)(ManagerPage, {
				t,
				locale: ctx.locale
			})));
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map