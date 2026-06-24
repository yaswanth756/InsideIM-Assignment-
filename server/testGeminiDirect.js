import "dotenv/config";
import { ChatOpenAI } from "@langchain/openai";
import { tool } from "@langchain/core/tools";
import { z } from "zod";

const testTool = tool(
  async ({ location }) => `Weather in ${location} is sunny`,
  {
    name: "get_weather",
    description: "Get weather",
    schema: z.object({
      location: z.string().describe("location")
    })
  }
);

async function main() {
  // Mock global fetch to spy on request body
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    if (url.includes("chat/completions")) {
      console.log("\n=== SPYING ON COMPLETIONS REQUEST ===");
      console.log("URL:", url);
      console.log("Headers:", JSON.stringify(options.headers, null, 2));
      console.log("Body:", JSON.stringify(JSON.parse(options.body), null, 2));
      console.log("=====================================\n");
    }
    return originalFetch(url, options);
  };

  const model = new ChatOpenAI({
    modelName: "gemini-2.5-flash",
    openAIApiKey: process.env.GEMINI_API_KEY,
    configuration: {
      baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/"
    },
    temperature: 0.1
  }).bindTools([testTool]);

  try {
    const res = await model.invoke("What is the weather in Paris?");
    console.log("SUCCESS! Response content:", res.content);
    console.log("Tool calls:", JSON.stringify(res.tool_calls, null, 2));
  } catch (err) {
    console.error("ChatOpenAI Invoke failed:", err);
  }
}

main();
