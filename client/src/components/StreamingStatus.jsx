"use client";

import { useEffect, useRef } from "react";
import { CheckCircle2, Circle, Loader2, Terminal } from "lucide-react";

export default function StreamingStatus({ statusLog, currentStep, onCancel, report }) {
  const logEndRef = useRef(null);
  useEffect(() => { logEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [statusLog]);

  const getPhaseState = (phaseName) => {
    const map = {
      ingestion: { active: ["init", "research"], done: ["verdict", "analyzing", "done", "cache"] },
      cio: { active: ["verdict"], done: ["analyzing", "done", "cache"] },
      specialists: { active: ["analyzing"], done: ["done", "cache"] },
    };
    const m = map[phaseName];
    if (!m) return "pending";
    if (m.active.includes(currentStep)) return "active";
    if (m.done.includes(currentStep)) return "completed";
    return "pending";
  };

  const hasToolRun = (prefix) => statusLog.some(l => l.message.toLowerCase().includes(prefix.toLowerCase()));

  const ToolStatus = ({ prefix, label }) => {
    const done = hasToolRun(prefix);
    const active = (currentStep === "research" || currentStep === "init") && statusLog[statusLog.length - 1]?.message.toLowerCase().includes(prefix.toLowerCase());
    return (
      <div className="flex items-center gap-2.5 text-sm py-0.5">
        {done ? <CheckCircle2 size={14} style={{ color: 'var(--green)' }} /> : active ? <Loader2 size={14} className="animate-spin" style={{ color: 'var(--accent-1)' }} /> : <Circle size={14} style={{ color: 'var(--text-muted)' }} />}
        <span style={{ color: done ? 'var(--text-secondary)' : active ? 'var(--accent-1)' : 'var(--text-muted)' }}>{label}{active ? '...' : ''}</span>
      </div>
    );
  };

  const SpecialistStatus = ({ label, reportKey }) => {
    const isComplete = report && !!report[reportKey];
    const isMissingAfterDone = currentStep === "done" && !isComplete;
    const isActive = currentStep === "analyzing" && !isComplete;
    const dotColor = isComplete
      ? 'var(--green)'
      : isMissingAfterDone
        ? 'var(--red)'
        : isActive
          ? 'var(--accent-1)'
          : '#e0e0e0';
    const textColor = isComplete
      ? 'var(--text-secondary)'
      : isMissingAfterDone
        ? 'var(--red)'
        : isActive
          ? 'var(--accent-1)'
          : 'var(--text-muted)';
    const suffix = isActive ? ' thinking...' : isMissingAfterDone ? ' unavailable' : '';
    return (
      <div className="flex items-center gap-2.5 text-sm py-0.5">
        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: dotColor }} />
        <span style={{ color: textColor }}>{label}{suffix}</span>
      </div>
    );
  };

  const PhaseHeader = ({ phase, label }) => {
    const state = getPhaseState(phase);
    return (
      <div className="flex items-center gap-2">
        {state === "completed" ? <CheckCircle2 size={17} style={{ color: 'var(--green)' }} /> : state === "active" ? <Loader2 size={17} className="animate-spin" style={{ color: 'var(--accent-1)' }} /> : <Circle size={17} style={{ color: '#ddd' }} />}
        <span className="text-sm uppercase tracking-wider font-semibold" style={{ color: state === "active" ? 'var(--accent-1)' : state === "completed" ? 'var(--text-primary)' : 'var(--text-muted)' }}>{label}</span>
      </div>
    );
  };

  return (
    <div className="w-full lg:w-[300px] flex flex-col gap-5 select-none shrink-0 animate-fade-in" style={{ background: '#fff', border: '1px solid var(--glass-border)', borderRadius: 'var(--radius-2xl)', padding: '22px', boxShadow: 'var(--shadow-sm)' }}>
      {/* Header */}
      <div className="flex items-center justify-between pb-3" style={{ borderBottom: '1px solid var(--glass-border)' }}>
        <div className="flex items-center gap-2.5">
          <div className="relative"><div className="w-2.5 h-2.5 rounded-full" style={{ background: 'var(--accent-1)' }} /><div className="absolute inset-0 w-2.5 h-2.5 rounded-full animate-ping" style={{ background: 'var(--accent-1)', opacity: 0.4 }} /></div>
          <span className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>Analysis Pipeline</span>
        </div>
        {onCancel && <button onClick={onCancel} className="text-xs px-3 py-1 transition-colors hover:text-red-500 cursor-pointer" style={{ color: 'var(--text-muted)', border: '1px solid var(--glass-border)', borderRadius: 'var(--radius-full)' }}>Cancel</button>}
      </div>

      {/* Phases */}
      <div className="flex flex-col gap-2"><PhaseHeader phase="ingestion" label="1. Data Ingestion" />
        <div className="pl-6 flex flex-col gap-1 ml-2" style={{ borderLeft: '2px solid #eee' }}>
          <ToolStatus prefix="financial" label="FMP Financials" /><ToolStatus prefix="search" label="Tavily Web Search" /><ToolStatus prefix="news" label="News Scan" /><ToolStatus prefix="competitor" label="Competitor Map" /><ToolStatus prefix="industry" label="Industry Trends" />
        </div>
      </div>
      <div className="flex flex-col gap-2"><PhaseHeader phase="cio" label="2. Core Verdict" />
        {getPhaseState("cio") === "active" && <p className="pl-6 text-xs animate-pulse" style={{ color: 'var(--text-muted)' }}>CIO synthesizing investment verdict...</p>}
      </div>
      <div className="flex flex-col gap-2"><PhaseHeader phase="specialists" label="3. Specialist Agents" />
        <div className="pl-6 flex flex-col gap-1 ml-2" style={{ borderLeft: '2px solid #eee' }}>
          <SpecialistStatus label="Financial Analyst" reportKey="financialAnalysis" />
          <SpecialistStatus label="Moat Analyst" reportKey="competitivePosition" />
          <SpecialistStatus label="Sentiment Analyst" reportKey="newsSentiment" />
          <SpecialistStatus label="Risk Analyst" reportKey="riskAssessment" />
          <SpecialistStatus label="Macro Analyst" reportKey="industryOutlook" />
          <SpecialistStatus label="Management Analyst" reportKey="managementAnalysis" />
        </div>
      </div>

      {/* Log */}
      <div className="mt-auto pt-4 flex flex-col gap-2 flex-1 min-h-[130px] max-h-[200px]" style={{ borderTop: '1px solid var(--glass-border)' }}>
        <div className="flex items-center gap-1.5 text-xs uppercase tracking-wider font-medium" style={{ color: 'var(--text-muted)' }}>
          <Terminal size={12} style={{ color: 'var(--accent-1)' }} /> Live Output
        </div>
        <div className="overflow-y-auto flex-1 font-mono text-[10px] leading-relaxed flex flex-col gap-1" style={{ background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', padding: '10px', color: 'var(--text-muted)' }}>
          {statusLog.length === 0 ? <span>Waiting...</span> : statusLog.map((log, idx) => (
            <div key={idx} className="break-all whitespace-pre-wrap">
              <span style={{ color: '#bbb' }}>[{log.time}]</span>{" "}
              <span style={{ color: log.step === "error" ? 'var(--red)' : 'var(--text-secondary)', fontWeight: log.step === "error" ? 700 : 400 }}>{log.message}</span>
            </div>
          ))}
          <div ref={logEndRef} />
        </div>
      </div>
    </div>
  );
}
