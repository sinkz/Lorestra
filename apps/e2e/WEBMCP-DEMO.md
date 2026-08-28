# Local WebMCP evidence

This is a local browser check for the real WebMCP registration. It does not use a fake `modelContext` or require a public deployment.

1. Start the web app: `corepack pnpm --filter @lorestra/web dev --host 127.0.0.1 --port 4175`.
2. In another terminal, run `corepack pnpm --filter @lorestra/e2e demo:webmcp`. Set `WEBMCP_DEMO_URL` if the app uses another URL, or `WEBMCP_BROWSER_CHANNEL=chrome` to select an installed compatible Chrome channel.
3. The script opens a visible browser and prints `registerTool: true`, `status: "registered"`, and `registeredTools: 10`. A browser without WebMCP exits with a clear setup error instead of claiming success.
4. With a connected browser-agent surface, invoke `lorestra_get_agent_guide` first, then `lorestra_search` with `{ "query": "architecture", "limit": 3 }`. Save the JSON output and the terminal evidence with the hackathon submission.

The page exposes only the registration status/count as `data-webmcp` attributes; content remains behind the registered tools and is still marked untrusted by the tool annotations.
