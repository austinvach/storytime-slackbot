import type { ChatPostMessageArguments } from "@slack/web-api";
import { FatalError } from "@vercel/workflow-core";
import { slack } from "@/lib/slack";

export async function postSlackMessage(options: ChatPostMessageArguments) {
	"use step";

	const res = await slack.chat.postMessage(options);

	const { ts, message } = res;

	if (!res.ok || !ts || !message) {
		throw new FatalError(`Failed to post message: ${res.error}`);
	}

	return { ts, message };
}
