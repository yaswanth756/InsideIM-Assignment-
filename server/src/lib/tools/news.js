import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { getCached, setCache } from "../cache.js";

export const newsTool = tool(
  async ({ company, focusArea }) => {
    const focusQuery = focusArea ? ` ${focusArea}` : "";
    const cacheKey = `news_${company.toLowerCase().trim()}_${focusArea?.toLowerCase().trim() || "all"}`;
    const cached = getCached(cacheKey);
    if (cached) {
      return cached;
    }

    const apiKey = process.env.TAVILY_API_KEY;
    if (!apiKey) return JSON.stringify({ error: "TAVILY_API_KEY not set", articles: [] });

    try {
      const res = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: apiKey,
          query: `${company} latest news${focusQuery} financial updates earnings analyst rating ${new Date().getFullYear()}`,
          search_depth: "advanced",
          max_results: 8,
          topic: "news",
          include_answer: true,
        }),
      });

      const data = await res.json();
      const articles = (data.results || []).map((r) => ({
        title: r.title,
        url: r.url,
        snippet: r.content?.slice(0, 400),
        publishedDate: r.published_date || null,
        source: r.url ? new URL(r.url).hostname.replace("www.", "") : "unknown",
      }));

      const result = JSON.stringify({
        summary: data.answer || "",
        articleCount: articles.length,
        articles,
      });

      setCache(cacheKey, result, 5 * 60 * 1000); // 5 minutes TTL
      return result;
    } catch (err) {
      return JSON.stringify({ error: err.message, articles: [] });
    }
  },
  {
    name: "get_news",
    description:
      "Search for recent news articles about a company. Returns latest headlines, detailed snippets, publication dates, and source domains. Use this to assess market sentiment, recent earnings reports, analyst upgrades/downgrades, product launches, legal issues, and management changes. You can optionally focus on a specific area like 'earnings' or 'regulatory'.",
    schema: z.object({
      company: z.string().describe("Company name to search news for"),
      focusArea: z.string().describe("Focus area: earnings, regulatory, product launches, management, lawsuits, or leave as empty string '' if no specific focus is needed."),
    }),
  }
);
