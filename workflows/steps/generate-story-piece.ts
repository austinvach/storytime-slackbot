import { openai } from "@ai-sdk/openai";
import { generateText, type ModelMessage, Output } from "ai";
import { z } from "zod";

const StoryPieceSchema = z.object({
	done: z.boolean().describe("Whether the story is complete"),
	encouragement: z
		.string()
		.describe("An encouragement to the user to continue the story"),
	story: z
		.string()
		.describe(
			"The story introduction or the final story (if the story is complete)",
		),
});

export async function generateStoryPiece(messages: ModelMessage[]) {
	"use step";

	const result = await generateText({
		model: openai.chat("gpt-5-mini"),
		messages,
		experimental_output: Output.object({
			schema: StoryPieceSchema,
		}),
	});

	return result.experimental_output;
}
