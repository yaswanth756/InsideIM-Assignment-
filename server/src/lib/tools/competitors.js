import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { getCached, setCache } from "../cache.js";

export const competitorsTool = tool(
  async ({ company, industry }) => {
    const cacheKey = `comp_${company.toLowerCase().trim()}_${industry.toLowerCase().trim()}`;
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
          query: `${company} competitors market share ${industry} industry analysis competitive landscape`,
          search_depth: "advanced",
          max_results: 5,
          include_answer: true,
        }),
      });

      const data = await res.json();
      const results = (data.results || []).map((r) => ({
        title: r.title,
        url: r.url,
        content: r.content?.slice(0, 400),
      }));

      const result = JSON.stringify({
        analysis: data.answer || "",
        results,
      });

      setCache(cacheKey, result, 30 * 60 * 1000); // 30 minutes TTL
      return result;
    } catch (err) {
      return JSON.stringify({ error: err.message, results: [] });
    }
  },
  {
    name: "analyze_competitors",
    description:
      "Analyze the competitive landscape of a company. Finds major competitors, market share data, and industry dynamics. Provide the company name and its industry.",
    schema: z.object({
      company: z.string().describe("Company name"),
      industry: z.string().describe("Industry or sector the company operates in"),
    }),
  }
);
