import "dotenv/config";
import { runResearch } from "./src/lib/agent.js";

async function main() {
  console.log("Starting backend agent test run for TSLA using GEMINI...");
  try {
    const report = await runResearch("TSLA", (stepData) => {
      console.log(`[STREAMING STEP] -> Type: ${stepData.type} | Step: ${stepData.step || "N/A"} | Message: ${stepData.message || "N/A"}`);
    });
    console.log("\n=== TEST COMPLETED SUCCESSFULLY ===");
    console.log("Verdict:", report.verdict);
    console.log("Confidence:", report.confidence);
    console.log("Financial Valuation Assessment:", report.financialAnalysis?.valuationAssessment);
    console.log("Moat Rating:", report.competitivePosition?.moatRating);
    console.log("Risk level:", report.riskAssessment?.overallRiskLevel);
    console.log("Primary concern:", report.riskAssessment?.biggestConcern);
    console.log("Overview preview:", report.companyOverview?.slice(0, 150) + "...");
    console.log("Meta data:", JSON.stringify(report._meta, null, 2));
  } catch (err) {
    console.error("\n*** TEST RUN FAILED ***");
    console.error(err);
  }
}

main();
