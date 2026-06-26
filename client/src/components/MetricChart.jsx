"use client";

import { useState, useEffect } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Line, ComposedChart, Cell, ReferenceLine } from "recharts";

const formatMillions = (val) => {
  if (val === undefined || val === null || isNaN(val)) return "N/A";
  const num = Number(val);
  if (Math.abs(num) >= 1000) return `$${(num / 1000).toFixed(1)}B`;
  return `$${num.toFixed(0)}M`;
};

const CustomTooltip = ({ active, payload, label, formatter }) => {
  if (active && payload?.length) {
    return (
      <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: '12px', padding: '10px 14px', boxShadow: '0 4px 16px rgba(0,0,0,0.1)' }}>
        <p className="font-mono text-xs font-semibold pb-1 mb-1" style={{ color: '#5f6368', borderBottom: '1px solid #f0f0f0' }}>{label}</p>
        {payload.map((item, idx) => (
          <div key={idx} className="flex justify-between items-center gap-6 py-0.5 text-xs font-mono">
            <span style={{ color: item.color || item.fill }}>{item.name}:</span>
            <span className="font-bold" style={{ color: '#1f1f1f' }}>{formatter ? formatter(item.value, item.name) : item.value}</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export default function MetricChart({ type, data }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  if (!mounted) return <div className="h-48 w-full animate-shimmer" style={{ background: '#f8f9fa', borderRadius: '12px', border: '1px solid #e0e0e0' }} />;
  if (!data || data.length === 0) return (
    <div className="h-48 w-full flex items-center justify-center font-mono text-sm" style={{ border: '1px solid #e0e0e0', background: '#f8f9fa', borderRadius: '12px', color: '#9aa0a6' }}>
      No chart data available
    </div>
  );

  const containerStyle = { background: '#fafbfc', borderRadius: '12px', border: '1px solid #eee', padding: '12px 4px 4px 4px' };
  const gridColor = "#f0f0f0";
  const axisColor = "#9aa0a6";

  if (type === "revenue") {
    return (
      <div className="h-56 w-full" style={containerStyle}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 10, right: -5, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
            <XAxis dataKey="year" stroke={axisColor} fontSize={11} tickLine={false} />
            <YAxis yAxisId="left" stroke={axisColor} fontSize={11} tickFormatter={formatMillions} tickLine={false} />
            <YAxis yAxisId="right" orientation="right" stroke={axisColor} fontSize={11} tickFormatter={(v) => `${v}%`} tickLine={false} />
            <Tooltip content={<CustomTooltip formatter={(val, name) => name === "Growth %" ? `${val}%` : formatMillions(val)} />} />
            <Bar yAxisId="left" dataKey="revenue" name="Revenue" fill="#1a73e8" radius={[4, 4, 0, 0]} barSize={28} />
            <Line yAxisId="right" type="monotone" dataKey="margin" name="Growth %" stroke="#ea4335" strokeWidth={2} dot={{ r: 3, stroke: "#fff", strokeWidth: 2, fill: "#ea4335" }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    );
  }

  if (type === "cashflow") {
    return (
      <div className="h-56 w-full" style={containerStyle}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: -5, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
            <XAxis dataKey="year" stroke={axisColor} fontSize={11} tickLine={false} />
            <YAxis stroke={axisColor} fontSize={11} tickFormatter={formatMillions} tickLine={false} />
            <Tooltip content={<CustomTooltip formatter={formatMillions} />} />
            <ReferenceLine y={0} stroke="#ddd" strokeWidth={1} />
            <Bar dataKey="fcf" name="Free Cash Flow" barSize={28}>
              {data.map((entry, index) => <Cell key={index} fill={Number(entry.fcf) >= 0 ? "#1e8e3e" : "#d93025"} radius={Number(entry.fcf) >= 0 ? [4, 4, 0, 0] : [0, 0, 4, 4]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }

  if (type === "moat") {
    const colors = ["#4285f4", "#1a73e8", "#1967d2", "#185abc", "#174ea6"];
    return (
      <div className="h-52 w-full" style={containerStyle}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 5, right: 15, left: 15, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} horizontal={false} />
            <XAxis type="number" domain={[0, 5]} stroke={axisColor} fontSize={10} tickLine={false} />
            <YAxis dataKey="source" type="category" stroke={axisColor} fontSize={10} width={80} tickLine={false} />
            <Tooltip content={<CustomTooltip formatter={(val) => `${val} / 5`} />} />
            <Bar dataKey="score" name="Moat Strength" fill="#4285f4" radius={[0, 4, 4, 0]} barSize={14}>
              {data.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }

  return null;
}
