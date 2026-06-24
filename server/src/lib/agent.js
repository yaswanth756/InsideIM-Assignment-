import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { webSearchTool } from "./tools/webSearch.js";
import { financialsTool } from "./tools/financials.js";
import { newsTool } from "./tools/news.js";
import { competitorsTool } from "./tools/competitors.js";
import { industryTrendsTool } from "./tools/industryTrends.js";
import {
  FINANCIAL_ANALYST_PROMPT,
  MOAT_ANALYST_PROMPT,
  SENTIMENT_ANALYST_PROMPT,
  RISK_ANALYST_PROMPT,
  MACRO_ANALYST_PROMPT,
  MANAGEMENT_ANALYST_PROMPT,
  SUPERVISOR_PROMPT,
  CORE_VERDICT_PROMPT,
  DEEP_FINANCIAL_PROMPT,
  FULL_RISK_MATRIX_PROMPT,
  COMPETITOR_BREAKDOWN_PROMPT,
  NEWS_DETAILS_PROMPT,
} from "./analysisPrompts.js";
import {
  preprocessFinancials,
  preprocessSearchResults,
  preprocessNews,
  preprocessCompetitors,
  preprocessIndustry,
  buildCompactContext,
} from "./preprocessor.js";
import { withRetry, createTimer } from "./retry.js";
import { getCached, setCache } from "./cache.js";

// ── Provider Detection ──
function getProvider() {
  if (process.env.DEEPSEEK_API_KEY) return "deepseek";
  if (process.env.GEMINI_API_KEY) return "gemini";
  return "openai";
}

function createSpecialistModel() {
  const provider = getProvider();
  if (provider === "gemini") {
    return new ChatOpenAI({
      modelName: "gemini-2.5-flash",
      apiKey: process.env.GEMINI_API_KEY,
      configuration: {
        baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/"
      },
      temperature: 0.2,
      maxTokens: 4096,
    });
  }
  if (provider === "deepseek") {
    return new ChatOpenAI({
      modelName: "deepseek-chat",
      apiKey: process.env.DEEPSEEK_API_KEY,
      configuration: { baseURL: "https://api.deepseek.com/v1" },
      temperature: 0.2,
      maxTokens: 4096,
    });
  }
  return new ChatOpenAI({ modelName: "gpt-4o-mini", temperature: 0.2, maxTokens: 4096 });
}

function createSupervisorModel() {
  const provider = getProvider();
  if (provider === "gemini") {
    return new ChatOpenAI({
      modelName: "gemini-2.5-flash",
      apiKey: process.env.GEMINI_API_KEY,
      configuration: {
        baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/"
      },
      temperature: 0.15,
      maxTokens: 8192,
    });
  }
  if (provider === "deepseek") {
    return new ChatOpenAI({
      modelName: "deepseek-chat",
      apiKey: process.env.DEEPSEEK_API_KEY,
      configuration: { baseURL: "https://api.deepseek.com/v1" },
      temperature: 0.15,
      maxTokens: 8192,
    });
  }
  return new ChatOpenAI({ modelName: "gpt-4o-mini", temperature: 0.15, maxTokens: 8192 });
}

// ── Safe JSON Parse (handles markdown fences, trailing commas etc.) ──
function safeJsonParse(content, label) {
  // Strategy 1: Direct parse
  try { return JSON.parse(content.trim()); } catch { /* continue */ }

  // Strategy 2: Strip markdown fences
  try {
    const stripped = content
      .replace(/^[\s\S]*?```(?:json)?\s*\n?/i, "")
      .replace(/\n?\s*```[\s\S]*$/i, "")
      .trim();
    return JSON.parse(stripped);
  } catch { /* continue */ }

  // Strategy 3: Extract outermost { ... } block
  const braceMatch = content.match(/\{[\s\S]*\}/);
  if (braceMatch) {
    try { return JSON.parse(braceMatch[0]); } catch { /* continue */ }
    // Strategy 4: Fix trailing commas
    try {
      const fixed = braceMatch[0]
        .replace(/,\s*([\]}])/g, "$1")
        .replace(/(["'])?([\w]+)(["'])?\s*:/g, '"$2":')
        .replace(/:\s*'([^']*)'/g, ':"$1"');
      return JSON.parse(fixed);
    } catch { /* continue */ }
  }

  // Strategy 5: Try JSON array
  const arrayMatch = content.match(/\[[\s\S]*\]/);
  if (arrayMatch) {
    try { return JSON.parse(arrayMatch[0]); } catch { /* continue */ }
  }

  console.warn(`[${label}] JSON parse failed. Raw (first 500 chars):`);
  console.warn(content.slice(0, 500));
  return null;
}

// ── PHASE 1: Direct Tool Calls (bypass LangGraph agent) ──
// This is the fix — Gemini via OpenAI compat doesn't reliably do tool calls
// through LangGraph, so we call tools directly in parallel.

async function directDataIngestion(company, onStep) {
  const timer = createTimer();
  const toolCallLog = [];
  const currentYear = new Date().getFullYear();

  console.log(`[ingestion] Starting direct data fetch for "${company}"`);

  // Step 1: Web search to discover ticker + basic info
  if (onStep) onStep({ type: "status", step: "research", message: `🔍 Searching: ${company} overview, business model, stock ticker...` });

  let webResult1;
  try {
    webResult1 = await webSearchTool.invoke({ query: `${company} company overview business model stock ticker revenue CEO founded` });
    toolCallLog.push("web_search");
    console.log(`[ingestion] ✅ Web search 1 complete (${timer.elapsedStr()})`);
  } catch (err) {
    console.error(`[ingestion] ❌ Web search 1 failed:`, err.message);
    webResult1 = JSON.stringify({ error: err.message, results: [] });
  }

  // Try to extract ticker from web search
  let ticker = company.toUpperCase();
  const tickerMap = {
    TESLA: "TSLA", APPLE: "AAPL", GOOGLE: "GOOGL", ALPHABET: "GOOGL",
    MICROSOFT: "MSFT", AMAZON: "AMZN", META: "META", FACEBOOK: "META",
    NVIDIA: "NVDA", NETFLIX: "NFLX", DISNEY: "DIS", RELIANCE: "RELIANCE.NS",
    TCS: "TCS.NS", INFOSYS: "INFY", WIPRO: "WIT", JPMORGAN: "JPM",
    "COCA-COLA": "KO", COCACOLA: "KO", BOEING: "BA", WALMART: "WMT",
    SAMSUNG: "005930.KS", TOYOTA: "TM", SONY: "SONY",
  };
  if (tickerMap[company.toUpperCase()]) {
    ticker = tickerMap[company.toUpperCase()];
  } else if (company.length <= 5 && /^[A-Z.]+$/i.test(company)) {
    ticker = company.toUpperCase();
  }

  console.log(`[ingestion] Using ticker: ${ticker}`);

  // ── PHASE 1A: Financials FIRST (to extract real sector/industry) ──
  if (onStep) onStep({ type: "status", step: "research", message: `📊 Pulling financials for ${ticker}...` });

  let financialsResult;
  let detectedSector = "general";
  let detectedIndustry = "general";
  try {
    const fmpRaw = await financialsTool.invoke({ symbol: ticker });
    toolCallLog.push("get_financial_data");
    console.log(`[ingestion] ✅ Financials complete (${timer.elapsedStr()})`);

    // Extract sector/industry from FMP response BEFORE firing other tools
    try {
      const fmpParsed = typeof fmpRaw === "string" ? JSON.parse(fmpRaw) : fmpRaw;
      if (fmpParsed.sector && fmpParsed.sector !== "N/A") {
        detectedSector = fmpParsed.sector;
      }
      if (fmpParsed.industry && fmpParsed.industry !== "N/A") {
        detectedIndustry = fmpParsed.industry;
      }
    } catch { /* sector extraction failed, use fallback */ }

    financialsResult = { status: "fulfilled", value: fmpRaw };
  } catch (err) {
    console.error(`[ingestion] ❌ Financials failed:`, err.message);
    financialsResult = { status: "rejected", reason: err };
  }

  console.log(`[ingestion] Detected sector: "${detectedSector}", industry: "${detectedIndustry}"`);

  // ── PHASE 1B: Fire remaining tools with REAL industry context ──
  const industryForSearch = detectedIndustry !== "general" ? detectedIndustry : detectedSector;

  const [newsResult, competitorsResult, industryResult, webResult2] = await Promise.allSettled([
    // News
    (async () => {
      if (onStep) onStep({ type: "status", step: "research", message: `📰 Scanning news for ${company}...` });
      const res = await newsTool.invoke({ company, focusArea: "" });
      toolCallLog.push("get_news");
      console.log(`[ingestion] ✅ News complete (${timer.elapsedStr()})`);
      return res;
    })(),

    // Competitors — now uses REAL industry
    (async () => {
      if (onStep) onStep({ type: "status", step: "research", message: `⚔️ Mapping competitive landscape in ${industryForSearch}...` });
      const res = await competitorsTool.invoke({ company, industry: industryForSearch });
      toolCallLog.push("analyze_competitors");
      console.log(`[ingestion] ✅ Competitors complete (${timer.elapsedStr()})`);
      return res;
    })(),

    // Industry trends — now uses REAL industry
    (async () => {
      if (onStep) onStep({ type: "status", step: "research", message: `🌍 Researching ${industryForSearch} trends...` });
      const res = await industryTrendsTool.invoke({ industry: industryForSearch, company });
      toolCallLog.push("search_industry_trends");
      console.log(`[ingestion] ✅ Industry trends complete (${timer.elapsedStr()})`);
      return res;
    })(),

    // Second web search for deeper insights — dynamic year
    (async () => {
      const res = await webSearchTool.invoke({ query: `${company} stock analysis investment thesis ${currentYear} bull bear case` });
      toolCallLog.push("web_search");
      console.log(`[ingestion] ✅ Web search 2 complete (${timer.elapsedStr()})`);
      return res;
    })(),
  ]);

  console.log(`[ingestion] All tools complete (${timer.elapsedStr()}). Processing results...`);

  // Process results — handle both fulfilled and rejected promises
  const getResult = (settled) => settled.status === "fulfilled" ? settled.value : JSON.stringify({ error: settled.reason?.message || "Tool failed" });

  const toolData = {
    webSearch: [
      preprocessSearchResults(webResult1),
      preprocessSearchResults(getResult(webResult2)),
    ],
    financials: preprocessFinancials(getResult(financialsResult)),
    news: preprocessNews(getResult(newsResult)),
    competitors: preprocessCompetitors(getResult(competitorsResult)),
    industry: preprocessIndustry(getResult(industryResult)),
  };

  // ── Collect source URLs for trust layer ──
  const sourceUrls = [];
  const seenUrls = new Set();

  // Helper to add unique sources
  const addSource = (title, url, sourceType) => {
    if (!url || seenUrls.has(url)) return;
    seenUrls.add(url);
    let domain = "";
    try { domain = new URL(url).hostname.replace("www.", ""); } catch { domain = "unknown"; }
    sourceUrls.push({ title: title?.slice(0, 120) || domain, url, domain, type: sourceType });
  };

  // Extract from raw tool results (before preprocessing stripped URLs)
  try {
    const ws1 = typeof webResult1 === "string" ? JSON.parse(webResult1) : webResult1;
    (ws1.results || []).forEach(r => addSource(r.title, r.url, "web"));
  } catch { /* ok */ }
  try {
    const ws2Raw = getResult(webResult2);
    const ws2 = typeof ws2Raw === "string" ? JSON.parse(ws2Raw) : ws2Raw;
    (ws2.results || []).forEach(r => addSource(r.title, r.url, "web"));
  } catch { /* ok */ }
  try {
    const newsRaw = getResult(newsResult);
    const news = typeof newsRaw === "string" ? JSON.parse(newsRaw) : newsRaw;
    (news.articles || []).forEach(a => addSource(a.title, a.url, "news"));
  } catch { /* ok */ }
  try {
    const compRaw = getResult(competitorsResult);
    const comp = typeof compRaw === "string" ? JSON.parse(compRaw) : compRaw;
    (comp.results || []).forEach(r => addSource(r.title, r.url, "competitors"));
  } catch { /* ok */ }
  try {
    const indRaw = getResult(industryResult);
    const ind = typeof indRaw === "string" ? JSON.parse(indRaw) : indRaw;
    (ind.results || []).forEach(r => addSource(r.title, r.url, "industry"));
  } catch { /* ok */ }

  // Log data quality
  console.log(`[ingestion] Data quality check:`);
  console.log(`  webSearch: ${toolData.webSearch.filter(w => !w.error).length}/${toolData.webSearch.length} successful`);
  console.log(`  financials: ${toolData.financials.error ? '❌ ' + toolData.financials.error : '✅ has data'}`);
  console.log(`  news: ${toolData.news.error ? '❌ ' + toolData.news.error : '✅ has data'}`);
  console.log(`  competitors: ${toolData.competitors.error ? '❌ ' + toolData.competitors.error : '✅ has data'}`);
  console.log(`  industry: ${toolData.industry.error ? '❌ ' + toolData.industry.error : '✅ has data'}`);
  console.log(`  sources: ${sourceUrls.length} unique URLs collected`);

  return { toolData, toolCallLog, sourceUrls };
}

// ── PHASE 2: Specialist Agents (parallel) ──

async function runSpecialist(prompt, context, label) {
  const model = createSpecialistModel();
  console.log(`[specialist] ${label} starting...`);
  const specTimer = createTimer();

  const response = await withRetry(
    () => model.invoke([
      new SystemMessage(prompt),
      new HumanMessage(`Analyze this data and respond with ONLY valid JSON — no markdown fences, no explanatory text before or after the JSON object:\n\n${context}`),
    ]),
    { label }
  );

  const content = typeof response.content === "string" ? response.content : JSON.stringify(response.content);
  const parsed = safeJsonParse(content, label);

  console.log(`[specialist] ${label} complete (${specTimer.elapsedStr()}) — ${parsed ? '✅ valid JSON' : '❌ parse failed'}`);
  return parsed;
}

function getSpecialistConfig(toolData, company) {
  const webContext = toolData.webSearch.map((ws, i) => buildCompactContext(`Web Search ${i + 1}`, ws)).join("\n\n");
  const finContext = buildCompactContext("Financial Data", toolData.financials);
  const newsContext = buildCompactContext("News Data", toolData.news);
  const compContext = buildCompactContext("Competitive Data", toolData.competitors);
  const indContext = buildCompactContext("Industry Trends", toolData.industry);

  return {
    financial: {
      prompt: FINANCIAL_ANALYST_PROMPT,
      context: `${finContext}\n\n${webContext}`,
      label: "Financial Analyst",
      status: "📊 Financial analyst crunching numbers...",
    },
    moat: {
      prompt: MOAT_ANALYST_PROMPT,
      context: `${compContext}\n\n${webContext}`,
      label: "Moat Analyst",
      status: "🏰 Moat analyst evaluating competitive advantages...",
    },
    sentiment: {
      prompt: SENTIMENT_ANALYST_PROMPT,
      context: newsContext,
      label: "Sentiment Analyst",
      status: "📰 Sentiment analyst scanning market mood...",
    },
    risk: {
      prompt: RISK_ANALYST_PROMPT,
      context: `${finContext}\n\n${newsContext}\n\n${compContext}`,
      label: "Risk Analyst",
      status: "⚠️ Risk analyst identifying threats...",
    },
    macro: {
      prompt: MACRO_ANALYST_PROMPT,
      context: `${indContext}\n\n${webContext}`,
      label: "Macro Analyst",
      status: "🌍 Macro analyst reviewing industry trends...",
    },
    management: {
      prompt: MANAGEMENT_ANALYST_PROMPT,
      context: `${finContext}\n\n${webContext}`,
      label: "Management Analyst",
      status: "👔 Management analyst assessing leadership...",
    },
  };
}

// ── PHASE 3: Supervisor Synthesis ──

async function supervisorSynthesize(analyses, toolData, company, onStep) {
  if (onStep) onStep({ type: "status", step: "verdict", message: "🎯 CIO synthesizing final investment verdict..." });

  const model = createSupervisorModel();

  const profile = toolData.financials?.data
    ? `Company: ${toolData.financials.data.companyName || company}
Ticker: ${toolData.financials.data.symbol || "N/A"}
Sector: ${toolData.financials.data.sector || "N/A"}
Industry: ${toolData.financials.data.industry || "N/A"}
Exchange: ${toolData.financials.data.exchange || "N/A"}
Employees: ${toolData.financials.data.employees || "N/A"}
CEO: ${toolData.financials.data.ceo || "N/A"}
Description: ${toolData.financials.data.description || "N/A"}`
    : `Company: ${company}`;

  const input = `=== COMPANY PROFILE ===
${profile}

=== FINANCIAL ANALYST (25% weight) ===
${JSON.stringify(analyses.financial || { error: "No data" })}

=== MOAT/COMPETITIVE ANALYST (20% weight) ===
${JSON.stringify(analyses.moat || { error: "No data" })}

=== RISK ANALYST (20% weight) ===
${JSON.stringify(analyses.risk || { error: "No data" })}

=== MACRO/INDUSTRY ANALYST (15% weight) ===
${JSON.stringify(analyses.macro || { error: "No data" })}

=== MANAGEMENT ANALYST (10% weight) ===
${JSON.stringify(analyses.management || { error: "No data" })}

=== SENTIMENT/NEWS ANALYST (10% weight) ===
${JSON.stringify(analyses.sentiment || { error: "No data" })}`;

  console.log(`[supervisor] Starting synthesis (context: ${input.length} chars)...`);

  const response = await withRetry(
    () => model.invoke([
      new SystemMessage(SUPERVISOR_PROMPT),
      new HumanMessage(`Synthesize these 6 analyst reports into the final investment decision. Respond with ONLY the JSON object — no markdown fences, no text before or after:\n\n${input}`),
    ]),
    { label: "Supervisor" }
  );

  const content = typeof response.content === "string" ? response.content : JSON.stringify(response.content);
  const result = safeJsonParse(content, "Supervisor");

  console.log(`[supervisor] Complete — verdict: ${result?.verdict}, confidence: ${result?.confidence}`);
  return result;
}

// ── MAIN PIPELINE ──

async function generateCoreVerdict(company, toolData, sourceUrls) {
  const model = createSupervisorModel();
  console.log(`[pipeline] Generating core verdict for ${company}...`);
  const timer = createTimer();

  const webContext = toolData.webSearch.map((ws, i) => buildCompactContext(`Web Search ${i + 1}`, ws)).join("\n\n");
  const finContext = buildCompactContext("Financial Data", toolData.financials);
  const newsContext = buildCompactContext("News Data", toolData.news);
  const compContext = buildCompactContext("Competitive Data", toolData.competitors);
  const indContext = buildCompactContext("Industry Trends", toolData.industry);

  const context = `Overview and data summaries collected:
=== Financial Overview ===
${finContext}

=== News & Sentiment Overview ===
${newsContext}

=== Competitors Overview ===
${compContext}

=== Industry Trends Overview ===
${indContext}

=== Web Search Insights ===
${webContext}`;

  const response = await withRetry(
    () => model.invoke([
      new SystemMessage(CORE_VERDICT_PROMPT),
      new HumanMessage(`Analyze the raw data and produce the core investment verdict JSON structure for ${company}:\n\n${context}`),
    ]),
    { label: "Core Verdict" }
  );

  const content = typeof response.content === "string" ? response.content : JSON.stringify(response.content);
  const parsed = safeJsonParse(content, "Core Verdict");
  console.log(`[pipeline] Core verdict generated in ${timer.elapsedStr()}`);
  return parsed;
}

export async function generateDeepDetail(company, type) {
  const cacheKey = company.toLowerCase().trim();
  const rawData = getCached("raw:" + cacheKey);
  if (!rawData) {
    throw new Error("Raw data cache expired or not found. Please re-run the research query first.");
  }

  const { toolData } = rawData;
  const model = createSpecialistModel();
  const timer = createTimer();

  let prompt = "";
  let context = "";
  let label = "";

  const webContext = toolData.webSearch.map((ws, i) => buildCompactContext(`Web Search ${i + 1}`, ws)).join("\n\n");
  const finContext = buildCompactContext("Financial Data", toolData.financials);
  const newsContext = buildCompactContext("News Data", toolData.news);
  const compContext = buildCompactContext("Competitive Data", toolData.competitors);
  const indContext = buildCompactContext("Industry Trends", toolData.industry);

  if (type === "financial") {
    prompt = DEEP_FINANCIAL_PROMPT;
    context = `${finContext}\n\n${webContext}`;
    label = "Deep Financial Analyst";
  } else if (type === "risk") {
    prompt = FULL_RISK_MATRIX_PROMPT;
    context = `${finContext}\n\n${newsContext}\n\n${compContext}`;
    label = "Deep Risk Analyst";
  } else if (type === "moat") {
    prompt = COMPETITOR_BREAKDOWN_PROMPT;
    context = `${compContext}\n\n${webContext}`;
    label = "Deep Moat Competitor Breakdown";
  } else if (type === "sentiment") {
    prompt = NEWS_DETAILS_PROMPT;
    context = `${newsContext}\n\n${webContext}`;
    label = "Deep Sentiment Analyst";
  } else {
    throw new Error(`Invalid deep detail type: ${type}`);
  }

  console.log(`[deep-detail] Generating ${type} detail for ${company}...`);

  const response = await withRetry(
    () => model.invoke([
      new SystemMessage(prompt),
      new HumanMessage(`Analyze the data and respond with ONLY valid JSON — no markdown fences, no explanatory text:\n\n${context}`),
    ]),
    { label }
  );

  const content = typeof response.content === "string" ? response.content : JSON.stringify(response.content);
  const parsed = safeJsonParse(content, label);

  console.log(`[deep-detail] Completed in ${timer.elapsedStr()}`);
  return parsed;
}

// ── MAIN PIPELINE ──

export async function runResearch(company, onStep) {
  const timer = createTimer();
  const cacheKey = company.toLowerCase().trim();

  // Check cache for final report
  const cachedReport = getCached("report:" + cacheKey);
  if (cachedReport) {
    if (onStep) {
      onStep({ type: "status", step: "cache", message: "Found cached research (< 30 min old)..." });
      onStep({ type: "verdict", data: cachedReport });
      const specKeys = ["financialAnalysis", "competitivePosition", "newsSentiment", "riskAssessment", "industryOutlook", "managementAnalysis"];
      for (const key of specKeys) {
        if (cachedReport[key]) {
          onStep({ type: "specialist", key, data: cachedReport[key] });
        }
      }
      onStep({ type: "done" });
    }
    return cachedReport;
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log(`[pipeline] Starting research for "${company}"`);
  console.log(`[pipeline] Provider: ${getProvider()}`);
  console.log(`${"=".repeat(60)}\n`);

  if (onStep) onStep({ type: "status", step: "init", message: `Starting deep research on ${company}...` });

  // ── PHASE 1: Direct tool calls ──
  console.log(`[pipeline] PHASE 1: Data Ingestion`);
  const { toolData, toolCallLog, sourceUrls } = await directDataIngestion(company, onStep);
  console.log(`[pipeline] Phase 1 complete (${timer.elapsedStr()}) — ${toolCallLog.length} tool calls\n`);

  // Cache raw tool data immediately
  setCache("raw:" + cacheKey, { toolData, sourceUrls, toolCallLog });

  // ── PHASE 1.5: Core Verdict ──
  if (onStep) onStep({ type: "status", step: "verdict", message: "Preparing core verdict..." });
  const coreVerdict = await generateCoreVerdict(company, toolData, sourceUrls);
  if (!coreVerdict) throw new Error("Failed to generate core investment verdict");

  // Attach metadata
  coreVerdict._meta = {
    toolsUsed: [...new Set(toolCallLog)],
    toolCallCount: toolCallLog.length,
    totalTime: timer.elapsedStr(),
    researchedAt: new Date().toISOString(),
    architecture: "hybrid-streaming-pipeline",
    sources: (sourceUrls || []).slice(0, 15),
  };

  if (onStep) {
    onStep({ type: "verdict", data: coreVerdict });
  }

  // ── PHASE 2: Run 6 specialists in parallel ──
  console.log(`[pipeline] PHASE 2: Running 6 specialists in parallel`);
  const config = getSpecialistConfig(toolData, company);
  const specialistKeys = ["financial", "moat", "sentiment", "risk", "macro", "management"];
  const specialistToReportKey = {
    financial: "financialAnalysis",
    moat: "competitivePosition",
    sentiment: "newsSentiment",
    risk: "riskAssessment",
    macro: "industryOutlook",
    management: "managementAnalysis"
  };

  // Fire all status events
  for (const key of specialistKeys) {
    if (onStep) onStep({ type: "status", step: "analyzing", message: config[key].status });
  }

  // Stagger Gemini calls slightly to avoid rate limits
  const isGemini = getProvider() === "gemini";
  const specialistResults = await Promise.allSettled(
    specialistKeys.map((key, i) =>
      (async () => {
        if (isGemini && i > 0) {
          await new Promise(r => setTimeout(r, i * 600)); // stagger 600ms each
        }
        const result = await runSpecialist(config[key].prompt, config[key].context, config[key].label);
        // Stream this specialist result immediately!
        const reportKey = specialistToReportKey[key];
        if (onStep && result) {
          onStep({ type: "specialist", key: reportKey, data: result });
        }
        return { key, result };
      })()
    )
  );

  const analyses = {};
  for (const settled of specialistResults) {
    if (settled.status === "fulfilled") {
      analyses[settled.value.key] = settled.value.result;
    } else {
      console.error(`[pipeline] Specialist failed:`, settled.reason?.message);
    }
  }

  console.log(`[pipeline] Phase 2 complete (${timer.elapsedStr()}) — ${Object.keys(analyses).length}/6 specialists succeeded\n`);

  const report = {
    ...coreVerdict,
    financialAnalysis: analyses.financial,
    competitivePosition: analyses.moat,
    newsSentiment: analyses.sentiment,
    riskAssessment: analyses.risk,
    industryOutlook: analyses.macro,
    managementAnalysis: analyses.management,
  };

  // Update total time in meta
  report._meta.totalTime = timer.elapsedStr();

  // Cache final report
  setCache("report:" + cacheKey, report);

  if (onStep) {
    onStep({ type: "done" });
  }

  console.log(`[pipeline] ✅ COMPLETE — ${timer.elapsedStr()}`);
  console.log(`[pipeline] Verdict: ${report.verdict} (${report.confidence}% confidence)`);
  console.log(`${"=".repeat(60)}\n`);

  return report;
}
