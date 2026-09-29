import { describe, expect, test } from "bun:test";
import { findVastaiCalls } from "./classify.ts";

const actions = (cmd: string) => findVastaiCalls(cmd).map((c) => [c.action, c.readOnly]);

describe("findVastaiCalls", () => {
	test("read-only commands pass", () => {
		expect(actions("vastai search offers 'gpu_name=RTX_4090' -o dph --raw")).toEqual([["search offers", true]]);
		expect(actions("vastai --raw show instances")).toEqual([["show instances", true]]);
		expect(actions("vastai --api-key abc logs 123")).toEqual([["logs", true]]);
		expect(actions("vastai --version")).toEqual([["--help", true]]);
		expect(actions("vastai tfa status")).toEqual([["tfa status", true]]);
	});

	test("spending and destructive commands need confirmation", () => {
		expect(actions("vastai create instance 123 --image pytorch/pytorch --disk 40")).toEqual([["create instance", false]]);
		expect(actions("vastai destroy instance 42")).toEqual([["destroy instance", false]]);
		expect(actions("vastai copy local:./data C.42:/workspace")).toEqual([["copy", false]]);
		expect(actions("vastai transfer credit x@y 5")).toEqual([["transfer credit", false]]);
		expect(actions("vastai tfa delete")).toEqual([["tfa delete", false]]);
	});

	test("finds every call in chained, piped and substituted commands", () => {
		expect(actions("vastai show instances --raw | jq . && vastai destroy instance 7")).toEqual([
			["show instances", true],
			["destroy instance", false],
		]);
		expect(actions('ID=$(vastai create instance 1 --raw); echo "$ID"')).toEqual([["create instance", false]]);
		expect(actions("VAST_API_KEY=x ~/.local/bin/vastai launch instance -g RTX_4090")).toEqual([["launch instance", false]]);
	});

	test("value-taking global flags are not mistaken for verbs", () => {
		expect(actions("vastai --url https://x --retry 3 destroy instance 9")).toEqual([["destroy instance", false]]);
	});

	test("unknown verbs fail closed", () => {
		expect(actions("vastai frobnicate everything")).toEqual([["frobnicate everything", false]]);
	});

	test("ignores commands without vastai", () => {
		expect(actions("ls -la && echo vast")).toEqual([]);
	});
});
