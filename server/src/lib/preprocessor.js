const MAX_CONTENT_LENGTH = 500;
const MAX_RESULTS = 6;

export function preprocessSearchResults(raw) {
  try {
    const data = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (data.error) return { error: data.error, data: null };

    const results = (data.results || [])
      .slice(0, MAX_RESULTS)
      .map((r) => ({
        title: r.title?.slice(0, 120),
        content: r.content?.slice(0, MAX_CONTENT_LENGTH),
      }));

    return {
      error: null,
      data: {
        answer: data.answer?.slice(0, 800) || "",
        results,
      },
    };
  } catch {
    return { error: "Failed to parse search results", data: null };
  }
}

export function preprocessFinancials(raw) {
  try {
    const data = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (data.error) return { error: data.error, data: null };

    return {
      error: null,
      data: {
        companyName: data.companyName,
        symbol: data.symbol,
        sector: data.sector,
        industry: data.industry,
        exchange: data.exchange,
        employees: data.employees,
        ceo: data.ceo,
        description: data.description?.slice(0, 400),
        stockData: data.stockData,
        valuationMetrics: data.valuationMetrics,
        profitabilityMetrics: data.profitabilityMetrics,
        leverageMetrics: data.leverageMetrics,
        dividendInfo: data.dividendInfo,
        revenueGrowthYoY: data.revenueGrowthYoY,
        incomeStatements: (data.incomeStatements || []).slice(0, 3),
        cashFlowStatements: (data.cashFlowStatements || []).slice(0, 2),
        balanceSheet: data.balanceSheet,
      },
    };
  } catch {
    return { error: "Failed to parse financial data", data: null };
  }
}

export function preprocessNews(raw) {
  try {
    const data = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (data.error) return { error: data.error, data: null };

    const articles = (data.articles || [])
      .slice(0, MAX_RESULTS)
      .map((a) => ({
        title: a.title?.slice(0, 120),
        snippet: a.snippet?.slice(0, 300),
        source: a.source,
        publishedDate: a.publishedDate,
      }));

    return {
      error: null,
      data: {
        summary: data.summary?.slice(0, 600) || "",
        articles,
      },
    };
  } catch {
    return { error: "Failed to parse news data", data: null };
  }
}

export function preprocessCompetitors(raw) {
  try {
    const data = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (data.error) return { error: data.error, data: null };

    const results = (data.results || [])
      .slice(0, 4)
      .map((r) => ({
        title: r.title?.slice(0, 120),
        content: r.content?.slice(0, 350),
      }));

    return {
      error: null,
      data: {
        analysis: data.analysis?.slice(0, 600) || "",
        results,
      },
    };
  } catch {
    return { error: "Failed to parse competitor data", data: null };
  }
}

export function preprocessIndustry(raw) {
  try {
    const data = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (data.error) return { error: data.error, data: null };

    const results = (data.results || [])
      .slice(0, 4)
      .map((r) => ({
        title: r.title?.slice(0, 120),
        content: r.content?.slice(0, 350),
      }));

    return {
      error: null,
      data: {
        outlook: data.outlook?.slice(0, 600) || "",
        results,
      },
    };
  } catch {
    return { error: "Failed to parse industry data", data: null };
  }
}

export function estimateTokens(text) {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

export function buildCompactContext(label, data) {
  if (!data || data.error) return `[${label}]: No data available - ${data?.error || "unknown error"}`;
  const json = JSON.stringify(data.data, null, 0);
  return `[${label}]:\n${json}`;
}
