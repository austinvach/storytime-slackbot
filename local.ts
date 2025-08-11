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

const rl = readline.createInterface({
	input: process.stdin,
	output: process.stdout,
});

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

const StorytimeSchema = z.object({
	done: z.boolean(),
	encouragement: z.string(),
	story: z.string(),
});

let finalStory = "";

while (true) {
	const result = await generateText({
		//model: "openai/gpt-5",
		//model: openai.chat("gpt-5"),
		model: openai.chat("gpt-5-mini"),
		//model: openai.chat("gpt-4o"),
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
	model: openai.image("gpt-image-1"),
	//model: gateway.imageModel("openai:dall-e-3"),
	prompt: `Generate an image of a children's storybook panel consisting of
	4 to 6 panels with the following story.
	
	Include text in the panels to tell the story.
	
	Story:
	${finalStory}`,
	//providerOptions: { openai: { quality: "hd", style: "vivid" } }, // optional
});

console.log(await terminalImage.buffer(image.images[0].uint8Array));
