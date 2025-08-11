import { z } from "zod";

async function postMessage(text: string, channelId: string, threadTs?: string) {
	"use step";
	const response = await fetch("https://slack.com/api/chat.postMessage", {
		method: "POST",
		headers: {
			Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`,
		},
		body: JSON.stringify({
			channel: channelId,
			text,
			thread_ts: threadTs,
			reply_broadcast: false,
			unfurl_links: false,
			unfurl_media: false,
		}),
	});
	const json = await response.json();
	console.log({ json });
}

export async function storytime(slashCommand: URLSearchParams) {
	"use workflow";

	let threadTs: string | undefined;
	const channelId = slashCommand.get("channel_id") ?? "";
	//const commandText = slashCommand.get("text") ?? "";
	//console.log({ channelId, commandText });

	await postMessage("Hello, world from Workflow!", channelId);
}
