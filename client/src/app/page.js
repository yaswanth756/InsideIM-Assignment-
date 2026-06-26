"use client";

import { useEffect, useState } from "react";
import SearchBar from "@/components/SearchBar";
import StreamingStatus from "@/components/StreamingStatus";
import Dashboard from "@/components/Dashboard";
import { Shield, Award, Activity, AlertTriangle, ArrowRight } from "lucide-react";

export default function Home() {
  const [company, setCompany] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState("idle");
  const [statusLog, setStatusLog] = useState([]);
  const [report, setReport] = useState(null);
  const [recentAnalyses, setRecentAnalyses] = useState([]);
  const [savedPortfolio, setSavedPortfolio] = useState([]);
  const [activeRequest, setActiveRequest] = useState(null);

  useEffect(() => {
    try {
      const recents = localStorage.getItem("xinvest_recents");
      if (recents) setRecentAnalyses(JSON.parse(recents));
      const portfolio = localStorage.getItem("xinvest_portfolio");
      if (portfolio) setSavedPortfolio(JSON.parse(portfolio));
    } catch (e) {
      console.error("Failed to load local storage:", e);
    }
    const params = new URLSearchParams(window.location.search);
    const companyParam = params.get("company");
    if (companyParam) handleStartResearch(companyParam.trim());
  }, []);

  const updateUrl = (symbol) => {
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      if (symbol) url.searchParams.set("company", symbol);
      else url.searchParams.delete("company");
      window.history.pushState({}, "", url.toString());
    }
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && isLoading) { e.preventDefault(); handleCancel(); }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isLoading, activeRequest]);

  const addStatusLog = (step, message) => {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setStatusLog((prev) => [...prev, { time, step, message }]);
  };

  const handleStartResearch = async (searchQuery, context = {}) => {
    if (!searchQuery.trim() || isLoading) return;
    setIsLoading(true); setReport(null); setStatusLog([]); setCompany(searchQuery); updateUrl(searchQuery);
    addStatusLog("init", `Starting research on "${searchQuery}"...`);
    setCurrentStep("init");
    const controller = new AbortController();
    setActiveRequest(controller);

    try {
      const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const response = await fetch(`${API_BASE}/api/research`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company: searchQuery, context }),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`Server returned HTTP ${response.status}`);
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (!line.trim() || !line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6));
            if (event.type === "status") {
              setCurrentStep(event.step);
              addStatusLog(event.step, event.message);
            }
            else if (event.type === "preliminary") {
              // Phase 1.5: Show preliminary directional signal (not final verdict)
              setReport({ ...event.data, isPreliminary: true });
              addStatusLog("preliminary", "Preliminary signal ready. Specialists analyzing...");
            }
            else if (event.type === "specialist") {
              setReport((prev) => {
                if (!prev) return null;
                return {
                  ...prev,
                  [event.key]: event.data
                };
              });
            }
            else if (event.type === "report") {
              // Phase 3: Final CIO verdict from supervisor synthesis
              setReport({ ...event.data, isPreliminary: false, isFinal: true });
              saveToRecent(event.data);
            }
            else if (event.type === "done") {
              setCurrentStep("done");
              setIsLoading(false);
              addStatusLog("done", "Analysis complete.");
              setReport((currentReport) => {
                if (currentReport) saveToRecent(currentReport);
                return currentReport;
              });
            }
            else if (event.type === "error") {
              setCurrentStep("error");
              setIsLoading(false);
              addStatusLog("error", event.message || "Failed.");
            }
          } catch (err) { console.warn("SSE parse error:", err); }
        }
      }
    } catch (err) {
      addStatusLog("error", err.name === "AbortError" ? "Cancelled by user." : (err.message || "Connection failed."));
      setCurrentStep("error"); setIsLoading(false);
    } finally { setActiveRequest(null); }
  };

  const handleCancel = () => { activeRequest?.abort(); setIsLoading(false); setCurrentStep("error"); addStatusLog("error", "Cancelled."); };

  const saveToRecent = (r) => {
    try {
      let list = JSON.parse(localStorage.getItem("xinvest_recents") || "[]");
      list = list.filter(i => i.ticker?.toLowerCase() !== r.ticker?.toLowerCase());
      list.unshift({ ticker: r.ticker || r.companyName, companyName: r.companyName, verdict: r.verdict, confidence: r.confidence, date: new Date().toISOString(), fullReport: r });
      list = list.slice(0, 5);
      setRecentAnalyses(list); localStorage.setItem("xinvest_recents", JSON.stringify(list));
    } catch (e) { console.error(e); }
  };

  const handleSavePortfolio = () => {
    if (!report) return;
    try {
      let list = JSON.parse(localStorage.getItem("xinvest_portfolio") || "[]");
      list = list.filter(i => i.ticker?.toLowerCase() !== report.ticker?.toLowerCase());
      list.push({ ticker: report.ticker, companyName: report.companyName, verdict: report.verdict, date: new Date().toISOString() });
      setSavedPortfolio(list); localStorage.setItem("xinvest_portfolio", JSON.stringify(list));
    } catch (e) { console.error(e); }
  };

  const loadSavedReport = (s) => {
    if (s.fullReport) {
      setReport(s.fullReport); setCompany(s.companyName); updateUrl(s.ticker); setCurrentStep("done");
      setStatusLog([{ time: "Cache", step: "cache", message: `Loaded report for ${s.companyName}` }]);
    } else handleStartResearch(s.ticker || s.companyName);
  };

  const clearReport = () => { setReport(null); setCompany(""); updateUrl(""); setCurrentStep("idle"); setStatusLog([]); };
  const isSavedInPortfolio = report ? savedPortfolio.some(i => i.ticker?.toLowerCase() === report.ticker?.toLowerCase()) : false;

  return (
    <div className="flex-1 flex flex-col min-h-screen" style={{ background: 'var(--bg-primary)' }}>

      {/* ── HEADER (Google Glass navbar style) ── */}
      <header
        className="py-3 px-5 sm:px-8 flex items-center justify-between no-print sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-black/5"
      >
        <div className="flex items-center gap-3 cursor-pointer" onClick={clearReport}>
          <div className="w-8 h-8 flex items-center justify-center font-bold text-sm text-white" style={{ borderRadius: '8px', background: 'var(--gradient-accent)' }}>T</div>
          <span className="font-extrabold text-base tracking-tight" style={{ color: 'var(--text-primary)' }}>Truth Capital</span>
          <span className="text-[9px] font-mono font-bold px-2 py-0.5" style={{ color: 'var(--accent-1)', border: '1px solid rgba(26,115,232,0.25)', borderRadius: 'var(--radius-full)', background: 'rgba(26,115,232,0.06)' }}>v1.0</span>
        </div>
        {report && (
          <button onClick={clearReport} className="text-xs font-semibold px-4 py-2 transition-all border border-[var(--glass-border)] rounded-full bg-white hover:bg-gray-50 text-[var(--accent-1)] hover:-translate-y-0.5 hover:shadow-sm">
            ← Analyze Another Company
          </button>
        )}
      </header>

      <main className="flex-1 flex flex-col p-4 sm:p-6 lg:p-8" style={{ background: 'var(--bg-primary)' }}>

        {/* ── LANDING ── */}
        {currentStep === "idle" && !report && (
          <div className="flex-1 flex flex-col items-center justify-center max-w-4xl mx-auto w-full py-20 md:py-32 animate-fade-in">
            {/* Ambient Background Blur Orb */}
            <div className="absolute pointer-events-none" style={{ top: '12%', left: '50%', transform: 'translateX(-50%)' }}>
              <div className="animate-float animate-glow-pulse" style={{ width: '450px', height: '450px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(66,133,244,0.08) 0%, rgba(26,115,232,0.03) 40%, transparent 70%)', filter: 'blur(60px)' }} />
            </div>

            <div className="text-center mb-12 flex flex-col items-center select-none relative z-10">
              <h1 className="text-5xl sm:text-6xl font-black tracking-tight leading-none">
                <span className="text-gradient">xInvest</span>{" "}
                <span style={{ color: 'var(--text-primary)' }}>Engine</span>
              </h1>
              <p className="text-base mt-4 max-w-md leading-relaxed font-medium" style={{ color: 'var(--text-secondary)' }}>
                Multi-agent validation pipeline. 6 specialized analyst inputs. 1 unified portfolio verdict.
              </p>
            </div>

            <div className="relative z-10 w-full"><SearchBar onSearch={handleStartResearch} isLoading={false} /></div>

            {/* Recents List */}
            {recentAnalyses.length > 0 && (
              <div className="w-full max-w-xl mt-14 relative z-10">
                <span className="text-[10px] font-bold uppercase tracking-wider block pb-2 mb-3 border-b border-black/5" style={{ color: 'var(--text-secondary)' }}>Recent Analyses</span>
                <div className="flex flex-col gap-2">
                  {recentAnalyses.map((item, idx) => {
                    const isRecInvest = item.verdict === "INVEST";
                    return (
                      <button 
                        key={idx} 
                        onClick={() => loadSavedReport(item)} 
                        className="flex items-center justify-between p-4 text-left transition-all group card-google-neutral hover:-translate-y-0.5"
                      >
                        <div className="flex items-center gap-3">
                          <span className="font-extrabold text-sm text-[var(--text-primary)]">{item.ticker}</span>
                          <span className="text-xs font-semibold px-2 py-0.5 bg-gray-100/80 rounded text-gray-500">{item.companyName}</span>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-xs font-black uppercase px-2 py-1 rounded" style={{
                            background: isRecInvest ? 'var(--green-soft)' : 'var(--red-soft)',
                            color: isRecInvest ? 'var(--green)' : 'var(--red)',
                            border: isRecInvest ? '1px solid rgba(30,142,62,0.12)' : '1px solid rgba(217,48,37,0.12)',
                          }}>
                            {item.verdict} ({item.confidence}%)
                          </span>
                          <ArrowRight size={14} style={{ color: 'var(--text-muted)' }} className="group-hover:translate-x-0.5 transition-transform" />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Stats Cards (Google Branded Blue, Green, Amber) */}
            <div className="grid grid-cols-3 gap-4 w-full max-w-xl mt-16 text-center select-none relative z-10">
              {[
                { icon: Activity, color: 'var(--accent-1)', label: "Processed", value: "247 COs", cardClass: "card-google-blue" },
                { icon: Shield, color: 'var(--green)', label: "Avg Confidence", value: "68.2%", cardClass: "card-google-green" },
                { icon: Award, color: 'var(--amber)', label: "Pipeline Accuracy", value: "92.4%", cardClass: "card-google-amber" },
              ].map((stat, i) => {
                const Icon = stat.icon;
                return (
                  <div key={i} className={`flex flex-col items-center p-5 hover:-translate-y-1 ${stat.cardClass}`} style={{
                    borderLeft: stat.cardClass === 'card-google-blue' ? '1px solid rgba(66, 133, 244, 0.15)' :
                                stat.cardClass === 'card-google-green' ? '1px solid rgba(52, 168, 83, 0.15)' :
                                '1px solid rgba(249, 171, 0, 0.15)'
                  }}>
                    <Icon size={22} style={{ color: stat.color }} className="mb-2" />
                    <span className="text-[10px] uppercase tracking-wider block font-bold" style={{ color: 'var(--text-secondary)' }}>{stat.label}</span>
                    <span className="font-extrabold text-lg mt-1" style={{ color: 'var(--text-primary)' }}>{stat.value}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── LOADING ── */}
        {isLoading && !report && (
          <div className="flex-1 flex flex-col lg:flex-row gap-6 max-w-6xl mx-auto w-full animate-fade-in">
            <StreamingStatus statusLog={statusLog} currentStep={currentStep} onCancel={handleCancel} report={report} />
            <div className="flex-1 flex flex-col justify-between min-h-[400px] card-google-neutral p-7" style={{ borderLeft: '1px solid rgba(0, 0, 0, 0.08)' }}>
              <div className="flex flex-col gap-5">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-28 animate-shimmer" style={{ background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)' }} />
                  <div className="flex flex-col gap-2">
                    <div className="h-5 w-52 animate-shimmer" style={{ background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)' }} />
                    <div className="h-4 w-36 animate-shimmer" style={{ background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)' }} />
                  </div>
                </div>
                <div className="mt-6 space-y-4">
                  <div className="h-6 w-full animate-shimmer" style={{ background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)' }} />
                  <div className="h-28 w-full animate-shimmer" style={{ background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)' }} />
                  <div className="h-40 w-full animate-shimmer" style={{ background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)' }} />
                </div>
              </div>
              <div className="pt-5 flex justify-between items-center text-sm font-mono" style={{ borderTop: '1px solid var(--glass-border)', color: 'var(--text-muted)' }}>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: 'var(--accent-1)' }} />
                  <span className="font-semibold">Analyzing {company}...</span>
                </div>
                <span className="uppercase text-xs font-bold text-[var(--accent-1)]">{currentStep}</span>
              </div>
            </div>
          </div>
        )}

        {/* ── REPORT ── */}
        {report && (
          <div className="flex-1 flex flex-col gap-6 animate-fade-in">
            {isLoading && (
              <div className="max-w-6xl w-full mx-auto p-4 flex items-center justify-between no-print border shadow-sm animate-pulse" style={{ background: 'rgba(26,115,232,0.04)', borderColor: 'rgba(26,115,232,0.15)', borderRadius: 'var(--radius-lg)' }}>
                <div className="flex items-center gap-3 text-sm font-semibold" style={{ color: 'var(--accent-1)' }}>
                  <span className="w-2.5 h-2.5 rounded-full bg-[var(--accent-1)] animate-ping" />
                  <span>Streaming expert analysis sections ({statusLog[statusLog.length - 1]?.message || "Analyzing..."})</span>
                </div>
                <button onClick={handleCancel} className="text-xs font-bold text-red-500 hover:underline cursor-pointer">
                  Stop Stream
                </button>
              </div>
            )}
            <div className="flex flex-col md:flex-row items-center gap-4 max-w-6xl w-full mx-auto no-print card-google-neutral p-4">
              <span className="text-xs font-bold uppercase tracking-wider shrink-0 text-[var(--text-secondary)]">New Research Query:</span>
              <div className="flex-1 w-full"><SearchBar onSearch={handleStartResearch} isLoading={isLoading} initialValue={company} /></div>
            </div>
            <Dashboard report={report} onSavePortfolio={handleSavePortfolio} isSaved={isSavedInPortfolio} />
          </div>
        )}

        {/* ── ERROR ── */}
        {currentStep === "error" && !isLoading && (
          <div className="flex-1 flex flex-col items-center justify-center max-w-lg mx-auto w-full py-16 text-center animate-fade-in">
            <div className="w-14 h-14 flex items-center justify-center mb-5" style={{ borderRadius: 'var(--radius-xl)', background: 'var(--red-soft)' }}>
              <AlertTriangle size={26} style={{ color: 'var(--red)' }} />
            </div>
            <h2 className="font-bold text-xl mb-2" style={{ color: 'var(--text-primary)' }}>Analysis Pipeline Interrupted</h2>
            <p className="text-base leading-relaxed mb-8 font-medium" style={{ color: 'var(--text-secondary)' }}>
              {statusLog[statusLog.length - 1]?.message || "An unexpected error occurred during execution."}
            </p>
            <div className="flex gap-3 w-full">
              <button onClick={() => handleStartResearch(company)} className="flex-1 py-3 text-sm font-semibold transition-all hover:bg-gray-100 hover:shadow-sm" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--glass-border)', borderRadius: 'var(--radius-lg)', color: 'var(--text-primary)', cursor: 'pointer' }}>Try Again</button>
              <button onClick={clearReport} className="flex-1 py-3 text-sm font-semibold transition-all hover:shadow-md text-white cursor-pointer" style={{ background: 'var(--accent-1)', borderRadius: 'var(--radius-lg)', border: 'none' }}>New Search</button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
