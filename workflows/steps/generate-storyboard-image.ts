import { openai } from "@ai-sdk/openai";
import { FatalError } from "@vercel/workflow-core";
import { experimental_generateImage as generateImage } from "ai";
import { IMAGE_GEN_PROMPT } from "@/lib/prompt";
import { slack } from "@/lib/slack";

export async function generateStoryboardImage(
	channelId: string,
	threadTs: string,
	finalStory: string,
) {
	"use step";

	console.time("Generating storyboard image");
	const image = await generateImage({
		model: openai.image("gpt-image-1"),
		n: 1,
		prompt: IMAGE_GEN_PROMPT(finalStory),
	});
	console.timeEnd("Generating storyboard image");

	console.time("Uploading image to Slack");
	const res = await slack.files.uploadV2({
		channel_id: channelId,
		thread_ts: threadTs,
		file: Buffer.from(image.images[0].uint8Array),
		filename: "storyboard.png",
		title: "Storyboard",
	});
	console.timeEnd("Uploading image to Slack");

	if (!res.ok) {
		throw new FatalError(`Failed to upload file: ${res.error}`);
	}

	console.log(JSON.stringify(res, null, 2));

	// @ts-expect-error - files is not typed
	return res.files[0].files[0].id as string;
}

export async function deleteStoryboardImageMessage(
	channelId: string,
	threadTs: string,
	botId: string,
) {
	"use step";

	// Fetch replies in the thread
	const replies = await slack.conversations.replies({
		channel: channelId,
		ts: threadTs,
		limit: 200,
		inclusive: true,
	});

	const { messages } = replies;

	if (!replies.ok || !messages || messages.length === 0) {
		throw new FatalError(`Failed to fetch thread replies: ${replies.error}`);
	}

	// Find newest message posted by this bot in the thread
	const newestBotMessage = messages
		.filter(
			(m) =>
				(m.bot_id === botId || m.user === botId) && typeof m.ts === "string",
		)
		.sort((a, b) => parseFloat(b.ts as string) - parseFloat(a.ts as string))[0];

	console.log(messages);

	// Nothing to delete
	if (!newestBotMessage?.ts) {
		throw new FatalError("Failed to find bot message in thread");
	}

	console.log(newestBotMessage);

	const deletion = await slack.chat.delete({
		channel: channelId,
		ts: newestBotMessage.ts,
	});

	if (!deletion.ok) {
		throw new FatalError(
			`Failed to delete message ${newestBotMessage.ts}: ${deletion.error}`,
		);
	}
}
