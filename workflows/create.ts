import type { ModelMessage } from "ai";
import { z } from "zod";
import { FatalError, getWebhook } from "@vercel/workflow-core";
// Look ma no queues or kv!

// Steps
import { generateStoryPiece } from "./steps/generate-story-piece";
import {
	addReactionToMessage,
	postSlackMessage,
	removeReactionFromMessage,
	updateSlackMessage,
} from "./steps/post-slack-message";
import {
	broadcastStoryboardImage,
	generateStoryboardImage,
} from "./steps/generate-storyboard-image";
import { SYSTEM_PROMPT, THEMES } from "../lib/prompt";

export async function storytime(slashCommand: URLSearchParams) {
	"use workflow";

	// Initialize the workflow
	const channelId = slashCommand.get("channel_id");
	if (!channelId) {
		throw new FatalError("`channel_id` is required");
	}

	const theme = THEMES[Math.floor(Math.random() * THEMES.length)];
	const model = "meta/llama-4-scout";
	console.log({ theme, model });

	// ...including local state like the entire message history
	let finalStory = "";
	const messages: ModelMessage[] = [
		{
			role: "system",
			content: SYSTEM_PROMPT(theme),
		},
		{
			role: "user",
			content: "Let's start a new story.",
		},
	];

	const introText = `It's storytime! I'll start the story and you continue it.`;

	const [{ ts, message }, aiResponse] = await Promise.all([
		// Create the initial top-level message in the channel with a placeholder
		postSlackMessage({
			channel: channelId,
			text: `${introText}\n\n> _Generating introduction…_ :thinking-hard:`,
		}),
		// Ask the LLM to initiate the story
		generateStoryPiece(messages, model),
	]);

	const botId = message?.user;
	if (!botId) {
		throw new FatalError("Failed to get bot ID");
	}

	await updateSlackMessage({
		channel: channelId,
		ts,
		text: `${introText}\n\n> _${aiResponse.story}_`,
	});

	messages.push({
		role: "assistant",
		content: aiResponse.story,
	});

	// Subscribe to new messages in the thread
	const webhook = getWebhook({
		url: "/api/slack/webhook",
		body: z.object({
			event: z.object({
				type: z.literal("message"),
				channel: z.literal(channelId),
				thread_ts: z.literal(ts),

				// Exclude messages from the bot itself
				user: z.string().regex(new RegExp(`^(?!${botId}$)`)),
			}),
		}),
	});

	// Post the initial encouragement message to start the thread
	await postSlackMessage({
		channel: channelId,
		text: aiResponse.encouragement,
		thread_ts: ts,
	});

	// Process user messages in the thread (via the webhook) in
	// a loop until the LLM decides that the story is complete
	for await (const req of webhook) {
		const data = await req.json();

		messages.push({
			role: "user",
			content: data.event.text,
		});

		// Submit user's message to the LLM to continue the story
		const [aiResponse] = await Promise.all([
			generateStoryPiece(messages, model),
			addReactionToMessage({
				channel: channelId,
				timestamp: data.event.ts,
				name: "thinking-hard",
			}),
		]);

		messages.push({
			role: "assistant",
			content: aiResponse.story,
		});

		await Promise.all([
			postSlackMessage({
				channel: channelId,
				thread_ts: ts,
				text: aiResponse.encouragement,
			}),
			removeReactionFromMessage({
				channel: channelId,
				timestamp: data.event.ts,
				name: "thinking-hard",
			}),
		]);

		// If the LLM has decided that the story is complete, break the loop.
		// No more user messages will be processed in the thread after this.
		if (aiResponse.done) {
			finalStory = aiResponse.story;
			break;
		}
	}

	const finalText = `*Here is the final story:*\n\n${finalStory
		.split("\n")
		.map((line) => `> ${line ? `_${line}_` : ""}`)
		.join("\n")}`;

	// Post the final story and generate the storyboard image
	const [{ ts: finalTs }, fileId] = await Promise.all([
		postSlackMessage({
			channel: channelId,
			text: `${finalText}\n\n_Generating storyboard image…_ :thinking-hard:`,
			thread_ts: ts,
			reply_broadcast: true,
		}),
		generateStoryboardImage(channelId, ts, finalStory),
	]);

	// Update the final story message to remove the "generating storyboard image" message
	await updateSlackMessage({
		channel: channelId,
		ts: finalTs,
		text: finalText,
	});

	// Broadcast the storyboard image to the thread
	await broadcastStoryboardImage(channelId, ts, fileId);
}
