# Storytime Slack Bot

An interactive AI-powered Slack bot that creates collaborative children's stories with your team. Users can start a story with a slash command, and the bot will generate an introduction based on random themes. Team members can then contribute to the story in a thread, with the AI helping to guide the narrative to completion and generating a beautiful storyboard image at the end.

## Architecture

This bot is built using:

- **[Next.js 15](https://nextjs.org)** - React framework with App Router
- **[Vercel Workflows](https://vercel.com/docs/workflow)** - Durable execution for long-running processes
- **[Slack Web API](https://api.slack.com/web)** - For Slack integration
- **[Vercel AI SDK](https://sdk.vercel.ai)** - For AI model integration
- **TypeScript** - Type-safe development

The workflow architecture allows the bot to maintain state across multiple user interactions without requiring external databases or queues.

## Getting Started

### Prerequisites

- Node.js 18+ 
- pnpm (recommended) or npm
- A Slack workspace where you can install apps
- Vercel account for deployment

### 1. Clone the Repository

```bash
git clone https://github.com/vercel/storytime-slackbot.git
cd storytime-slackbot
pnpm install
```

### 2. Set Up Slack App

1. Go to [api.slack.com/apps](https://api.slack.com/apps) and create a new app
2. Choose "From scratch" and select your workspace
3. In **OAuth & Permissions**, add these Bot Token Scopes:
   - `chat:write`
   - `files:write`
   - `reactions:write`
   - `channels:history`
   - `groups:history`
   - `im:history`
   - `mpim:history`

4. In **Event Subscriptions**:
   - Enable events
   - Set Request URL to: `https://your-domain.vercel.app/api/slack/webhook`
   - Subscribe to `message.channels` workspace event

5. In **Slash Commands**, create a new command:
   - Command: `/storytime`
   - Request URL: `https://your-domain.vercel.app/api/slack/command`
   - Description: "Start a collaborative story"

6. Install the app to your workspace and copy the Bot User OAuth Token

### 3. Set Up AI Gateway API Key

1. Navigate to the [Vercel Dashboard](https://vercel.com/dashboard) and go to the AI Gateway tab
2. Click "API keys" in the left sidebar
3. Click "Create key" to generate a new API key
4. Save the API key for the next step

For more details, see the [AI Gateway Authentication documentation](https://vercel.com/docs/ai-gateway/authentication#creating-an-api-key).

### 4. Environment Variables

Create a `.env.local` file:

```bash
SLACK_BOT_TOKEN=xoxb-your-bot-token-here
AI_GATEWAY_API_KEY=your_ai_gateway_api_key
```

### 5. Development

```bash
pnpm dev
```

The app will be available at [http://localhost:3000](http://localhost:3000).

For local development with Slack webhooks, use a tool like [ngrok](https://ngrok.com/) to expose your local server:

```bash
ngrok http 3000
```

Then update your Slack app's webhook URLs to use the ngrok URL.

## Deployment

### Deploy to Vercel

1. Push your code to GitHub
2. Connect your repository to Vercel
3. Add your environment variables in the Vercel dashboard
4. Deploy!

The `vercel.json` configuration is already set up for Vercel Workflows.

### Update Slack App URLs

After deployment, update your Slack app configuration:
- Event Subscriptions Request URL: `https://your-app.vercel.app/api/slack/webhook`
- Slash Command Request URL: `https://your-app.vercel.app/api/slack/command`

## How to Use

1. In any Slack channel, type `/storytime`
2. The bot will generate a story introduction with random themes
3. Reply in the thread to add your part of the story
4. The bot will respond with encouragement and continue the narrative
5. After 2-3 iterations, the bot will conclude the story
6. A beautiful storyboard image will be generated and shared


## Development

### Local Testing

Use the included `local.ts` script for testing workflows locally:

```bash
pnpm tsx local.ts
```
