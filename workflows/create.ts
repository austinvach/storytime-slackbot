import { FatalError, getWebhook } from "@vercel/workflow-core";
import {
	experimental_generateImage as generateImage,
	generateText,
	type ModelMessage,
	Output,
} from "ai";
import { z } from "zod";
import { openai } from "@ai-sdk/openai";

const StorytimeSchema = z.object({
	done: z.boolean(),
	encouragement: z.string(),
	story: z.string(),
});

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

async function generateStory(messages: ModelMessage[]) {
	const result = await generateText({
		model: openai.chat("gpt-5-mini"),
		messages,
		experimental_output: Output.object({
			schema: StorytimeSchema,
		}),
	});

	return result.experimental_output;
}

export async function storytime(slashCommand: URLSearchParams) {
	"use workflow";

	const channelId = slashCommand.get("channel_id");
	if (!channelId) {
		throw new FatalError("`channel_id` is required");
	}

	const messages: ModelMessage[] = [
		{
			role: "system",
			content: `You are a storytime generating bot.
    
                You will initiate the story by providing the introduction (one or two sentences),
                and the user will submit the remaining pieces of the story.
    
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
                
                You don't need to provide the intermediate story contents, just the initial introduction and the final story in the "story" field.
                When the story is complete, say a light hearted comment about the story in the "encouragement" field.`,
		},
		{
			role: "user",
			content: "Let's start a new story.",
		},
	];

	// Ask the LLM to initiate the story
	const aiResponse = await generateStory(messages);

	// Create the initial top-level message in the channel
	const {
		ts,
		message: { user: botId },
	} = await postMessage(
		`It's storytime! I'll start the story and you continue it.\n\n> ${aiResponse.story}`,
		channelId,
	);

	// Subscribe to new messages in the thread
	//const webhook = getWebhook({
	//	url: "/api/slack/webhook",
	//	body: z.object({
	//		event: z.object({
	//			type: z.literal("message"),
	//			channel: z.literal(channelId),
	//			thread_ts: z.literal(ts),

	//			// Exclude messages from the bot itself
	//			user: z.string().regex(new RegExp(`^(?!${botId}$)`)),
	//		}),
	//	}),
	//});

	// Post the initial encouragement message in the thread
	await postMessage(aiResponse.encouragement, channelId, ts);

	// Loop until the LLM decides that the story is complete
	//while (true) {
	//	const req = await webhook;
	//	const data = await req.json();
	//}
}
