import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { getCached, setCache } from "../cache.js";

const FMP_BASE = "https://financialmodelingprep.com/api/v3";

async function fmpFetch(endpoint, params = {}) {
  const apiKey = process.env.FMP_API_KEY;
  if (!apiKey) return null;

  const url = new URL(`${FMP_BASE}${endpoint}`);
  url.searchParams.set("apikey", apiKey);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  try {
    const res = await fetch(url.toString());
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function formatNumber(num) {
  if (num === null || num === undefined) return "N/A";
  const abs = Math.abs(num);
  if (abs >= 1e12) return `$${(num / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `$${(num / 1e3).toFixed(2)}K`;
  return `$${num.toFixed(2)}`;
}

function pct(val) {
  if (val === null || val === undefined) return "N/A";
  return (val * 100).toFixed(2) + "%";
}

export const financialsTool = tool(
  async ({ symbol }) => {
    const ticker = symbol.toUpperCase().trim();
    const cacheKey = `fmp_${ticker}`;
    const cached = getCached(cacheKey);
    if (cached) {
      return cached;
    }

    const [profile, ratios, income, balance, cashflow, quote, keyMetrics] = await Promise.all([
      fmpFetch(`/profile/${ticker}`),
      fmpFetch(`/ratios-ttm/${ticker}`),
      fmpFetch(`/income-statement/${ticker}`, { limit: "4" }),
      fmpFetch(`/balance-sheet-statement/${ticker}`, { limit: "2" }),
      fmpFetch(`/cash-flow-statement/${ticker}`, { limit: "2" }),
      fmpFetch(`/quote/${ticker}`),
      fmpFetch(`/key-metrics-ttm/${ticker}`),
    ]);

    if (!profile?.[0] && !quote?.[0]) {
      return JSON.stringify({
        error: `No financial data found for symbol "${ticker}". Try a different ticker or verify the symbol is correct. Common formats: AAPL (US), RELIANCE.NS (India NSE), TCS.NS (India NSE).`,
        suggestion: "Try searching the web for the correct stock ticker symbol first.",
      });
    }

    const p = profile?.[0] || {};
    const q = quote?.[0] || {};
    const r = ratios?.[0] || {};
    const km = keyMetrics?.[0] || {};
    const b = balance?.[0] || {};

    const incomeData = (income || []).slice(0, 4).map((i) => ({
      year: i.calendarYear || i.date?.slice(0, 4),
      revenue: formatNumber(i.revenue),
      revenueRaw: i.revenue,
      netIncome: formatNumber(i.netIncome),
      netIncomeRaw: i.netIncome,
      grossMargin: pct(i.grossProfitRatio),
      operatingMargin: pct(i.operatingIncomeRatio),
      netMargin: pct(i.netIncomeRatio),
      eps: i.eps?.toFixed(2) || "N/A",
      ebitda: formatNumber(i.ebitda),
    }));

    const revenueGrowthCalc = (() => {
      if (incomeData.length >= 2 && incomeData[0].revenueRaw && incomeData[1].revenueRaw) {
        const growth = ((incomeData[0].revenueRaw - incomeData[1].revenueRaw) / Math.abs(incomeData[1].revenueRaw)) * 100;
        return growth.toFixed(2) + "%";
      }
      return r.revenueGrowthTTM ? pct(r.revenueGrowthTTM) : "N/A";
    })();

    const cashflowData = (cashflow || []).slice(0, 2).map((c) => ({
      year: c.calendarYear || c.date?.slice(0, 4),
      operatingCashFlow: formatNumber(c.operatingCashFlow),
      freeCashFlow: formatNumber(c.freeCashFlow),
      capitalExpenditure: formatNumber(c.capitalExpenditure),
    }));

    const balanceData = {
      totalAssets: formatNumber(b.totalAssets),
      totalDebt: formatNumber(b.totalDebt),
      totalCash: formatNumber(b.cashAndCashEquivalents),
      totalEquity: formatNumber(b.totalStockholdersEquity),
      netDebt: formatNumber(b.netDebt),
    };

    const result = JSON.stringify({
      companyName: p.companyName || ticker,
      symbol: ticker,
      sector: p.sector || "N/A",
      industry: p.industry || "N/A",
      exchange: p.exchangeShortName || "N/A",
      country: p.country || "N/A",
      employees: p.fullTimeEmployees || "N/A",
      ceo: p.ceo || "N/A",
      website: p.website || "N/A",
      ipoDate: p.ipoDate || "N/A",
      description: p.description?.slice(0, 600) || "",

      stockData: {
        price: q.price || p.price || "N/A",
        change: q.change?.toFixed(2) || "N/A",
        changePercent: q.changesPercentage ? q.changesPercentage.toFixed(2) + "%" : "N/A",
        dayHigh: q.dayHigh || "N/A",
        dayLow: q.dayLow || "N/A",
        yearHigh: q.yearHigh || "N/A",
        yearLow: q.yearLow || "N/A",
        volume: q.volume || "N/A",
        avgVolume: q.avgVolume || "N/A",
        marketCap: formatNumber(q.marketCap || p.mktCap),
      },

      valuationMetrics: {
        peRatio: r.peRatioTTM?.toFixed(2) || q.pe?.toFixed(2) || "N/A",
        pegRatio: r.pegRatioTTM?.toFixed(2) || "N/A",
        priceToSales: r.priceToSalesRatioTTM?.toFixed(2) || "N/A",
        priceToBook: r.priceToBookRatioTTM?.toFixed(2) || "N/A",
        evToEbitda: km.enterpriseValueOverEBITDATTM?.toFixed(2) || "N/A",
        evToRevenue: r.enterpriseValueMultipleTTM?.toFixed(2) || "N/A",
      },

      profitabilityMetrics: {
        grossMargin: pct(r.grossProfitMarginTTM),
        operatingMargin: pct(r.operatingProfitMarginTTM),
        netMargin: pct(r.netProfitMarginTTM),
        roe: pct(r.returnOnEquityTTM),
        roa: pct(r.returnOnAssetsTTM),
        roic: km.roicTTM ? pct(km.roicTTM) : "N/A",
      },

      leverageMetrics: {
        debtToEquity: r.debtEquityRatioTTM?.toFixed(2) || "N/A",
        currentRatio: r.currentRatioTTM?.toFixed(2) || "N/A",
        quickRatio: r.quickRatioTTM?.toFixed(2) || "N/A",
        interestCoverage: r.interestCoverageTTM?.toFixed(2) || "N/A",
      },

      dividendInfo: {
        dividendYield: r.dividendYieldPercentageTTM ? r.dividendYieldPercentageTTM.toFixed(2) + "%" : "N/A",
        payoutRatio: r.payoutRatioTTM ? pct(r.payoutRatioTTM) : "N/A",
      },

      revenueGrowthYoY: revenueGrowthCalc,
      incomeStatements: incomeData,
      cashFlowStatements: cashflowData,
      balanceSheet: balanceData,
    });

    setCache(cacheKey, result, 60 * 60 * 1000); // 1 hour TTL
    return result;
  },
  {
    name: "get_financial_data",
    description:
      "Get comprehensive financial data for a publicly traded company. Provide the stock ticker symbol (e.g., AAPL for Apple, TSLA for Tesla, GOOGL for Google, RELIANCE.NS for Reliance Industries). Returns: company profile, stock price data, valuation ratios (P/E, P/S, EV/EBITDA), profitability metrics (ROE, margins), leverage ratios, income statements (4 years), cash flow statements, and balance sheet data.",
    schema: z.object({
      symbol: z.string().describe("Stock ticker symbol (e.g., AAPL, TSLA, GOOGL, MSFT, RELIANCE.NS, TCS.NS)"),
    }),
  }
);
