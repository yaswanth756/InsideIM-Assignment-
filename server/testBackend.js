/**
 * Backend Test Script — Hits POST /api/research with TSLA
 * Logs ALL SSE events to console + a log file
 * 
 * Usage: node testBackend.js
 */

import "dotenv/config";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOG_FILE = path.join(__dirname, "test_output.log");

// Clear previous log
fs.writeFileSync(LOG_FILE, `=== TSLA Backend Test — ${new Date().toISOString()} ===\n\n`);

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  fs.appendFileSync(LOG_FILE, line + "\n");
}

function logJSON(label, obj) {
  const pretty = JSON.stringify(obj, null, 2);
  log(`${label}:\n${pretty}`);
  fs.appendFileSync(LOG_FILE, "\n");
}

async function main() {
  const SERVER_URL = "http://localhost:8000/api/research";
  const COMPANY = "TSLA";

  log(`🚀 Starting backend test for "${COMPANY}"`);
  log(`→ POST ${SERVER_URL}`);
  log(`→ Log file: ${LOG_FILE}`);
  log("");

  const startTime = Date.now();

  try {
    const res = await fetch(SERVER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ company: COMPANY }),
    });

    log(`HTTP Status: ${res.status} ${res.statusText}`);
    log(`Content-Type: ${res.headers.get("content-type")}`);
    log("");

    if (!res.ok) {
      const text = await res.text();
      log(`❌ Error response: ${text}`);
      return;
    }

    // Read SSE stream
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let eventCount = 0;
    let reportData = null;
    let lastStatusTime = startTime;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Parse SSE events (data: {...}\n\n)
      const lines = buffer.split("\n");
      buffer = lines.pop(); // Keep incomplete line in buffer

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;

        eventCount++;
        const jsonStr = line.slice(6).trim();
        if (!jsonStr) continue;

        try {
          const event = JSON.parse(jsonStr);
          const now = Date.now();
          const elapsed = ((now - startTime) / 1000).toFixed(1);
          const sinceLast = ((now - lastStatusTime) / 1000).toFixed(1);
          lastStatusTime = now;

          if (event.type === "status") {
            log(`📡 Event #${eventCount} [${elapsed}s, +${sinceLast}s] STATUS: [${event.step}] ${event.message}`);
          } else if (event.type === "report") {
            log(`\n${"=".repeat(80)}`);
            log(`📊 Event #${eventCount} [${elapsed}s] REPORT RECEIVED`);
            log(`${"=".repeat(80)}\n`);
            reportData = event.data;
            logJSON("FULL REPORT", reportData);
          } else if (event.type === "done") {
            log(`\n✅ Event #${eventCount} [${elapsed}s] STREAM DONE`);
          } else if (event.type === "error") {
            log(`\n❌ Event #${eventCount} [${elapsed}s] ERROR: ${event.message}`);
          } else {
            log(`❓ Event #${eventCount} [${elapsed}s] UNKNOWN TYPE: ${JSON.stringify(event)}`);
          }
        } catch (parseErr) {
          log(`⚠️ Failed to parse SSE event: ${jsonStr.slice(0, 200)}`);
        }
      }
    }

    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
    log(`\n${"=".repeat(80)}`);
    log(`🏁 TEST COMPLETE — ${totalTime}s total, ${eventCount} events`);
    log(`${"=".repeat(80)}\n`);

    // ── Evaluate the report ──
    if (reportData) {
      log("── REPORT EVALUATION ──\n");

      // Check verdict
      log(`Verdict: ${reportData.verdict || "MISSING ❌"}`);
      log(`Confidence: ${reportData.confidence ?? "MISSING ❌"}%`);
      log(`Time Horizon: ${reportData.timeHorizon || "MISSING ❌"}`);
      log(`Sector: ${reportData.sector || "MISSING ❌"}`);
      log(`Ticker: ${reportData.ticker || "MISSING ❌"}`);
      log(`Company: ${reportData.companyName || "MISSING ❌"}`);
      log("");

      // Check thesis
      log(`Thesis: ${reportData.thesis ? `✅ (${reportData.thesis.length} chars)` : "MISSING ❌"}`);

      // Check sections (using actual supervisor output keys)
      const sections = ["financialAnalysis", "competitivePosition", "newsSentiment", "riskAssessment", "industryOutlook", "managementAnalysis"];
      log("\n── SECTION CHECK ──");
      for (const sec of sections) {
        const data = reportData[sec];
        if (!data) {
          log(`  ${sec}: ❌ MISSING`);
        } else if (typeof data === "object") {
          const keys = Object.keys(data);
          log(`  ${sec}: ✅ (${keys.length} keys: ${keys.join(", ")})`);
        } else {
          log(`  ${sec}: ⚠️ Unexpected type: ${typeof data}`);
        }
      }

      // Check catalysts
      if (reportData.catalysts) {
        log(`\nCatalysts: ✅ (${Array.isArray(reportData.catalysts) ? reportData.catalysts.length + " items" : typeof reportData.catalysts})`);
      } else {
        log(`\nCatalysts: ❌ MISSING`);
      }

      // Check risks
      if (reportData.keyRisks || reportData.risks) {
        const r = reportData.keyRisks || reportData.risks;
        log(`Key Risks: ✅ (${Array.isArray(r) ? r.length + " items" : typeof r})`);
      } else {
        log(`Key Risks: ❌ MISSING`);
      }

      // Check meta
      if (reportData._meta) {
        log(`\n── META ──`);
        logJSON("Meta", reportData._meta);
      }

      // Check for null specialist values
      log("\n── NULL CHECK ──");
      for (const sec of sections) {
        const data = reportData[sec];
        if (data && typeof data === "object") {
          const nullKeys = Object.entries(data).filter(([k, v]) => v === null || v === undefined).map(([k]) => k);
          if (nullKeys.length > 0) {
            log(`  ${sec}: ⚠️ Null values in: ${nullKeys.join(", ")}`);
          }
        }
      }

    } else {
      log("❌ NO REPORT DATA RECEIVED!");
    }

    log(`\n📄 Full log saved to: ${LOG_FILE}`);

  } catch (err) {
    log(`\n💥 FATAL ERROR: ${err.message}`);
    log(err.stack);
  }
}

main();
