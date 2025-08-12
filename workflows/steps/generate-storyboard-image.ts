import { openai } from "@ai-sdk/openai";
import { FatalError } from "@vercel/workflow-core";
import { experimental_generateImage as generateImage } from "ai";
import { slack } from "@/lib/slack";

export async function generateStoryboardImage(
	channelId: string,
	threadTs: string,
	finalStory: string,
) {
	"use step";

	const image = await generateImage({
		model: openai.image("gpt-image-1"),
		n: 1,
		prompt: `Generate an image of a children's storybook panel consisting of
        4 to 6 panels with the following story.
        
        Include text in the panels to tell the story.
        Please ensure that all panels are visible, and not being cut off.
        
        Story:
        ${finalStory}`,
	});

	const res = await slack.files.uploadV2({
		//channel_id: channelId,
		//thread_ts: threadTs,
		file: Buffer.from(image.images[0].uint8Array),
		filename: "storyboard.png",
		title: "Storyboard",
	});

	if (!res.ok) {
		throw new FatalError(`Failed to upload file: ${res.error}`);
	}

	// @ts-expect-error - files is not typed
	console.log(res.files);

	// @ts-expect-error - files is not typed
	return res.files[0].files[0].id as string;
}
