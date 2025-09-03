import { waitUntil } from "@vercel/functions";
import { storytime } from "@/workflows/create";

export async function POST(req: Request) {
	const rawBody = await req.text();
	const formData = new URLSearchParams(rawBody);

	waitUntil(
		(async () => {
			console.log("Starting Storytime workflow");
			const w = await storytime(formData);
			console.log(w);
		})(),
	);

	return new Response(`Let's create a story!`);
}
