export async function POST(req: Request) {
	const body = await req.json();
	console.log(body);
	if (body.type === "url_verification") {
		return new Response(body.challenge);
	}
	return new Response("Hello, world!");
}
