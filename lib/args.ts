import arg from "arg";
import { THEMES } from "./prompt";

export interface StorytimeArgs {
	themes: string[];
	model: string;
	imageModel: string;
	thinkingEmoji: string;
}

export function parseStorytimeArgs(argv: string[]): StorytimeArgs {
	const args = arg(
		{
			"--model": String,
			"--image-model": String,
			"--theme": [String],
			"--thinking-emoji": String,

			// Aliases
			"-m": "--model",
			"-i": "--image-model",
			"-t": "--theme",
			"-e": "--thinking-emoji",
		},
		{ argv },
	);

	// Build themes array - default to 2 random themes if fewer than 2 provided
	const themes = [...(args["--theme"] || [])];
	while (themes.length < 2) {
		themes.push(THEMES[Math.floor(Math.random() * THEMES.length)]);
	}

	return {
		themes,
		model: args["--model"] || "meta/llama-4-scout",
		imageModel: args["--image-model"] || "google/gemini-3-pro-image",
		thinkingEmoji: args["--thinking-emoji"] || "thinking_face",
	};
}

