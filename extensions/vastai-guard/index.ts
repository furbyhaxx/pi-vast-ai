import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { findVastaiCalls } from "./classify.ts";

const ALLOW_ONCE = "Allow once";
const ALLOW_SESSION = "Allow these actions for the rest of this session";
const BLOCK = "Block";

/**
 * Requires user confirmation before any `vastai` command that can spend credit or
 * destroy resources. Read-only commands (show, search, get, logs, ...) pass through.
 * Without an interactive UI (print/JSON mode, headless subagents) such commands are blocked.
 */
export default function vastaiGuard(pi: ExtensionAPI) {
	const sessionAllowed = new Set<string>();

	pi.on("session_start", async () => {
		sessionAllowed.clear();
	});

	pi.on("tool_call", async (event, ctx) => {
		if (event.toolName !== "bash") return undefined;
		const command = String((event.input as { command?: unknown }).command ?? "");
		if (!command.includes("vastai")) return undefined;

		const pending = findVastaiCalls(command).filter((c) => !c.readOnly && !sessionAllowed.has(c.action));
		if (pending.length === 0) return undefined;

		const actions = [...new Set(pending.map((c) => c.action))];
		if (!ctx.hasUI) {
			return {
				block: true,
				reason: `vastai-guard: '${actions.join("', '")}' can spend credit or destroy resources and needs interactive confirmation. Ask the user to run it or to approve it in an interactive session; do not work around this check.`,
			};
		}

		const listing = pending.map((c) => `  ${c.text}`).join("\n");
		const choice = await ctx.ui.select(
			`vast.ai: this command can spend credit or destroy resources:\n\n${listing}\n\nFull command:\n  ${command}`,
			[ALLOW_ONCE, ALLOW_SESSION, BLOCK],
		);
		if (choice === ALLOW_SESSION) {
			for (const a of actions) sessionAllowed.add(a);
			return undefined;
		}
		if (choice === ALLOW_ONCE) return undefined;
		return { block: true, reason: "vastai-guard: blocked by the user. Do not retry or work around this without asking." };
	});
}
