import { FatalError } from "@vercel/workflow-core";
import { z } from "zod";

async function postMessage(
	text: string,
	channelId: string,
	threadTs?: string,
	replyBroadcast = false,
) {
	"use step";

	// TODO: properly type
	const data: Record<string, string | boolean> = {
		channel: channelId,
		text,
		unfurl_links: false,
		unfurl_media: false,
	};
	if (threadTs) {
		data.thread_ts = threadTs;
		data.reply_broadcast = replyBroadcast;
	}

	const response = await fetch("https://slack.com/api/chat.postMessage", {
		method: "POST",
		headers: {
			Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`,
			"Content-Type": "application/json; charset=utf-8",
		},
		body: JSON.stringify(data),
	});
	if (!response.ok) {
		throw new FatalError(`Failed to post message: ${response.statusText}`);
	}
	const body = await response.json();
	console.log(JSON.stringify(body, null, 2));
	return body;
}

export async function storytime(slashCommand: URLSearchParams) {
	"use workflow";

	const channelId = slashCommand.get("channel_id") ?? "";

	// Create the initial top-level message in the channel
	const { ts } = await postMessage("Hello, world from Workflow!", channelId);

	// Create a thread in the top-level message
	await postMessage("Starting storytime...", channelId, ts);
}
