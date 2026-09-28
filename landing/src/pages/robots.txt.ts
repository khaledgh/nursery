import type { APIRoute } from "astro";
import { site } from "../data/site";

// AI assistants are named explicitly so it is unambiguous that they may read
// and cite the site (some hosts and CDNs block unknown bots by default).
const aiCrawlers = [
  "GPTBot",
  "ChatGPT-User",
  "OAI-SearchBot",
  "ClaudeBot",
  "Claude-User",
  "Claude-SearchBot",
  "anthropic-ai",
  "PerplexityBot",
  "Perplexity-User",
  "Google-Extended",
  "GoogleOther",
  "Applebot",
  "Applebot-Extended",
  "Bingbot",
  "meta-externalagent",
  "Amazonbot",
  "DuckAssistBot",
  "cohere-ai",
  "YouBot",
  "CCBot",
];

export const GET: APIRoute = () => {
  const body = [
    "User-agent: *",
    "Allow: /",
    "",
    ...aiCrawlers.flatMap((bot) => [`User-agent: ${bot}`, "Allow: /", ""]),
    `Sitemap: ${new URL("/sitemap.xml", site.url).toString()}`,
    "",
  ].join("\n");
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
};
