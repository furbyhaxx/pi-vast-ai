/** A single `vastai` invocation found inside a shell command. */
export interface VastaiCall {
	/** Verb plus object, e.g. `create instance`, `show instances`, `copy`. */
	action: string;
	/** Whether the call only reads account or marketplace state. */
	readOnly: boolean;
	/** The invocation text as it appeared, for display in the confirmation dialog. */
	text: string;
}

// Allow-list: anything not listed here is treated as spending or destructive.
const READ_ONLY_VERBS = new Set(["show", "search", "get", "logs", "ssh-url", "scp-url", "help"]);
const READ_ONLY_ACTIONS = new Set(["tfa status"]);
const SINGLE_WORD_VERBS = new Set(["execute", "logs", "copy", "ssh-url", "scp-url", "help"]);
const GLOBAL_FLAGS_WITH_VALUE = new Set(["--url", "--retry", "--api-key"]);
const SHELL_BOUNDARY = /^(?:&&|\|\||[|;&()]|\$\(|`)$/;

function tokenize(segment: string): string[] {
	return segment
		.replace(/(&&|\|\||[|;&()`])/g, " $1 ")
		.replace(/\$\s*\(/g, " $( ")
		.split(/\s+/)
		.filter((t) => t.length > 0)
		.map((t) => t.replace(/^["']|["']$/g, ""));
}

/** Finds every `vastai` invocation in a shell command and classifies it. */
export function findVastaiCalls(command: string): VastaiCall[] {
	const tokens = tokenize(command);
	const calls: VastaiCall[] = [];
	for (let i = 0; i < tokens.length; i++) {
		if (!/(^|\/)vastai$/.test(tokens[i] ?? "")) continue;
		const words: string[] = [];
		let j = i + 1;
		let versionOnly = false;
		for (; j < tokens.length; j++) {
			const t = tokens[j] ?? "";
			if (SHELL_BOUNDARY.test(t)) break;
			if (t.startsWith("-")) {
				if (words.length === 0 && (t === "--version" || t === "-h" || t === "--help")) versionOnly = true;
				const flag = t.split("=")[0] ?? t;
				if (GLOBAL_FLAGS_WITH_VALUE.has(flag) && !t.includes("=")) j++;
				continue;
			}
			words.push(t);
		}
		const text = tokens.slice(i, j).join(" ");
		const verb = words[0];
		if (verb === undefined) {
			calls.push({ action: versionOnly ? "--help" : "(none)", readOnly: true, text });
		} else {
			const action = SINGLE_WORD_VERBS.has(verb) || words[1] === undefined ? verb : `${verb} ${words[1]}`;
			calls.push({ action, readOnly: READ_ONLY_VERBS.has(verb) || READ_ONLY_ACTIONS.has(action), text });
		}
		i = j - 1;
	}
	return calls;
}
