export async function POST(req: Request) {
	const body = await req.text();
	console.log({ body });
	return new Response("Hello, world!");
}
