"use client";

import { useEffect, useRef, useState } from "react";
import { Search, ArrowRight } from "lucide-react";

export default function SearchBar({ onSearch, isLoading, initialValue = "" }) {
  const [query, setQuery] = useState(initialValue);
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => { if (initialValue) setQuery(initialValue); }, [initialValue]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); inputRef.current?.focus(); inputRef.current?.select(); }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleSubmit = (e) => { e.preventDefault(); if (!query.trim() || isLoading) return; onSearch(query.trim()); };

  const suggestions = [
    { label: "Tesla", ticker: "TSLA" },
    { label: "Apple", ticker: "AAPL" },
    { label: "Nvidia", ticker: "NVDA" },
    { label: "Microsoft", ticker: "MSFT" },
    { label: "Google", ticker: "GOOGL" },
  ];

  return (
    <div className="w-full max-w-2xl mx-auto">
      <form onSubmit={handleSubmit}>
        <div
          className="relative flex items-center transition-all duration-300"
          style={{
            borderRadius: 'var(--radius-full)',
            background: '#fff',
            border: isFocused ? '2px solid var(--accent-1)' : '1px solid var(--glass-border)',
            boxShadow: isFocused ? 'var(--shadow-glow-blue)' : 'var(--shadow-md)',
          }}
        >
          <div className="pl-5" style={{ color: isFocused ? 'var(--accent-1)' : 'var(--text-muted)' }}>
            {isLoading ? (
              <div className="w-5 h-5 rounded-full animate-spin-slow" style={{ border: '2px solid rgba(26,115,232,0.2)', borderTopColor: 'var(--accent-1)' }} />
            ) : (
              <Search size={20} />
            )}
          </div>

          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder="Research any company..."
            className="w-full py-4 px-4 bg-transparent text-lg focus:outline-none"
            style={{ color: 'var(--text-primary)' }}
            disabled={isLoading}
            autoComplete="off"
          />

          <div className="flex items-center gap-2 pr-3">
            <kbd className="hidden sm:inline-flex items-center gap-0.5 px-2 py-1 text-[10px] font-medium select-none" style={{ color: 'var(--text-muted)', background: 'var(--bg-secondary)', border: '1px solid var(--glass-border)', borderRadius: '6px' }}>
              <span>⌘</span>K
            </kbd>
            <button
              type="submit"
              disabled={isLoading || !query.trim()}
              className="flex items-center justify-center w-10 h-10 transition-all duration-200 disabled:cursor-not-allowed"
              style={{
                borderRadius: '12px',
                background: !isLoading && query.trim() ? 'var(--accent-1)' : 'var(--bg-secondary)',
                color: !isLoading && query.trim() ? '#fff' : 'var(--text-muted)',
              }}
            >
              <ArrowRight size={18} />
            </button>
          </div>
        </div>
      </form>

      {!isLoading && !initialValue && (
        <div className="flex flex-wrap items-center justify-center gap-2.5 mt-5">
          <span className="text-xs font-medium mr-1" style={{ color: 'var(--text-muted)' }}>Try:</span>
          {suggestions.map((s) => (
            <button key={s.ticker} type="button" onClick={() => { setQuery(s.ticker); onSearch(s.ticker); }} className="pill">
              {s.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
