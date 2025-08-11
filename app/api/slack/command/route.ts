import { start } from "@vercel/workflow-core/runtime";
import { after } from "next/server";

export async function POST(req: Request) {
	const rawBody = await req.text();
	const formData = new URLSearchParams(rawBody);

	after(async () => {
		console.log("Starting Storytime workflow");
		const w = await start("storytime", [formData]);
		console.log(w);
	});

	return new Response(`Let's create a story!`);
}
