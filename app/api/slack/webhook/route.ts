export async function POST(req: Request) {
	const body = await req.json();
	console.log(body);

	// Slack Events API URL Verification
	if (body.type === "url_verification") {
		return new Response(body.challenge, {
			headers: {
				"Content-Type": "text/plain",
			},
		});
	}

	return new Response("Hello, world!");
}
