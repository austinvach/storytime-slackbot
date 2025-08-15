import { handleWebhook } from "@vercel/workflow-core/runtime";

export async function POST(req: Request) {
	console.log("Slack webhook received");
	console.log(1, req.body, req.bodyUsed);

	const body = await req.clone().json();

	console.log(2, req.body, req.bodyUsed);

	console.log(body);

	// Slack Events API URL Verification
	if (body.type === "url_verification") {
		return new Response(body.challenge, {
			headers: {
				"Content-Type": "text/plain",
			},
		});
	}

	// TODO: validate webhook body
	// https://api.slack.com/authentication/verifying-requests-from-slack

	return handleWebhook(req);
}
