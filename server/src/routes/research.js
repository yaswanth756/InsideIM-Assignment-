import { Router } from "express";
import { runResearch, generateDeepDetail } from "../lib/agent.js";

const router = Router();

router.post("/", async (req, res) => {
  const { company } = req.body;

  if (!company || typeof company !== "string" || company.trim().length < 1) {
    return res.status(400).json({ error: "Company name is required" });
  }

  const companyName = company.trim();

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "Access-Control-Allow-Origin": "*",
  });

  const sendEvent = (data) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  try {
    sendEvent({ type: "status", step: "init", message: `Researching ${companyName}...` });

    await runResearch(companyName, (stepData) => {
      sendEvent(stepData);
    });
  } catch (err) {
    console.error("Research error:", err);
    sendEvent({ type: "error", message: err.message || "Research failed" });
  } finally {
    res.end();
  }
});

router.post("/deep-detail", async (req, res) => {
  const { company, type } = req.body;

  if (!company || typeof company !== "string" || company.trim().length < 1) {
    return res.status(400).json({ error: "Company name is required" });
  }
  if (!type || typeof type !== "string" || type.trim().length < 1) {
    return res.status(400).json({ error: "Type is required" });
  }

  try {
    const data = await generateDeepDetail(company.trim(), type.trim());
    res.json({ status: "success", data });
  } catch (err) {
    console.error("Deep detail generation error:", err);
    res.status(500).json({ error: err.message || "Failed to generate deep detail" });
  }
});

export default router;
