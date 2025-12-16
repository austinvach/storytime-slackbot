import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

import readline from "node:readline/promises";
import { generateText, type ModelMessage, Output } from "ai";
import terminalImage from "terminal-image";
import { z } from "zod";
import { IMAGE_GEN_PROMPT, SYSTEM_PROMPT, THEMES } from "./lib/prompt.ts";

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
		model: "meta/llama-4-scout",
		messages,
		experimental_output: Output.object({
			schema: StorytimeSchema,
		}),
	});
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

const result = await generateText({
	model: "google/gemini-3-pro-image",
	prompt: IMAGE_GEN_PROMPT(finalStory),
});

console.log(await terminalImage.buffer(result.files[0].uint8Array));
