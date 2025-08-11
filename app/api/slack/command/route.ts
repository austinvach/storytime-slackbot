export async function POST(req: Request) {
	const rawBody = await req.text();
	const formData = new URLSearchParams(rawBody);

	const channelId = formData.get("channel_id") ?? "";
	const commandText = formData.get("text") ?? "";

	if (!channelId) {
		return new Response("Missing channel_id", { status: 400 });
	}

	const slackBotToken = process.env.SLACK_BOT_TOKEN;
	if (!slackBotToken) {
		return new Response("SLACK_BOT_TOKEN is not configured", { status: 500 });
	}

	const parentMessageText = commandText.trim().length
		? commandText.trim()
		: "New post";

	try {
		// Post the parent message to the channel
		const parentResponse = await fetch(
			"https://slack.com/api/chat.postMessage",
			{
				method: "POST",
				headers: {
					Authorization: `Bearer ${slackBotToken}`,
					"Content-Type": "application/json; charset=utf-8",
				},
				body: JSON.stringify({
					channel: channelId,
					text: parentMessageText,
					unfurl_links: false,
					unfurl_media: false,
				}),
			},
		);

		type SlackPostMessageResponse = {
			ok: boolean;
			error?: string;
			ts?: string;
			channel?: string;
		};

		const parentJson: SlackPostMessageResponse = await parentResponse.json();
		if (!parentJson?.ok) {
			return new Response(
				`Slack error (parent): ${parentJson?.error ?? "unknown"}`,
				{
					status: 500,
				},
			);
		}

		const threadTimestamp: string = parentJson.ts ?? "";
		if (!threadTimestamp) {
			return new Response("Slack error: missing ts in response", {
				status: 500,
			});
		}

		// Immediately add a reply to ensure a visible thread is created
		await fetch("https://slack.com/api/chat.postMessage", {
			method: "POST",
			headers: {
				Authorization: `Bearer ${slackBotToken}`,
				"Content-Type": "application/json; charset=utf-8",
			},
			body: JSON.stringify({
				channel: channelId,
				thread_ts: threadTimestamp,
				text: "Thread started. Please reply in this thread.",
				reply_broadcast: false,
				unfurl_links: false,
				unfurl_media: false,
			}),
		});

		return new Response("Created a new threaded post.", {
			status: 200,
			headers: { "Content-Type": "text/plain" },
		});
	} catch {
		return new Response("Failed to create threaded post", { status: 500 });
	}
}
