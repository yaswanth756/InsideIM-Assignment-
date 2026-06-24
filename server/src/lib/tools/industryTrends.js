import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { getCached, setCache } from "../cache.js";

export const industryTrendsTool = tool(
  async ({ industry, company }) => {
    const cacheKey = `ind_${industry.toLowerCase().trim()}_${company.toLowerCase().trim()}`;
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
          query: `${industry} industry outlook ${new Date().getFullYear()} ${new Date().getFullYear() + 1} market size growth trends TAM ${company}`,
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
        outlook: data.answer || "",
        results,
      });

      setCache(cacheKey, result, 30 * 60 * 1000); // 30 minutes TTL
      return result;
    } catch (err) {
      return JSON.stringify({ error: err.message, results: [] });
    }
  },
  {
    name: "search_industry_trends",
    description:
      "Research industry-level trends, market size, growth projections, and macro factors. Use this after identifying the company's sector to understand the broader industry context, total addressable market (TAM), regulatory landscape, and secular trends.",
    schema: z.object({
      industry: z.string().describe("The industry or sector to research (e.g., Electric Vehicles, Cloud Computing, Fintech)"),
      company: z.string().describe("The company name for context"),
    }),
  }
);
