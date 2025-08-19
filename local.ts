import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import readline from "node:readline/promises";
import {
	experimental_generateImage as generateImage,
	generateText,
	type ModelMessage,
	Output,
} from "ai";
import { z } from "zod";
import { openai } from "@ai-sdk/openai";
import terminalImage from "terminal-image";
import { SYSTEM_PROMPT, THEMES, IMAGE_GEN_PROMPT } from "./lib/prompt.ts";

const rl = readline.createInterface({
	input: process.stdin,
	output: process.stdout,
});

const theme = THEMES[Math.floor(Math.random() * THEMES.length)];
const theme2 = THEMES[Math.floor(Math.random() * THEMES.length)];
console.log(`Theme: ${theme}`);
console.log(`Theme2: ${theme2}`);

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

const StorytimeSchema = z.object({
	done: z.boolean(),
	encouragement: z.string(),
	story: z.string(),
});

let finalStory = "";

while (true) {
	const result = await generateText({
		//model: "openai/gpt-5-mini",
		//model: "anthropic/claude-4-sonnet",
		//model: "xai/grok-4",
		model: "meta/llama-4-scout",
		messages,
		experimental_output: Output.object({
			schema: StorytimeSchema,
		}),
	});
	//console.log(result.experimental_output?.encouragement);
	console.log(result.experimental_output);

	messages.push({
		role: "assistant",
		content: result.text,
	});

	if (result.experimental_output?.done) {
		finalStory = result.experimental_output.story;
		break;
	}

	// read user input
	console.log("");
	const userInput = await rl.question("Enter your story piece: ");

	messages.push({
		role: "user",
		content: userInput,
	});
}

rl.close();

console.log("");
console.log("Here is the final story:");
console.log(finalStory);

const image = await generateImage({
	//model: gateway.imageModel("xai:grok-2-vision"),
	model: openai.image("gpt-image-1"),
	//model: gateway.imageModel("xai:grok-2-image"), // provider:model
	n: 1,
	prompt: IMAGE_GEN_PROMPT(finalStory),
});

console.log(await terminalImage.buffer(image.images[0].uint8Array));
