import type { ModelMessage } from "ai";
import { z } from "zod";
import { FatalError, getWebhook } from "@vercel/workflow-core";

// Steps
import { generateStoryPiece } from "./steps/generate-story-piece";
import {
	postSlackMessage,
	updateSlackMessage,
} from "./steps/post-slack-message";
import { generateStoryboardImage } from "./steps/generate-storyboard-image";

const SYSTEM_PROMPT = `
You are a storytime generating bot.

You will initiate the story by providing the introduction (one or two sentences),
and the user will submit the remaining pieces of the story. Be creative with the
introduction, and make it interesting and engaging. Possible themes include (but are not limited to):
- Magic
- Adventure
- Fantasy
- Mystery
- Horror
- Science Fiction
- Historical
- Romance
- Technology
- Animals
- Nature
- Space
- Time Travel
- Mythology
- Folklore

After 3 to 5 iterations, the story should be complete and you will take the pieces
of the story and polish it up
to have a cohesive conclusion and report the final story to the user.

After each iteration, you should provide an encouragement to the user to continue
the story (don't include instructions, just inquire about the story contents).

When the story is about to be complete, you should provide a final encouragement
to the user to finish the story.

The story
should be in the style of a children's book, with a simple vocabulary and a
clear and concise writing style. It should be short enough to be read aloud by
a child, and fit in a 4 to 6 panel comic strip.

You don't need to provide the intermediate story contents, just the initial introduction
and the final story in the "story" field (do not include information about the panel numbers).
When the story is complete, say a light hearted comment about the story in the "encouragement" field.`;

export async function storytime(slashCommand: URLSearchParams) {
	"use workflow";

	let finalStory: string | undefined;

	const channelId = slashCommand.get("channel_id");
	if (!channelId) {
		throw new FatalError("`channel_id` is required");
	}

	const messages: ModelMessage[] = [
		{
			role: "system",
			content: SYSTEM_PROMPT,
		},
		{
			role: "user",
			content: "Let's start a new story.",
		},
	];

	// Create the initial top-level message in the channel with a placeholder
	const introText = `It's storytime! I'll start the story and you continue it.`;
	const { ts, message } = await postSlackMessage({
		channel: channelId,
		text: `${introText}\n\n> _Generating introduction…_ :thinking-hard:`,
	});

	// Ask the LLM to initiate the story
	const aiResponse = await generateStoryPiece(messages);

	await updateSlackMessage({
		channel: channelId,
		ts,
		text: `${introText}\n\n> _${aiResponse.story}_`,
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
				user: z.string().regex(new RegExp(`^(?!${message?.user}$)`)),
			}),
		}),
	});

	// Post the initial encouragement message to start the thread
	await postSlackMessage({
		channel: channelId,
		text: aiResponse.encouragement,
		thread_ts: ts,
	});

	// Loop until the LLM decides that the story is complete
	while (true) {
		// Wait for a user to post a message in the thread
		const req = await webhook;

		const { ts: encouragementTs } = await postSlackMessage({
			channel: channelId,
			text: "_Processing user input…_ :thinking-hard:",
			thread_ts: ts,
		});

		const data = await req.json();

		messages.push({
			role: "user",
			content: data.event.text,
		});

		// Submit user's message to the LLM and post the encouragement
		const aiResponse = await generateStoryPiece(messages);

		await updateSlackMessage({
			channel: channelId,
			ts: encouragementTs,
			text: aiResponse.encouragement,
		});

		// If the LLM has decided that the story is complete, break the loop.
		// No more user messages will be processed after this
		if (aiResponse.done) {
			finalStory = aiResponse.story;
			break;
		}
	}

	// Post the final story and generate the storyboard image
	await Promise.all([
		postSlackMessage({
			channel: channelId,
			text: `**Here is the final story:**\n\n${finalStory
				.split("\n")
				.map((line) => `> ${line ? `_${line}_` : ""}`)
				.join("\n")}`,
			thread_ts: ts,
			reply_broadcast: true,
		}),
		generateStoryboardImage(channelId, ts, finalStory),
	]);
}
