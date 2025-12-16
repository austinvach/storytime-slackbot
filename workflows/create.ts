import { stringToArgv } from "@tootallnate/string-argv";
import type { ModelMessage } from "ai";
import arg from "arg";
import { defineHook, FatalError } from "workflow";
import { z } from "zod";
import { SYSTEM_PROMPT, THEMES } from "../lib/prompt";

// Look ma no queues or kv!

// Steps
import { generateStoryPiece } from "./steps/generate-story-piece";
import {
	broadcastStoryboardImage,
	generateStoryboardImage,
} from "./steps/generate-storyboard-image";
import {
	addReactionToMessage,
	postSlackMessage,
	removeReactionFromMessage,
	updateSlackMessage,
} from "./steps/post-slack-message";

const slackMessageHookSchema = z.object({
	text: z.string(),
	ts: z.string(),
});

export const slackMessageHook = defineHook({ schema: slackMessageHookSchema });

export async function storytime(slashCommand: URLSearchParams) {
	"use workflow";
	console.log(slashCommand);

	// Initialize the workflow
	const channelId = slashCommand.get("channel_id");
	if (!channelId) {
		throw new FatalError("`channel_id` is required");
	}

	const argv = stringToArgv(slashCommand.get("text") || "");
	console.log({ argv });

	const args = arg(
		{
			"--model": String,
			"--image-model": String,
			"--theme": String,
			"--theme2": String,
			"--thinking-emoji": String,

			// Aliases
			"-m": "--model",
			"-i": "--image-model",
			"-t": "--theme",
			"-t2": "--theme2",
			"-e": "--thinking-emoji",
			"--theme1": "--theme",
		},
		{ argv },
	);

	const theme =
		args["--theme"] || THEMES[Math.floor(Math.random() * THEMES.length)];
	const theme2 =
		args["--theme2"] || THEMES[Math.floor(Math.random() * THEMES.length)];
	const model = args["--model"] || "meta/llama-4-scout";
	const imageModel = args["--image-model"] || "google/gemini-3-pro-image";
	const thinkingEmoji = args["--thinking-emoji"] || "thinking-hard";
	console.log({ theme, theme2, model, imageModel, thinkingEmoji });

	// ...including local state like the entire message history
	let finalStory = "";
	const messages: ModelMessage[] = [
		{
			role: "system",
			content: SYSTEM_PROMPT(theme, theme2),
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
			text: `${introText}\n\n> _Generating introduction…_ :${thinkingEmoji}:`,
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
	const slackMessageEvent = slackMessageHook.create({
		token: `slack-message-webhook:${channelId}:${ts}`,
	});

	// Post the initial encouragement message to start the thread
	await postSlackMessage({
		channel: channelId,
		text: aiResponse.encouragement,
		thread_ts: ts,
	});

	// Process user messages in the thread (via the webhook) in
	// a loop until the LLM decides that the story is complete
	for await (const data of slackMessageEvent) {
		messages.push({
			role: "user",
			content: data.text,
		});

		// Submit user's message to the LLM to continue the story
		const [aiResponse] = await Promise.all([
			generateStoryPiece(messages, model),
			addReactionToMessage({
				channel: channelId,
				timestamp: data.ts,
				name: thinkingEmoji,
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
				timestamp: data.ts,
				name: thinkingEmoji,
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
			text: `${finalText}\n\n_Generating storyboard image…_ :${thinkingEmoji}:`,
			thread_ts: ts,
			reply_broadcast: true,
		}),
		generateStoryboardImage(channelId, ts, finalStory, imageModel),
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
