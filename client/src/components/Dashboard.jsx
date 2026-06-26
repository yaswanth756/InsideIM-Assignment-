"use client";

import { useState } from "react";
import {
  TrendingUp, TrendingDown, AlertTriangle, ShieldCheck,
  Users, Globe, FileText, Download, Share2, Clipboard,
  Check, Printer, Bookmark, ChevronDown, ChevronUp, ExternalLink
} from "lucide-react";
import MetricChart from "./MetricChart";

/* ── SVG Score Ring ── */
function ScoreRing({ score, size = 80, strokeWidth = 6, color }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  return (
    <svg width={size} height={size} className="score-ring">
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#f0f0f0" strokeWidth={strokeWidth} />
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={strokeWidth}
        strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 1s ease-out' }} />
    </svg>
  );
}

/* ── Expandable Text with Read More ── */
function ExpandableText({ text, maxLength = 350 }) {
  const [expanded, setExpanded] = useState(false);
  if (!text) return null;
  const isLong = text.length > maxLength;

  return (
    <div>
      <p className="text-[15px] leading-[1.8]" style={{ color: 'var(--text-secondary)' }}>
        {isLong && !expanded ? text.slice(0, maxLength) + '...' : text}
      </p>
      {isLong && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-2 flex items-center gap-1 text-sm font-semibold transition-colors hover:underline"
          style={{ color: 'var(--accent-1)' }}
        >
          {expanded ? <><ChevronUp size={16} /> Show less</> : <><ChevronDown size={16} /> Read more</>}
        </button>
      )}
    </div>
  );
}

/* ── Shimmer Tab Loader ── */
function ShimmerTab({ label }) {
  return (
    <div className="flex flex-col gap-5 animate-pulse py-4">
      <div className="flex items-center gap-3">
        <span className="w-2.5 h-2.5 rounded-full bg-[var(--accent-1)] animate-ping" />
        <span className="text-xs uppercase font-bold tracking-wider" style={{ color: 'var(--text-muted)' }}>
          Generating {label} Analysis...
        </span>
      </div>
      <div className="space-y-3 mt-2">
        <div className="h-6 bg-gray-200/60 rounded-md w-3/4 animate-shimmer" />
        <div className="h-4 bg-gray-105/50 rounded-md w-full animate-shimmer" />
        <div className="h-4 bg-gray-105/50 rounded-md w-5/6 animate-shimmer" />
        <div className="h-20 bg-gray-105/40 rounded-xl w-full animate-shimmer" />
      </div>
    </div>
  );
}

export default function Dashboard({ report, onSavePortfolio, isSaved }) {
  const [activeTab, setActiveTab] = useState("financial");
  const [copiedSection, setCopiedSection] = useState(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [deepDetailLoading, setDeepDetailLoading] = useState({
    financial: false,
    risk: false,
    moat: false,
    sentiment: false,
  });
  const [deepDetailData, setDeepDetailData] = useState({
    financial: null,
    risk: null,
    moat: null,
    sentiment: null,
  });
  const [expandedDeep, setExpandedDeep] = useState({
    financial: false,
    risk: false,
    moat: false,
    sentiment: false,
  });

  const handleToggleDeep = async (type) => {
    if (expandedDeep[type]) {
      setExpandedDeep(prev => ({ ...prev, [type]: false }));
      return;
    }

    setExpandedDeep(prev => ({ ...prev, [type]: true }));

    if (deepDetailData[type]) return;

    setDeepDetailLoading(prev => ({ ...prev, [type]: true }));
    try {
      const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const response = await fetch(`${API_BASE}/api/research/deep-detail`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company: report.ticker || report.companyName, type })
      });
      if (!response.ok) throw new Error("Failed to load deep detail");
      const resJson = await response.json();
      if (resJson.status === "success") {
        setDeepDetailData(prev => ({ ...prev, [type]: resJson.data }));
      }
    } catch (e) {
      console.error("Deep detail fetch error:", e);
    } finally {
      setDeepDetailLoading(prev => ({ ...prev, [type]: false }));
    }
  };

  if (!report) return null;

  const readiness = {
    core: !!report.verdict || !!report.preliminarySignal,
    financial: !!report.financialAnalysis,
    moat: !!report.competitivePosition,
    risk: !!report.riskAssessment,
    sentiment: !!report.newsSentiment,
    macro: !!report.industryOutlook,
    management: !!report.managementAnalysis,
  };

  // ── Runtime normalizer: managementAnalysis may be a string from older reports ──
  const mgmt = (() => {
    const raw = report.managementAnalysis;
    if (!raw) return { summary: "", ceo: {}, capitalAllocation: "N/A", insiderSignal: "Neutral", strategicClarity: "N/A", governanceConcerns: [] };
    if (typeof raw === "string") return { summary: raw, ceo: {}, capitalAllocation: "N/A", insiderSignal: "Neutral", strategicClarity: "N/A", governanceConcerns: [] };
    return raw;
  })();

  const isPreliminary = report.isPreliminary === true;
  const isFinal = report.isFinal === true;

  const companyName = report.companyName || "Unknown Company";
  const ticker = report.ticker || "N/A";
  const sector = report.sector || "N/A";
  const exchange = report.exchange || "N/A";
  const overview = report.companyOverview || "";

  // Preliminary fields (Phase 1.5)
  const preliminarySignal = report.preliminarySignal || "Neutral"; // Bullish|Bearish|Neutral
  const preliminaryConfidence = report.preliminaryConfidence || "Medium"; // Low|Medium|High
  const confidenceRange = report.confidenceRange || "50-60";
  const preliminaryReasons = report.preliminaryReasons || [];
  const preliminaryThesis = report.preliminaryThesis || "";
  const valuationLean = report.valuationLean || "";

  // Final fields (Phase 3 — only available after supervisor synthesis)
  const verdict = isFinal ? (report.verdict || "PASS").toUpperCase() : "";
  const confidence = isFinal ? (report.confidence || 50) : 0;
  const reasoning = report.reasoning || preliminaryThesis || "";
  const bullCase = report.bullCase || "";
  const bearCase = report.bearCase || "";
  const catalysts = report.catalysts || [];
  const timeHorizon = report.timeHorizon || "Medium-term (1-3yr)";
  const disclaimer = report.disclaimer || "";
  const meta = report._meta || {};

  const financials = report.financialAnalysis || {};
  const sentiment = report.newsSentiment || {};
  const moat = report.competitivePosition || {};
  const macro = report.industryOutlook || {};
  const risks = report.riskAssessment || {};

  const handleCopy = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(id);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  const handleExportJSON = () => {
    const a = document.createElement("a");
    a.href = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(report, null, 2));
    a.download = `${ticker}_report.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopiedSection("share");
    setTimeout(() => setCopiedSection(null), 2000);
  };

  const parseValuation = (text) => {
    if (!text || text === "Generating...") {
      return { text: "Generating...", percent: 0, color: "var(--text-muted)" };
    }
    const l = text.toLowerCase();
    if (l.includes("undervalued")) return { text: "Undervalued", percent: 25, color: "var(--green)" };
    if (l.includes("overvalued")) return { text: "Overvalued", percent: 75, color: "var(--red)" };
    if (l.includes("fair")) return { text: "Fairly Valued", percent: 50, color: "var(--amber)" };
    return { text: text, percent: 50, color: "var(--amber)" };
  };
  const valAssess = parseValuation(report.financialAnalysis?.valuationAssessment || report.valuationAssessment || "Generating...");

  const chartRevenueData = (financials.revenueHistory || []).map((item) => {
    let revNum = 0;
    if (item.revenue) {
      const c = item.revenue.replace(/[\$,]/g, "").toUpperCase();
      revNum = c.endsWith("B") ? parseFloat(c) * 1000 : c.endsWith("M") ? parseFloat(c) : c.endsWith("T") ? parseFloat(c) * 1e6 : parseFloat(c) || 0;
    }
    return { year: item.year, revenue: revNum, margin: item.growth ? parseFloat(item.growth.replace(/[^\d.-]/g, "")) || 0 : 0 };
  }).reverse();

  const moatChartData = (moat.moatSources || []).map((m) => ({ source: m.source, score: m.score || 0 }));

  const getRiskStyle = (sev, prob) => {
    const s = (sev || 0) * (prob || 0);
    if (s >= 12) return { bg: 'var(--red-soft)', color: 'var(--red)', border: 'rgba(217, 48, 37, 0.15)' };
    if (s >= 6) return { bg: 'var(--amber-soft)', color: 'var(--amber)', border: 'rgba(249, 171, 0, 0.15)' };
    return { bg: 'var(--green-soft)', color: 'var(--green)', border: 'rgba(30, 142, 62, 0.15)' };
  };

  const executeSave = () => {
    onSavePortfolio();
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  };

  const isInvest = verdict === "INVEST";
  const verdictColor = isPreliminary
    ? (preliminarySignal === "Bullish" ? "var(--accent-1)" : preliminarySignal === "Bearish" ? "var(--red)" : "var(--amber)")
    : (isInvest ? "var(--green)" : "var(--red)");

  const sectionLabel = { fontSize: '11px', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text-muted)' };

  const actionBtnClass = (active = false) => {
    return `flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold cursor-pointer transition-all border ${
      active 
        ? "bg-[rgba(30,142,62,0.08)] border-[rgba(30,142,62,0.25)] text-[var(--green)] shadow-sm"
        : "bg-white border-[var(--glass-border)] text-[var(--text-secondary)] hover:bg-[rgba(26,115,232,0.04)] hover:border-[rgba(26,115,232,0.2)] hover:text-[var(--accent-1)] hover:-translate-y-0.5 hover:shadow-sm"
    }`;
  };

  const tabs = [
    { id: "financial", label: "Financials", icon: FileText },
    { id: "moat", label: "Moat Analysis", icon: ShieldCheck },
    { id: "sentiment", label: "Sentiment Scan", icon: Users },
    { id: "risk", label: "Risk Matrix", icon: AlertTriangle },
    { id: "macro", label: "Macro & Vision", icon: Globe },
  ];

  const getTabCardClass = () => {
    switch (activeTab) {
      case "financial": return "card-google-blue";
      case "moat": return "card-google-teal";
      case "sentiment": return "card-google-purple";
      case "risk": return "card-google-red";
      case "macro": return "card-google-neutral";
      default: return "card-google-neutral";
    }
  };

  return (
    <div className="w-full flex-1 flex flex-col gap-6 max-w-6xl mx-auto pb-24 print:pb-0">

      {/* ── 1. TICKER HERO (Google Blue) ── */}
      <div className="card-google-blue p-7 flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-slide-up" style={{ borderLeft: '1px solid rgba(66, 133, 244, 0.15)' }}>
        <div className="flex items-center gap-4.5">
          <div className="flex items-center justify-center font-mono font-bold text-2xl text-white shadow-md animate-fade-in-scale" style={{ width: 60, height: 60, borderRadius: 16, background: 'var(--gradient-accent)' }}>
            {ticker.slice(0, 4)}
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-extrabold tracking-tight" style={{ color: 'var(--text-primary)' }}>{companyName}</h1>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5" style={{ color: 'var(--accent-1)', border: '1px solid rgba(26,115,232,0.25)', borderRadius: 'var(--radius-full)', background: 'rgba(26,115,232,0.06)' }}>{exchange}</span>
            </div>
            <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>{sector} · <strong className="font-semibold">{timeHorizon}</strong> Horizon</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 no-print">
          <button onClick={executeSave} className={actionBtnClass(isSaved || saveSuccess)}>
            {isSaved || saveSuccess ? <Check size={14} /> : <Bookmark size={14} />} {isSaved || saveSuccess ? "Saved to Portfolio" : "Save Analysis"}
          </button>
          <button onClick={() => window.print()} className={actionBtnClass()}><Printer size={14} /> Print Report</button>
          <button onClick={handleExportJSON} className={actionBtnClass()}><Download size={14} /> Export JSON</button>
          <button onClick={handleShare} className={actionBtnClass()}>
            {copiedSection === "share" ? <Check size={14} style={{ color: 'var(--green)' }} /> : <Share2 size={14} />}
            {copiedSection === "share" ? "Copied!" : "Share Link"}
          </button>
        </div>
      </div>

      {/* ── 2. VERDICT + THESIS (Dynamic Card — Preliminary → Final) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── VERDICT CARD ── */}
        {isPreliminary ? (
          /* ── PRELIMINARY VIEW ── */
          <div className="lg:col-span-1 flex flex-col justify-between animate-slide-up p-7" style={{
            background: 'linear-gradient(135deg, rgba(255,255,255,0.95), rgba(245,245,250,0.9))',
            border: `2px dashed ${verdictColor}`,
            borderRadius: 'var(--radius-xl)',
            position: 'relative',
            overflow: 'hidden'
          }}>
            {/* Animated scanning overlay */}
            <div style={{
              position: 'absolute', top: 0, left: 0, right: 0, height: '3px',
              background: `linear-gradient(90deg, transparent, ${verdictColor}, transparent)`,
              animation: 'shimmer 2s ease-in-out infinite'
            }} />
            <div>
              <div className="flex items-center gap-2">
                <span style={{...sectionLabel, color: verdictColor}}>Preliminary View</span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider" style={{
                  background: `${verdictColor}15`,
                  color: verdictColor,
                  border: `1px solid ${verdictColor}30`
                }}>
                  <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: verdictColor }} />
                  Live
                </span>
              </div>
              <div className="mt-5 flex items-center gap-4">
                <div className="flex items-center justify-center w-16 h-16 rounded-2xl shadow-sm" style={{
                  background: `${verdictColor}12`,
                  border: `1px solid ${verdictColor}25`
                }}>
                  <span className="text-3xl">{preliminarySignal === "Bullish" ? "📈" : preliminarySignal === "Bearish" ? "📉" : "⚖️"}</span>
                </div>
                <div>
                  <span className="text-3xl font-black tracking-tight block" style={{ color: verdictColor }}>
                    {preliminarySignal === "Bullish" ? "Lean: Positive" : preliminarySignal === "Bearish" ? "Lean: Negative" : "Lean: Mixed"}
                  </span>
                  <span className="text-[10px] uppercase tracking-wider font-bold block mt-1" style={{ color: 'var(--text-muted)' }}>
                    {preliminaryConfidence} confidence · Range {confidenceRange}%
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 flex flex-col gap-3" style={{ borderTop: `1px solid ${verdictColor}20` }}>
              {/* Valuation Lean */}
              {valuationLean && (
                <div className="flex justify-between text-[11px] uppercase tracking-wider font-bold" style={{ color: 'var(--text-secondary)' }}>
                  <span>Valuation Lean</span>
                  <span style={{ color: verdictColor, fontWeight: 800 }}>{valuationLean.replace("Potentially ", "~")}</span>
                </div>
              )}

              {/* Preliminary Reasons */}
              <div className="flex flex-col gap-1.5">
                {preliminaryReasons.map((r, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
                    <span className="mt-0.5 w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: verdictColor }} />
                    <span>{r}</span>
                  </div>
                ))}
              </div>

              {/* "Specialists reviewing" indicator */}
              <div className="flex items-center gap-2 mt-2 p-2.5 rounded-lg" style={{
                background: 'rgba(0,0,0,0.03)',
                border: '1px solid rgba(0,0,0,0.05)'
              }}>
                <div className="flex gap-0.5">
                  {[0,1,2].map(i => (
                    <div key={i} className="w-1.5 h-1.5 rounded-full animate-pulse" style={{
                      background: verdictColor,
                      animationDelay: `${i * 200}ms`
                    }} />
                  ))}
                </div>
                <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                  6 specialists reviewing · Final verdict pending
                </span>
              </div>
            </div>
          </div>
        ) : (
          /* ── FINAL CIO VERDICT ── */
          <div className={`lg:col-span-1 flex flex-col justify-between animate-slide-up p-7 ${isInvest ? 'card-google-green' : 'card-google-red'}`}
            style={{
              transition: 'all 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
              borderLeft: isInvest ? '1px solid rgba(52, 168, 83, 0.15)' : '1px solid rgba(234, 67, 53, 0.15)'
            }}
          >
            <div>
              <div className="flex items-center gap-2">
                <span style={sectionLabel}>Final CIO Verdict</span>
                {isFinal && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider" style={{
                    background: 'rgba(30,142,62,0.08)',
                    color: 'var(--green)',
                    border: '1px solid rgba(30,142,62,0.2)'
                  }}>
                    <Check size={10} /> Reconciled
                  </span>
                )}
              </div>
              <div className="mt-6 flex items-center gap-5">
                <div className="relative flex items-center justify-center bg-white p-1 rounded-full shadow-sm">
                  <ScoreRing score={confidence} size={92} strokeWidth={7} color={verdictColor} />
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-xl font-black" style={{ color: verdictColor }}>{confidence}%</span>
                  </div>
                </div>
                <div>
                  <span className="text-5xl font-black tracking-tighter block" style={{ color: verdictColor }}>{verdict}</span>
                  <span className="text-[10px] uppercase tracking-wider font-bold block mt-1" style={{ color: 'var(--text-muted)' }}>confidence rating</span>
                </div>
              </div>
            </div>
            <div className="mt-8 pt-5 flex flex-col gap-4" style={{ borderTop: '1px solid var(--glass-border)' }}>
              <div>
                <div className="flex justify-between text-[11px] uppercase tracking-wider mb-2 font-bold" style={{ color: 'var(--text-secondary)' }}>
                  <span>Valuation Zone</span><span style={{ color: valAssess.color, fontWeight: 800 }}>{valAssess.text}</span>
                </div>
                <div className="w-full h-2.5 overflow-hidden shadow-inner bg-gray-200" style={{ borderRadius: 'var(--radius-full)' }}>
                  <div className="h-full rounded-full transition-all duration-700" style={{ width: `${valAssess.percent}%`, background: valAssess.color }} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                {[
                  { label: "Financials", value: readiness.financial ? (financials.healthScore || "—") : "Gen...", color: "var(--accent-1)" },
                  { label: "Moat", value: readiness.moat ? (moat.moatScore || "—") : "Gen...", color: "var(--teal)" },
                  { label: "Risks", value: readiness.risk ? (risks.riskScore || "—") : "Gen...", color: "var(--red)" },
                ].map((s, i) => (
                  <div key={i} className="p-2 bg-white/70 hover:bg-white transition-all shadow-sm border border-black/5" style={{ borderRadius: 'var(--radius-md)' }}>
                    <span style={{ color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase', fontSize: '9px', fontWeight: 700 }}>{s.label}</span>
                    <span style={{ color: s.value === "Gen..." ? 'var(--text-muted)' : 'var(--text-primary)', fontWeight: 800, fontSize: s.value === "Gen..." ? '11px' : '14px', display: 'block', marginTop: '2px' }}>{s.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Investment Thesis (Google Blue Card) */}
        <div className="lg:col-span-2 flex flex-col animate-slide-up card-google-blue p-7" style={{ borderLeft: '1px solid rgba(66, 133, 244, 0.15)' }}>
          <div className="flex justify-between items-center pb-3 mb-4" style={{ borderBottom: '1px solid var(--glass-border)' }}>
            <h3 style={sectionLabel}>{isPreliminary ? "Preliminary Thesis" : "Core Analyst Thesis"}</h3>
            <button onClick={() => handleCopy(overview + "\n\n" + reasoning, "thesis")} className="text-gray-400 hover:text-[var(--accent-1)] transition-colors p-1" title="Copy Thesis">
              {copiedSection === "thesis" ? <Check size={15} style={{ color: 'var(--green)' }} /> : <Clipboard size={15} />}
            </button>
          </div>
          <div className="flex-1 flex flex-col gap-4">
            <div className="bg-white/50 p-4 rounded-xl border border-black/5 shadow-sm">
              <span className="text-[10px] font-bold uppercase tracking-wide block mb-1 text-[var(--accent-1)]">Company Profile & Focus</span>
              <ExpandableText text={overview} maxLength={380} />
            </div>
            <div className="bg-white/30 p-4 rounded-xl border border-black/5 shadow-sm">
              <span className="text-[10px] font-bold uppercase tracking-wide block mb-1 text-[var(--accent-2)]">
                {isPreliminary ? "Preliminary Assessment" : "Primary Investment Thesis"}
              </span>
              <ExpandableText text={reasoning} maxLength={450} />
            </div>
          </div>
        </div>
      </div>

      {/* ── 3. BULL vs BEAR (Green & Red Cards) ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Bull Case */}
        <div className="animate-slide-up card-google-green p-7" style={{ borderLeft: '1px solid rgba(52, 168, 83, 0.15)' }}>
          <div className="flex items-center gap-2.5 pb-3.5 mb-4" style={{ borderBottom: '1px solid var(--glass-border)' }}>
            <div style={{ width: 32, height: 32, borderRadius: 10, background: 'var(--green-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <TrendingUp size={16} style={{ color: 'var(--green)' }} />
            </div>
            <h3 className="text-sm uppercase font-bold tracking-wider" style={{ color: 'var(--green)' }}>Optimistic / Bull Case</h3>
          </div>
          <ExpandableText text={bullCase} maxLength={420} />
        </div>

        {/* Bear Case */}
        <div className="animate-slide-up card-google-red p-7" style={{ borderLeft: '1px solid rgba(234, 67, 53, 0.15)' }}>
          <div className="flex items-center gap-2.5 pb-3.5 mb-4" style={{ borderBottom: '1px solid var(--glass-border)' }}>
            <div style={{ width: 32, height: 32, borderRadius: 10, background: 'var(--red-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <TrendingDown size={16} style={{ color: 'var(--red)' }} />
            </div>
            <h3 className="text-sm uppercase font-bold tracking-wider" style={{ color: 'var(--red)' }}>Conservative / Bear Case</h3>
          </div>
          <ExpandableText text={bearCase} maxLength={420} />
        </div>
      </div>

      {/* ── CATALYSTS (Google Amber Card) ── */}
      {catalysts.length > 0 && (
        <div className="animate-slide-up card-google-amber p-7" style={{ borderLeft: '1px solid rgba(249, 171, 0, 0.15)' }}>
          <h3 className="mb-4 pb-2.5 font-bold" style={{ ...sectionLabel, borderBottom: '1px solid var(--glass-border)' }}>Future Catalysts Timeline</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm" style={{ color: 'var(--text-secondary)' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--glass-border)' }}>
                  <th className="py-3 text-xs uppercase font-bold text-[var(--text-muted)]">Catalyst Description</th>
                  <th className="py-3 px-4 text-xs uppercase font-bold text-[var(--text-muted)]">Estimated Timeline</th>
                  <th className="py-3 text-right text-xs uppercase font-bold text-[var(--text-muted)]">Projected Impact</th>
                </tr>
              </thead>
              <tbody>
                {catalysts.map((c, idx) => (
                  <tr key={idx} className="hover:bg-amber-50/40 transition-colors border-b border-black/5">
                    <td className="py-3.5 pr-4 text-[14px] font-medium text-[var(--text-primary)]">{c.catalyst}</td>
                    <td className="py-3.5 px-4 font-mono text-xs font-bold text-[var(--text-secondary)]">{c.timeline}</td>
                    <td className="py-3.5 text-right">
                      <span className="px-3 py-1 text-xs font-extrabold uppercase inline-block border" style={{
                        borderRadius: 'var(--radius-full)',
                        background: c.impact?.toLowerCase() === "high" ? 'var(--green-soft)' : c.impact?.toLowerCase() === "medium" ? 'rgba(26,115,232,0.06)' : 'var(--bg-secondary)',
                        color: c.impact?.toLowerCase() === "high" ? 'var(--green)' : c.impact?.toLowerCase() === "medium" ? 'var(--accent-1)' : 'var(--text-muted)',
                        borderColor: c.impact?.toLowerCase() === "high" ? 'rgba(30,142,62,0.15)' : c.impact?.toLowerCase() === "medium" ? 'rgba(26,115,232,0.15)' : 'var(--glass-border)',
                      }}>{c.impact}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── 4. TABS CONTAINER (Dynamic card styling based on active tab) ── */}
      <div className={`animate-slide-up overflow-hidden ${getTabCardClass()}`} style={{
        transition: 'all 0.35s ease',
        borderLeft: activeTab === 'financial' ? '1px solid rgba(66, 133, 244, 0.15)' :
                    activeTab === 'moat' ? '1px solid rgba(0, 131, 143, 0.15)' :
                    activeTab === 'sentiment' ? '1px solid rgba(142, 36, 170, 0.15)' :
                    activeTab === 'risk' ? '1px solid rgba(234, 67, 53, 0.15)' :
                    '1px solid rgba(0, 0, 0, 0.08)'
      }}>
        <div className="flex items-center gap-1.5 p-4 pb-0 overflow-x-auto no-print border-b border-black/5 bg-black/[0.01]">
          {tabs.map((t) => {
            const Icon = t.icon;
            const active = activeTab === t.id;
            
            // Dynamic theme buttons matching Google color accents
            let btnTheme = {
              bg: 'transparent',
              border: '1px solid transparent',
              color: 'var(--text-secondary)',
              hoverBg: 'rgba(95,99,104,0.06)'
            };
            if (active) {
              if (t.id === "financial") { btnTheme = { bg: 'rgba(26,115,232,0.08)', border: '1px solid rgba(26,115,232,0.25)', color: 'var(--accent-1)', hoverBg: '' }; }
              else if (t.id === "moat") { btnTheme = { bg: 'rgba(0,131,143,0.08)', border: '1px solid rgba(0,131,143,0.25)', color: 'var(--teal)', hoverBg: '' }; }
              else if (t.id === "sentiment") { btnTheme = { bg: 'rgba(142,36,170,0.08)', border: '1px solid rgba(142,36,170,0.25)', color: 'var(--purple)', hoverBg: '' }; }
              else if (t.id === "risk") { btnTheme = { bg: 'rgba(217,48,37,0.08)', border: '1px solid rgba(217,48,37,0.25)', color: 'var(--red)', hoverBg: '' }; }
              else if (t.id === "macro") { btnTheme = { bg: 'rgba(95,99,104,0.08)', border: '1px solid rgba(95,99,104,0.25)', color: 'var(--text-primary)', hoverBg: '' }; }
            }

            return (
              <button 
                key={t.id} 
                onClick={() => setActiveTab(t.id)} 
                className="flex items-center gap-2 px-5 py-3 text-xs uppercase tracking-wider font-bold whitespace-nowrap transition-all duration-200 hover:-translate-y-0.5 cursor-pointer" 
                style={{
                  borderRadius: 'var(--radius-full) var(--radius-full) 0px 0px',
                  background: btnTheme.bg,
                  borderTop: btnTheme.border,
                  borderLeft: btnTheme.border,
                  borderRight: btnTheme.border,
                  borderBottom: 'none',
                  color: btnTheme.color,
                }}
              >
                <Icon size={14} /> {t.label}
              </button>
            );
          })}
        </div>

        <div className="p-7 bg-white/70">
          {/* FINANCIALS TAB */}
          {activeTab === "financial" && (
            !report.financialAnalysis ? (
              <ShimmerTab label="Financial" />
            ) : (
              <div className="flex flex-col gap-6 animate-fade-in">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 style={sectionLabel} className="mb-3">Revenue & Growth Charts</h4>
                    <MetricChart type="revenue" data={chartRevenueData} />
                  </div>
                  <div>
                    <h4 style={sectionLabel} className="mb-3">Valuation & Financial Metrics</h4>
                    <div className="grid grid-cols-2 gap-2.5">
                      {(financials.keyMetrics || []).slice(0, 8).map((m, i) => {
                        const isPos = m.sentiment === "positive";
                        const isNeg = m.sentiment === "negative";
                        const bg = isPos ? 'var(--green-soft)' : isNeg ? 'var(--red-soft)' : 'var(--bg-secondary)';
                        const border = isPos ? '1px solid rgba(30,142,62,0.12)' : isNeg ? '1px solid rgba(217,48,37,0.12)' : '1px solid var(--glass-border)';
                        return (
                          <div key={i} className="p-3.5 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5" style={{ background: bg, border: border, borderRadius: 'var(--radius-md)' }}>
                            <span className="text-[11px] block truncate font-semibold" style={{ color: 'var(--text-secondary)' }}>{m.label}</span>
                            <span className="font-extrabold text-base block mt-1" style={{ color: 'var(--text-primary)' }}>{m.value}</span>
                            <span className="text-xs font-semibold block mt-0.5" style={{ color: isPos ? 'var(--green)' : isNeg ? 'var(--red)' : 'var(--text-muted)' }}>{m.context || m.sentiment}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
                <div className="pt-5" style={{ borderTop: '1px solid var(--glass-border)' }}>
                  <h4 style={sectionLabel} className="mb-2">Financial Analyst Summary</h4>
                  <ExpandableText text={financials.summary} maxLength={420} />
                </div>

                {/* Deep Financial Analysis Accordion */}
                <div className="mt-6 pt-5 border-t border-black/5">
                  <button
                    onClick={() => handleToggleDeep("financial")}
                    className="w-full flex items-center justify-between p-4 bg-blue-50/50 hover:bg-blue-50 border border-blue-100 rounded-xl text-left transition-all group cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5">
                      <TrendingUp size={16} style={{ color: 'var(--accent-1)' }} />
                      <span className="text-sm font-bold text-[var(--accent-1)]">
                        {expandedDeep.financial ? "Hide Deep Financial Analysis" : "⚡ Load Deep Financial Analysis (DuPont, Margins, Liquidity)"}
                      </span>
                    </div>
                    <ChevronDown
                      size={16}
                      style={{ color: 'var(--accent-1)', transform: expandedDeep.financial ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}
                    />
                  </button>

                  {expandedDeep.financial && (
                    <div className="mt-4 p-5 bg-gray-50/80 border border-black/5 rounded-xl animate-slide-up">
                      {deepDetailLoading.financial && (
                        <div className="flex flex-col items-center py-8">
                          <div className="w-8 h-8 rounded-full border-2 border-blue-500 border-t-transparent animate-spin mb-2" />
                          <span className="text-xs font-semibold text-gray-500">Conducting Dupont & Solvency Deep Dive...</span>
                        </div>
                      )}
                      {!deepDetailLoading.financial && !deepDetailData.financial && (
                        <span className="text-xs text-red-500">Failed to load deep financials. Please try again.</span>
                      )}
                      {!deepDetailLoading.financial && deepDetailData.financial && (
                        <div className="space-y-6">
                          {/* DuPont Section */}
                          <div>
                            <h5 className="text-xs font-extrabold uppercase tracking-wide text-gray-400 mb-3">DuPont Formula Analysis (ROE Breakdown)</h5>
                            <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 text-center">
                              {[
                                { label: "Tax Burden", value: deepDetailData.financial.dupont?.taxBurden },
                                { label: "Interest Burden", value: deepDetailData.financial.dupont?.interestBurden },
                                { label: "Operating Margin", value: deepDetailData.financial.dupont?.operatingMargin },
                                { label: "Asset Turnover", value: deepDetailData.financial.dupont?.assetTurnover },
                                { label: "Leverage Ratio", value: deepDetailData.financial.dupont?.leverageRatio },
                                { label: "Resulting ROE", value: deepDetailData.financial.dupont?.roe, highlight: true }
                              ].map((item, i) => (
                                <div key={i} className={`p-2.5 border rounded-lg ${item.highlight ? 'bg-blue-50 border-blue-200' : 'bg-white border-black/5'}`}>
                                  <span className="text-[9px] uppercase font-bold text-gray-400 block">{item.label}</span>
                                  <span className={`text-sm font-black block mt-1 ${item.highlight ? 'text-blue-600' : 'text-gray-700'}`}>{item.value || "—"}</span>
                                </div>
                              ))}
                            </div>
                            <p className="text-xs leading-relaxed text-gray-500 mt-2.5">{deepDetailData.financial.dupont?.analysis}</p>
                          </div>

                          {/* Margins */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-black/5">
                            <div>
                              <h5 className="text-xs font-extrabold uppercase tracking-wide text-gray-400 mb-2.5">Granular Margin Profile</h5>
                              <div className="space-y-1.5">
                                {[
                                  { label: "Gross Margin", value: deepDetailData.financial.margins?.gross },
                                  { label: "EBITDA Margin", value: deepDetailData.financial.margins?.ebitda },
                                  { label: "Operating Margin", value: deepDetailData.financial.margins?.operating },
                                  { label: "Net Profit Margin", value: deepDetailData.financial.margins?.net }
                                ].map((m, i) => (
                                  <div key={i} className="flex justify-between text-xs py-1 border-b border-black/5">
                                    <span className="font-medium text-gray-500">{m.label}</span>
                                    <span className="font-extrabold text-gray-700">{m.value || "—"}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                            <div>
                              <h5 className="text-xs font-extrabold uppercase tracking-wide text-gray-400 mb-2">Margin Trend Assessment</h5>
                              <p className="text-xs leading-relaxed text-gray-500">{deepDetailData.financial.margins?.trend}</p>
                            </div>
                          </div>

                          {/* Solvency & Liquidity */}
                          <div className="pt-4 border-t border-black/5">
                            <h5 className="text-xs font-extrabold uppercase tracking-wide text-gray-400 mb-2.5">Solvency & Liquidity Checks</h5>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                              {[
                                { label: "Debt-to-Equity", value: deepDetailData.financial.solvency?.debtToEquity },
                                { label: "Interest Coverage", value: deepDetailData.financial.solvency?.interestCoverage },
                                { label: "Current Ratio", value: deepDetailData.financial.solvency?.currentRatio },
                                { label: "Quick Ratio", value: deepDetailData.financial.solvency?.quickRatio }
                              ].map((s, i) => (
                                <div key={i} className="bg-white p-3 border border-black/5 rounded-lg">
                                  <span className="text-[9px] uppercase font-bold text-gray-400 block">{s.label}</span>
                                  <span className="text-sm font-black text-gray-700 block mt-1">{s.value || "—"}</span>
                                </div>
                              ))}
                            </div>
                            <p className="text-xs leading-relaxed text-gray-500 mt-2.5">{deepDetailData.financial.solvency?.assessment}</p>
                          </div>

                          {/* Free Cash Flow */}
                          <div className="pt-4 border-t border-black/5">
                            <h5 className="text-xs font-extrabold uppercase tracking-wide text-gray-400 mb-2">Free Cash Flow (FCF) & Allocation Quality</h5>
                            <div className="flex gap-6 mb-2">
                              <div>
                                <span className="text-[9px] uppercase font-bold text-gray-400 block">FCF Conversion</span>
                                <span className="text-sm font-black text-gray-700 block mt-0.5">{deepDetailData.financial.fcf?.fcfConversion || "—"}</span>
                              </div>
                              <div>
                                <span className="text-[9px] uppercase font-bold text-gray-400 block">FCF Yield</span>
                                <span className="text-sm font-black text-gray-700 block mt-0.5">{deepDetailData.financial.fcf?.fcfYield || "—"}</span>
                              </div>
                            </div>
                            <p className="text-xs leading-relaxed text-gray-500">{deepDetailData.financial.fcf?.capitalAllocation}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )
          )}

          {/* MOAT TAB */}
          {activeTab === "moat" && (
            !report.competitivePosition ? (
              <ShimmerTab label="Competitive Moat" />
            ) : (
              <div className="flex flex-col gap-6 animate-fade-in">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 style={sectionLabel} className="mb-3">Competitive Moat Sources</h4>
                    <MetricChart type="moat" data={moatChartData} />
                  </div>
                  <div>
                    <h4 style={sectionLabel} className="mb-3">Key Competitors Scan</h4>
                    <div className="flex flex-col gap-2.5">
                      {(moat.keyCompetitors || []).map((comp, idx) => {
                        const isHigh = comp.threat?.toLowerCase() === "high";
                        const isMed = comp.threat?.toLowerCase() === "medium";
                        const bg = isHigh ? 'var(--red-soft)' : isMed ? 'var(--amber-soft)' : 'var(--green-soft)';
                        const border = isHigh ? '1px solid rgba(217,48,37,0.12)' : isMed ? '1px solid rgba(249,171,0,0.12)' : '1px solid rgba(30,142,62,0.12)';
                        return (
                          <div key={idx} className="p-3.5 transition-all hover:shadow-sm" style={{ background: bg, border: border, borderRadius: 'var(--radius-md)' }}>
                            <div className="flex justify-between items-center">
                              <span className="font-bold text-sm text-[var(--text-primary)]">{comp.name}</span>
                              <span className="text-[10px] uppercase font-extrabold px-2 py-0.5" style={{
                                borderRadius: 'var(--radius-full)',
                                background: isHigh ? 'var(--red-soft)' : isMed ? 'var(--amber-soft)' : 'var(--green-soft)',
                                color: isHigh ? 'var(--red)' : isMed ? 'var(--amber)' : 'var(--green)',
                                border: isHigh ? '1px solid rgba(217,48,37,0.15)' : isMed ? '1px solid rgba(249,171,0,0.15)' : '1px solid rgba(30,142,62,0.15)',
                              }}>{comp.threat} threat</span>
                            </div>
                            <p className="text-sm leading-relaxed mt-1.5" style={{ color: 'var(--text-secondary)' }}>{comp.comparison}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
                <div className="pt-5" style={{ borderTop: '1px solid var(--glass-border)' }}>
                  <div className="flex flex-wrap gap-8 mb-4 bg-gray-50/50 p-4 border border-black/5 rounded-xl">
                    {[{ l: "Moat Rating", v: moat.moatRating, c: 'var(--accent-1)' }, { l: "Competitive Score", v: `${moat.moatScore}/100` }, { l: "Market Position", v: moat.marketPosition }].map((m, i) => (
                      <div key={i}>
                        <span className="text-[10px] uppercase font-bold block" style={{ color: 'var(--text-muted)' }}>{m.l}</span>
                        <span className="font-extrabold text-base" style={{ color: m.c || 'var(--text-primary)' }}>{m.v}</span>
                      </div>
                    ))}
                  </div>
                  <h4 style={sectionLabel} className="mb-2">Competitive Edge Assessment</h4>
                  <ExpandableText text={moat.summary} maxLength={420} />
                </div>

                {/* Deep Competitor SWOT & Breakdown Accordion */}
                <div className="mt-6 pt-5 border-t border-black/5">
                  <button
                    onClick={() => handleToggleDeep("moat")}
                    className="w-full flex items-center justify-between p-4 bg-teal-50/50 hover:bg-teal-50 border border-teal-100 rounded-xl text-left transition-all group cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5">
                      <ShieldCheck size={16} style={{ color: 'var(--teal)' }} />
                      <span className="text-sm font-bold text-[var(--teal)]">
                        {expandedDeep.moat ? "Hide Competitor SWOT & Breakdown" : "⚡ Load Competitor SWOT & Pricing Matrix"}
                      </span>
                    </div>
                    <ChevronDown
                      size={16}
                      style={{ color: 'var(--teal)', transform: expandedDeep.moat ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}
                    />
                  </button>

                  {expandedDeep.moat && (
                    <div className="mt-4 p-5 bg-gray-50/80 border border-black/5 rounded-xl animate-slide-up">
                      {deepDetailLoading.moat && (
                        <div className="flex flex-col items-center py-8">
                          <div className="w-8 h-8 rounded-full border-2 border-teal-500 border-t-transparent animate-spin mb-2" />
                          <span className="text-xs font-semibold text-gray-500">Building SWOT & Pricing Matrices...</span>
                        </div>
                      )}
                      {!deepDetailLoading.moat && !deepDetailData.moat && (
                        <span className="text-xs text-red-500">Failed to load competitor breakdown. Please try again.</span>
                      )}
                      {!deepDetailLoading.moat && deepDetailData.moat && (
                        <div className="space-y-6">
                          {/* SWOT Analysis */}
                          <div>
                            <h5 className="text-xs font-extrabold uppercase tracking-wide text-gray-400 mb-3">Head-to-Head SWOT Profile</h5>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div className="bg-green-50/50 p-4 border border-green-100 rounded-lg">
                                <span className="text-[10px] uppercase font-extrabold text-green-700 block mb-1.5">Strengths</span>
                                <ul className="text-xs space-y-1 list-disc pl-4 text-green-800">
                                  {(deepDetailData.moat.swot?.strengths || []).map((s, idx) => <li key={idx}>{s}</li>)}
                                </ul>
                              </div>
                              <div className="bg-red-50/50 p-4 border border-red-100 rounded-lg">
                                <span className="text-[10px] uppercase font-extrabold text-red-700 block mb-1.5">Weaknesses</span>
                                <ul className="text-xs space-y-1 list-disc pl-4 text-red-800">
                                  {(deepDetailData.moat.swot?.weaknesses || []).map((w, idx) => <li key={idx}>{w}</li>)}
                                </ul>
                              </div>
                              <div className="bg-blue-50/50 p-4 border border-blue-100 rounded-lg">
                                <span className="text-[10px] uppercase font-extrabold text-blue-700 block mb-1.5">Opportunities</span>
                                <ul className="text-xs space-y-1 list-disc pl-4 text-blue-800">
                                  {(deepDetailData.moat.swot?.opportunities || []).map((o, idx) => <li key={idx}>{o}</li>)}
                                </ul>
                              </div>
                              <div className="bg-amber-50/50 p-4 border border-amber-100 rounded-lg">
                                <span className="text-[10px] uppercase font-extrabold text-amber-700 block mb-1.5">Threats</span>
                                <ul className="text-xs space-y-1 list-disc pl-4 text-amber-800">
                                  {(deepDetailData.moat.swot?.threats || []).map((t, idx) => <li key={idx}>{t}</li>)}
                                </ul>
                              </div>
                            </div>
                          </div>

                          {/* Market Share */}
                          <div className="pt-4 border-t border-black/5">
                            <h5 className="text-xs font-extrabold uppercase tracking-wide text-gray-400 mb-2.5">Estimated Segment Market Share</h5>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                              {(deepDetailData.moat.marketShare || []).map((m, idx) => (
                                <div key={idx} className="bg-white p-3 border border-black/5 rounded-lg flex justify-between items-center animate-fade-in">
                                  <div>
                                    <span className="font-bold text-xs text-gray-700 block">{m.company}</span>
                                    <span className="text-[10px] text-gray-400 mt-0.5 block">Market Share</span>
                                  </div>
                                  <div className="text-right">
                                    <span className="font-black text-sm text-teal-600 block">{m.share}</span>
                                    <span className={`text-[9px] font-bold uppercase ${m.trend?.toLowerCase() === 'gaining' ? 'text-green-500' : m.trend?.toLowerCase() === 'losing' ? 'text-red-500' : 'text-gray-400'}`}>{m.trend}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Differentiation */}
                          <div className="pt-4 border-t border-black/5">
                            <h5 className="text-xs font-extrabold uppercase tracking-wide text-gray-400 mb-2.5">Differentiation & Pricing Matrices</h5>
                            <div className="space-y-3">
                              {(deepDetailData.moat.differentiation || []).map((d, idx) => (
                                <div key={idx} className="bg-white p-3.5 border border-black/5 rounded-lg animate-fade-in">
                                  <div className="flex justify-between items-center mb-1.5">
                                    <span className="font-bold text-xs text-gray-700">{d.competitor}</span>
                                    <span className="text-[9px] uppercase font-bold px-2 py-0.5 bg-gray-100 rounded text-gray-500">{d.pricingStrategy} Strategy</span>
                                  </div>
                                  <p className="text-xs leading-relaxed text-gray-500">{d.productDifferentiation}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )
          )}

          {/* SENTIMENT TAB */}
          {activeTab === "sentiment" && (
            !report.newsSentiment ? (
              <ShimmerTab label="Sentiment & News" />
            ) : (
              <div className="flex flex-col gap-6 animate-fade-in">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {[
                    { l: "Consensus Narrative", v: sentiment.overallSentiment || "N/A", c: sentiment.overallSentiment === "Bullish" ? 'var(--green)' : sentiment.overallSentiment === "Bearish" ? 'var(--red)' : undefined, bg: sentiment.overallSentiment === "Bullish" ? 'var(--green-soft)' : sentiment.overallSentiment === "Bearish" ? 'var(--red-soft)' : 'var(--bg-secondary)', border: sentiment.overallSentiment === "Bullish" ? 'rgba(30,142,62,0.12)' : sentiment.overallSentiment === "Bearish" ? 'rgba(217,48,37,0.12)' : 'var(--glass-border)' },
                    { l: "Narrative Momentum", v: sentiment.narrativeMomentum || "Stable", bg: 'rgba(142,36,170,0.04)', border: 'rgba(142,36,170,0.12)', c: 'var(--purple)' },
                    { l: "Social & News Score", v: `${sentiment.sentimentScore || "N/A"}/100`, bg: 'var(--bg-secondary)', border: 'var(--glass-border)' },
                  ].map((s, i) => (
                    <div key={i} className="p-4 border" style={{ background: s.bg, borderColor: s.border, borderRadius: 'var(--radius-lg)' }}>
                      <span className="text-[10px] font-bold uppercase block" style={{ color: 'var(--text-secondary)' }}>{s.l}</span>
                      <span className="text-xl font-black block mt-1" style={{ color: s.c || 'var(--text-primary)' }}>{s.v}</span>
                    </div>
                  ))}
                </div>
                <div className="pt-2">
                  <h4 style={sectionLabel} className="mb-2">Narrative & Catalyst Summary</h4>
                  <ExpandableText text={sentiment.summary} maxLength={380} />
                </div>
                <div>
                  <h4 style={sectionLabel} className="mb-3">Significant Media Events</h4>
                  <div className="flex flex-col gap-2.5">
                    {(sentiment.keyEvents || []).map((e, idx) => {
                      const isPos = e.impact?.toLowerCase() === "positive";
                      const isNeg = e.impact?.toLowerCase() === "negative";
                      const bg = isPos ? 'var(--green-soft)' : isNeg ? 'var(--red-soft)' : 'var(--bg-secondary)';
                      const border = isPos ? '1px solid rgba(30,142,62,0.12)' : isNeg ? '1px solid rgba(217,48,37,0.12)' : '1px solid var(--glass-border)';
                      return (
                        <div key={idx} className="flex justify-between gap-4 p-3.5" style={{ background: bg, border: border, borderRadius: 'var(--radius-md)' }}>
                          <div>
                            <span className="text-sm block font-semibold text-[var(--text-primary)]">{e.event}</span>
                            <span className="text-xs block mt-1" style={{ color: 'var(--text-muted)' }}>{e.date || "Recent"}</span>
                          </div>
                          <span className="text-[10px] uppercase font-black shrink-0 self-center px-2.5 py-1 border" style={{
                            borderRadius: 'var(--radius-full)',
                            background: isPos ? 'var(--green-soft)' : isNeg ? 'var(--red-soft)' : 'var(--bg-secondary)',
                            color: isPos ? 'var(--green)' : isNeg ? 'var(--red)' : 'var(--text-secondary)',
                            borderColor: isPos ? 'rgba(30,142,62,0.15)' : isNeg ? 'rgba(217,48,37,0.15)' : 'var(--glass-border)',
                          }}>{e.impact}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Deep News & Narratives Accordion */}
                <div className="mt-6 pt-5 border-t border-black/5">
                  <button
                    onClick={() => handleToggleDeep("sentiment")}
                    className="w-full flex items-center justify-between p-4 bg-purple-50/50 hover:bg-purple-50 border border-purple-100 rounded-xl text-left transition-all group cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5">
                      <Users size={16} style={{ color: 'var(--purple)' }} />
                      <span className="text-sm font-bold text-[var(--purple)]">
                        {expandedDeep.sentiment ? "Hide Detailed Media & Retail Narratives" : "⚡ Load Detailed Retail & Earnings Call Narratives"}
                      </span>
                    </div>
                    <ChevronDown
                      size={16}
                      style={{ color: 'var(--purple)', transform: expandedDeep.sentiment ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}
                    />
                  </button>

                  {expandedDeep.sentiment && (
                    <div className="mt-4 p-5 bg-gray-50/80 border border-black/5 rounded-xl animate-slide-up">
                      {deepDetailLoading.sentiment && (
                        <div className="flex flex-col items-center py-8">
                          <div className="w-8 h-8 rounded-full border-2 border-purple-500 border-t-transparent animate-spin mb-2" />
                          <span className="text-xs font-semibold text-gray-500">Synthesizing Narratives & Call Transcripts...</span>
                        </div>
                      )}
                      {!deepDetailLoading.sentiment && !deepDetailData.sentiment && (
                        <span className="text-xs text-red-500">Failed to load detailed narratives. Please try again.</span>
                      )}
                      {!deepDetailLoading.sentiment && deepDetailData.sentiment && (
                        <div className="space-y-6">
                          {/* Narrative Themes */}
                          <div>
                            <h5 className="text-xs font-extrabold uppercase tracking-wide text-gray-400 mb-2.5">Core Narrative Dynamics</h5>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              {(deepDetailData.sentiment.narratives || []).map((n, idx) => {
                                const isBull = n.sentiment?.toLowerCase() === 'bullish';
                                const isBear = n.sentiment?.toLowerCase() === 'bearish';
                                const bg = isBull ? 'bg-green-50/30' : isBear ? 'bg-red-50/30' : 'bg-gray-100/30';
                                const textCol = isBull ? 'text-green-700' : isBear ? 'text-red-700' : 'text-gray-600';
                                return (
                                  <div key={idx} className={`p-3.5 border border-black/5 rounded-lg ${bg} animate-fade-in`}>
                                    <div className="flex justify-between items-center mb-1">
                                      <span className="font-bold text-xs text-gray-700">{n.theme}</span>
                                      <span className={`text-[9px] uppercase font-black px-1.5 py-0.5 rounded ${textCol}`}>{n.sentiment}</span>
                                    </div>
                                    <p className="text-xs leading-relaxed text-gray-500">{n.description}</p>
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          {/* Earnings Call Highlights */}
                          <div className="pt-4 border-t border-black/5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                              <h5 className="text-xs font-extrabold uppercase tracking-wide text-gray-400 mb-2.5">Recent Earnings Call Takeaways</h5>
                              <ul className="text-xs space-y-1.5 list-disc pl-4 text-gray-600">
                                {(deepDetailData.sentiment.earningsCall?.highlights || []).map((h, idx) => <li key={idx}>{h}</li>)}
                              </ul>
                            </div>
                            <div>
                              <h5 className="text-xs font-extrabold uppercase tracking-wide text-gray-400 mb-2">Management Forward Guidance</h5>
                              <p className="text-xs leading-relaxed text-gray-500">{deepDetailData.sentiment.earningsCall?.outlook}</p>
                            </div>
                          </div>

                          {/* Regulatory & Social */}
                          <div className="pt-4 border-t border-black/5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                              <h5 className="text-xs font-extrabold uppercase tracking-wide text-gray-400 mb-2">Legal & Regulatory Concerns</h5>
                              <p className="text-xs leading-relaxed text-gray-500">
                                {deepDetailData.sentiment.legalRegulatory?.concerns?.join(", ") || "No major legal actions logged."}
                              </p>
                              <span className="text-[10px] font-bold uppercase text-red-500 block mt-1.5">Severity: {deepDetailData.sentiment.legalRegulatory?.severity}</span>
                            </div>
                            <div>
                              <h5 className="text-xs font-extrabold uppercase tracking-wide text-gray-400 mb-2">Social & Retail Consensus ({deepDetailData.sentiment.socialSentiment?.trend})</h5>
                              <p className="text-xs leading-relaxed text-gray-500">{deepDetailData.sentiment.socialSentiment?.platforms}</p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )
          )}

          {/* RISK TAB */}
          {activeTab === "risk" && (
            !report.riskAssessment ? (
              <ShimmerTab label="Risk Assessment" />
            ) : (
              <div className="flex flex-col gap-5 animate-fade-in">
                <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 mb-2 border-b border-black/5">
                  <div>
                    <span className="text-[10px] uppercase font-bold block" style={{ color: 'var(--text-muted)' }}>Overall Portfolio Risk Rating</span>
                    <span className="text-xl font-extrabold" style={{ color: risks.overallRiskLevel === "High" ? 'var(--red)' : risks.overallRiskLevel === "Low" ? 'var(--green)' : 'var(--amber)' }}>{risks.overallRiskLevel || "Moderate"} ({risks.riskScore || "N/A"}/100)</span>
                  </div>
                  <div className="mt-2 md:mt-0 text-left md:text-right max-w-md bg-red-50/20 p-2.5 border border-red-100 rounded-lg">
                    <span className="text-[10px] uppercase font-bold block text-[var(--red)]">Primary Catalyst Concern</span>
                    <span className="text-sm font-semibold text-[var(--text-primary)]">{risks.biggestConcern}</span>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--glass-border)' }}>
                        {["Category", "Threat Detail", "Severity", "Probability", "Priced In?"].map((h, i) => (
                          <th key={i} className={`py-3 text-xs uppercase font-bold ${i >= 2 ? 'text-center' : ''} ${i === 4 ? 'text-right' : ''}`} style={{ color: 'var(--text-muted)' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(risks.risks || []).map((r, idx) => {
                        const rs = getRiskStyle(r.severity, r.probability);
                        return (
                          <tr key={idx} className="hover:bg-red-50/20 transition-colors border-b border-black/5">
                            <td className="py-3.5 pr-4 uppercase text-xs font-black text-[var(--accent-1)]">{r.category}</td>
                            <td className="py-3.5 pr-4 text-[14px]" style={{ color: 'var(--text-primary)' }}>{r.risk}</td>
                            <td className="py-3.5 text-center">
                              <span className="px-2.5 py-1 text-xs font-black border inline-block" style={{ borderRadius: 'var(--radius-full)', background: rs.bg, color: rs.color, borderColor: rs.border }}>{r.severity} / 5</span>
                            </td>
                            <td className="py-3.5 text-center font-bold text-[var(--text-secondary)]">{r.probability} / 5</td>
                            <td className="py-3.5 text-right font-black text-xs">
                              {r.pricedIn ? (
                                <span className="text-[var(--green)] bg-[var(--green-soft)] px-2.5 py-1 border border-green-200/50" style={{ borderRadius: 'var(--radius-full)' }}>YES</span>
                              ) : (
                                <span className="text-[var(--red)] bg-[var(--red-soft)] px-2.5 py-1 border border-red-200/50" style={{ borderRadius: 'var(--radius-full)' }}>NO</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="pt-5" style={{ borderTop: '1px solid var(--glass-border)' }}>
                  <h4 style={sectionLabel} className="mb-2">Downside Risk Assessment</h4>
                  <ExpandableText text={risks.summary} maxLength={420} />
                </div>

                {/* Deep 5x5 Risk Matrix Accordion */}
                <div className="mt-6 pt-5 border-t border-black/5">
                  <button
                    onClick={() => handleToggleDeep("risk")}
                    className="w-full flex items-center justify-between p-4 bg-red-50/50 hover:bg-red-50 border border-red-100 rounded-xl text-left transition-all group cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5">
                      <AlertTriangle size={16} style={{ color: 'var(--red)' }} />
                      <span className="text-sm font-bold text-[var(--red)]">
                        {expandedDeep.risk ? "Hide Comprehensive 5x5 Risk Matrix" : "⚡ Load Full 5x5 Risk Matrix & Specific Hedges"}
                      </span>
                    </div>
                    <ChevronDown
                      size={16}
                      style={{ color: 'var(--red)', transform: expandedDeep.risk ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}
                    />
                  </button>

                  {expandedDeep.risk && (
                    <div className="mt-4 p-5 bg-gray-50/80 border border-black/5 rounded-xl animate-slide-up">
                      {deepDetailLoading.risk && (
                        <div className="flex flex-col items-center py-8">
                          <div className="w-8 h-8 rounded-full border-2 border-red-500 border-t-transparent animate-spin mb-2" />
                          <span className="text-xs font-semibold text-gray-500">Mapping 5x5 Risk Levels & Mitigants...</span>
                        </div>
                      )}
                      {!deepDetailLoading.risk && !deepDetailData.risk && (
                        <span className="text-xs text-red-500">Failed to load detailed risk matrix. Please try again.</span>
                      )}
                      {!deepDetailLoading.risk && deepDetailData.risk && (
                        <div className="space-y-6 animate-fade-in">
                          {/* 5x5 Table */}
                          <div className="overflow-x-auto">
                            <h5 className="text-xs font-extrabold uppercase tracking-wide text-gray-400 mb-2.5">Exhaustive Risk Matrix (Likelihood x Impact)</h5>
                            <table className="w-full text-left text-xs bg-white border border-black/5 rounded-lg overflow-hidden">
                              <thead>
                                <tr className="bg-gray-50 border-b border-black/5 text-gray-400">
                                  <th className="py-2.5 px-3 uppercase font-extrabold">Category</th>
                                  <th className="py-2.5 px-3 uppercase font-extrabold">Specific Risk Event</th>
                                  <th className="py-2.5 px-3 uppercase font-extrabold text-center">L (1-5)</th>
                                  <th className="py-2.5 px-3 uppercase font-extrabold text-center">I (1-5)</th>
                                  <th className="py-2.5 px-3 uppercase font-extrabold">Hedging / Mitigant</th>
                                  <th className="py-2.5 px-3 uppercase font-extrabold">Indicators to Watch</th>
                                </tr>
                              </thead>
                              <tbody>
                                {(deepDetailData.risk.matrix || []).map((m, idx) => (
                                  <tr key={idx} className="border-b border-black/5 hover:bg-gray-50/40 text-gray-600">
                                    <td className="py-3 px-3 font-bold text-red-600 uppercase text-[10px]">{m.category}</td>
                                    <td className="py-3 px-3 font-medium text-gray-700">{m.event}</td>
                                    <td className="py-3 px-3 text-center font-bold text-gray-500">{m.probability}</td>
                                    <td className="py-3 px-3 text-center font-bold text-red-500">{m.severity}</td>
                                    <td className="py-3 px-3">{m.mitigation}</td>
                                    <td className="py-3 px-3 font-mono text-[10px]">{m.indicators}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>

                          {/* Stress Test */}
                          <div className="pt-4 border-t border-black/5">
                            <h5 className="text-xs font-extrabold uppercase tracking-wide text-gray-400 mb-2">Simulated Stress Test Scenario</h5>
                            <p className="text-xs leading-relaxed text-gray-500">{deepDetailData.risk.stressTest}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )
          )}

          {/* MACRO TAB */}
          {activeTab === "macro" && (
            (!report.industryOutlook || !report.managementAnalysis) ? (
              <ShimmerTab label="Macro & Leadership" />
            ) : (
              <div className="flex flex-col gap-6 animate-fade-in">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 style={sectionLabel} className="mb-3">Management & Capital Allocation</h4>
                    <div className="flex flex-col gap-3.5 p-4 border" style={{ background: 'var(--purple-soft)', borderColor: 'rgba(142,36,170,0.12)', borderRadius: 'var(--radius-lg)' }}>
                      <div>
                        <span className="text-[10px] uppercase font-bold block text-[var(--purple)]">Chief Executive Officer</span>
                        <span className="text-sm block mt-1 font-bold text-[var(--text-primary)]">
                          {mgmt.ceo?.name || "N/A"}{mgmt.ceo?.tenure ? ` · ${mgmt.ceo.tenure}` : ""}
                        </span>
                        <p className="text-sm mt-1 leading-relaxed text-[var(--text-secondary)]">{mgmt.ceo?.assessment || mgmt.summary}</p>
                      </div>
                      {[
                        { l: "Capital Allocation", v: mgmt.capitalAllocation || "N/A" },
                        { l: "Insider Trading Signal", v: mgmt.insiderSignal || "Neutral", c: mgmt.insiderSignal === "Bullish" ? 'var(--green)' : mgmt.insiderSignal === "Bearish" ? 'var(--red)' : undefined },
                        { l: "Strategic Vision Clarity", v: mgmt.strategicClarity || "N/A" },
                      ].map((item, i) => (
                        <div key={i} className="flex justify-between items-center pt-2.5" style={{ borderTop: '1px solid rgba(142,36,170,0.12)' }}>
                          <span className="text-[10px] uppercase font-bold text-[var(--text-secondary)]">{item.l}</span>
                          <span className="font-extrabold text-sm" style={{ color: item.c || 'var(--text-primary)' }}>{item.v}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 style={sectionLabel} className="mb-3">Macro Environment & Industry Growth</h4>
                    <div className="flex flex-col gap-3.5 p-4 border" style={{ background: 'var(--teal-soft)', borderColor: 'rgba(0,131,143,0.12)', borderRadius: 'var(--radius-lg)' }}>
                      {[
                        { l: "Industry Segment Growth", v: macro.industryGrowth || "N/A", c: 'var(--teal)' },
                        { l: "Economic Cycle Sensitivity", v: macro.cycleSensitivity || "Defensive" }
                      ].map((item, i) => (
                        <div key={i} className="flex justify-between items-center" style={i ? { borderTop: '1px solid rgba(0,131,143,0.12)', paddingTop: 10 } : {}}>
                          <span className="text-[10px] uppercase font-bold text-[var(--text-secondary)]">{item.l}</span>
                          <span className="font-extrabold text-sm" style={{ color: item.c || 'var(--text-primary)' }}>{item.v}</span>
                        </div>
                      ))}
                      <div className="mt-2">
                        <span className="text-[10px] uppercase font-bold block text-[var(--teal)]">Industry Tailwinds</span>
                        <div className="flex flex-col gap-1.5 mt-2 pl-3" style={{ borderLeft: '3px solid rgba(0,131,143,0.2)' }}>
                          {(macro.tailwinds || []).slice(0, 3).map((t, i) => (
                            <span key={i} className="text-sm font-medium text-[var(--text-secondary)]">
                              • <strong className="font-semibold text-[var(--text-primary)]">{t.trend}</strong>
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="pt-5" style={{ borderTop: '1px solid var(--glass-border)' }}>
                  <h4 style={sectionLabel} className="mb-2">Industry Macro Assessment</h4>
                  <ExpandableText text={macro.summary} maxLength={420} />
                </div>
              </div>
            )
          )}
        </div>
      </div>

      {/* ── 5. SOURCES (Google Neutral Card) ── */}
      <div className="animate-slide-up card-google-neutral p-7" style={{ borderLeft: '1px solid rgba(0, 0, 0, 0.08)' }}>
        <h3 className="mb-3.5 pb-2 font-bold" style={{ ...sectionLabel, borderBottom: '1px solid var(--glass-border)' }}>Research Provenance & Metadata</h3>
        <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
          {/* Tool badges */}
          {meta.toolsUsed?.length > 0 ? (
            <div className="flex flex-wrap gap-2 animate-fade-in">
              {meta.toolsUsed.map((tool, i) => (
                <span key={i} className="px-3 py-1 text-xs font-semibold border border-black/5" style={{ background: 'var(--bg-secondary)', borderRadius: 'var(--radius-full)', color: 'var(--text-secondary)' }}>
                  {tool}
                </span>
              ))}
              <span className="px-3 py-1 text-xs font-semibold border border-[rgba(26,115,232,0.15)]" style={{ background: 'rgba(26,115,232,0.06)', borderRadius: 'var(--radius-full)', color: 'var(--accent-1)' }}>
                {meta.architecture}
              </span>
            </div>
          ) : <span className="text-xs font-semibold">Loaded from analysis cache.</span>}

          {/* Source URLs — clickable trust layer */}
          {meta.sources?.length > 0 && (
            <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--glass-border)' }}>
              <span style={{ ...sectionLabel, fontSize: '10px' }} className="block mb-2">Research Sources ({meta.sources.length})</span>
              <div className="flex flex-col gap-1.5">
                {meta.sources.map((src, i) => (
                  <a key={i} href={src.url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 text-xs py-1.5 px-2 rounded-md transition-all hover:bg-[rgba(26,115,232,0.04)] group"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    <ExternalLink size={11} className="shrink-0 text-[var(--accent-1)] opacity-50 group-hover:opacity-100" />
                    <span className="truncate font-medium group-hover:text-[var(--accent-1)] transition-colors">{src.title}</span>
                    <span className="shrink-0 ml-auto text-[10px] font-semibold px-1.5 py-0.5 rounded bg-black/[0.03] text-[var(--text-muted)]">{src.domain}</span>
                  </a>
                ))}
              </div>
            </div>
          )}

          <div className="text-xs mt-4 pt-3.5 flex justify-between font-medium" style={{ borderTop: '1px solid var(--glass-border)', color: 'var(--text-secondary)' }}>
            <span>Researched On: {meta.researchedAt ? new Date(meta.researchedAt).toLocaleString() : "—"}</span>
            <span>Execution Duration: <strong className="font-bold text-[var(--text-primary)]">{meta.totalTime || "—"}</strong></span>
          </div>
        </div>
      </div>

      {/* ── 6. DISCLAIMER ── */}
      <div className="text-center text-xs px-4 mt-2 leading-relaxed max-w-4xl mx-auto" style={{ color: 'var(--text-muted)' }}>
        <AlertTriangle size={12} className="inline mr-1 align-text-bottom text-[var(--amber)]" />
        <strong className="font-bold text-[var(--text-secondary)]">DISCLAIMER:</strong> {disclaimer}
      </div>
    </div>
  );
}
