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
	"use step";

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
		`It's storytime! I'll start the story and you continue it.\n\n> _${aiResponse.story}_`,
		channelId,
	);

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

	// Post the initial encouragement message in the thread
	await postMessage(aiResponse.encouragement, channelId, ts);

	let finalStory: string | undefined;

	// Loop until the LLM decides that the story is complete
	while (true) {
		const req = await webhook;
		const data = await req.json();
		console.log(data);

		if (!data.event.text) {
			continue;
		}

		const userMessage = data.event.text;
		messages.push({
			role: "user",
			content: userMessage,
		});

		const aiResponse = await generateStory(messages);
		await postMessage(aiResponse.encouragement, channelId, ts);

		if (aiResponse.done) {
			finalStory = aiResponse.story;
			break;
		}
	}

	await Promise.all([
		postMessage(
			`Here is the final story:\n\n${finalStory
				.split("\n")
				.map((line) => `> ${line ? `_${line}_` : ""}`)
				.join("\n")}`,
			channelId,
			ts,
			true,
		),
		postComicStrip(channelId, ts, finalStory),
	]);
}

async function postComicStrip(
	channelId: string,
	threadTs: string,
	finalStory: string,
) {
	"use step";

	const image = await generateImage({
		model: openai.image("gpt-image-1"),
		prompt: `Generate an image of a children's storybook panel consisting of
        4 to 6 panels with the following story.
        
        Include text in the panels to tell the story.
        Please ensure that all panels are visible, and not being cut off.
        
        Story:
        ${finalStory}`,
	});
	console.log(image);

	const buffer = image.images[0].uint8Array as Uint8Array;

	const slackToken = process.env.SLACK_BOT_TOKEN;
	if (!slackToken) {
		throw new FatalError("SLACK_BOT_TOKEN is not configured");
	}

	// 1) Get pre-signed upload URL
	const getUrlRes = await fetch(
		"https://slack.com/api/files.getUploadURLExternal",
		{
			method: "POST",
			headers: {
				Authorization: `Bearer ${slackToken}`,
				"Content-Type": "application/x-www-form-urlencoded",
			},
			body: new URLSearchParams({
				filename: "comic-strip.png",
				length: String(buffer.length),
				alt_txt: "Comic strip",
			}),
		},
	);
	if (!getUrlRes.ok) {
		throw new FatalError(
			`Failed to initiate Slack upload: ${getUrlRes.status} ${getUrlRes.statusText}`,
		);
	}

	type GetUploadUrlResponse = {
		ok: boolean;
		upload_url?: string;
		file_id?: string;
		error?: string;
	};

	const getUrlJson: GetUploadUrlResponse = await getUrlRes.json();
	console.log(getUrlJson);

	if (!getUrlJson.ok || !getUrlJson.upload_url || !getUrlJson.file_id) {
		throw new FatalError(
			`Slack getUploadURLExternal error: ${getUrlJson.error ?? "unknown"}`,
		);
	}

	// 2) Upload bytes to the provided URL
	const putRes = await fetch(getUrlJson.upload_url, {
		method: "POST",
		headers: {
			"Content-Type": "image/png",
		},
		body: Buffer.from(buffer),
	});
	if (!putRes.ok) {
		throw new FatalError(
			`Failed to POST file bytes to Slack: ${putRes.status} ${putRes.statusText}`,
		);
	}

	// 3) Complete upload and share into the thread
	const completeRes = await fetch(
		"https://slack.com/api/files.completeUploadExternal",
		{
			method: "POST",
			headers: {
				Authorization: `Bearer ${slackToken}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				files: [{ id: getUrlJson.file_id, title: "comic-strip.png" }],
				channel_id: channelId,
				thread_ts: threadTs,
				initial_comment: "Here is the comic strip!",
			}),
		},
	);
	if (!completeRes.ok) {
		throw new FatalError(
			`Failed to complete Slack upload: ${completeRes.status} ${completeRes.statusText}`,
		);
	}

	type CompleteUploadResponse = { ok: boolean; error?: string };
	const completeJson: CompleteUploadResponse = await completeRes.json();
	if (!completeJson.ok) {
		throw new FatalError(
			`Slack completeUploadExternal error: ${completeJson.error ?? "unknown"}`,
		);
	}
}
