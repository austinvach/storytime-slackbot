import readline from "node:readline/promises";
import { generateText, type ModelMessage, Output } from "ai";
import dotenv from "dotenv";
import { z } from "zod";

dotenv.config({ path: ".env.local" });

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
			
			You don't need to provide the partial story contents, just the final story.
			When the story is complete, say a light hearted comment about the story.`,
	},
	{
		role: "user",
		content: "Let's start a new story.",
	},
];

const StorytimeSchema = z.object({
	done: z.boolean(),
	encouragement: z.string(),
	finalStory: z.string(),
});

let finalStory = "";

while (true) {
	const result = await generateText({
		model: "openai/gpt-5",
		messages,
		experimental_output: Output.object({
			schema: StorytimeSchema,
		}),
	});
	console.log(result.experimental_output?.encouragement);

	messages.push({
		role: "assistant",
		content: result.text,
	});

	if (result.experimental_output?.done) {
		finalStory = result.experimental_output.finalStory;
		break;
	}

	// read user input
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
