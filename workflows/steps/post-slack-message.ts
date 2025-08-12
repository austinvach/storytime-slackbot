import type {
	ChatPostMessageArguments,
	ChatUpdateArguments,
} from "@slack/web-api";
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

export async function updateSlackMessage(options: ChatUpdateArguments) {
	"use step";

	const res = await slack.chat.update(options);

	if (!res.ok) {
		throw new FatalError(`Failed to update message: ${res.error}`);
	}
}
