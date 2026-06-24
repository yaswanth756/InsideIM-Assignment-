import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { getCached, setCache } from "../cache.js";

export const webSearchTool = tool(
  async ({ query }) => {
    const cacheKey = `tavily_${query.toLowerCase().trim()}`;
    const cached = getCached(cacheKey);
    if (cached) {
      return cached;
    }

    const apiKey = process.env.TAVILY_API_KEY;
    if (!apiKey) return JSON.stringify({ error: "TAVILY_API_KEY not set", results: [] });

    try {
      const res = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: apiKey,
          query,
          search_depth: "advanced",
          max_results: 8,
          include_answer: true,
          include_raw_content: false,
        }),
      });

      const data = await res.json();
      const results = (data.results || []).map((r) => ({
        title: r.title,
        url: r.url,
        content: r.content?.slice(0, 600),
        score: r.score,
      }));

      const result = JSON.stringify({
        answer: data.answer || "",
        resultCount: results.length,
        results,
      });

      setCache(cacheKey, result, 30 * 60 * 1000); // 30 minutes TTL
      return result;
    } catch (err) {
      return JSON.stringify({ error: err.message, results: [] });
    }
  },
  {
    name: "web_search",
    description:
      "Search the web for comprehensive information about a company. Use this to find: company background, business model, leadership team, stock ticker symbol, recent developments, funding history (for private companies), revenue estimates, market position, and any other relevant information. You can call this multiple times with different queries to gather more data.",
    schema: z.object({
      query: z.string().describe("Detailed search query — be specific for better results"),
    }),
  }
);
