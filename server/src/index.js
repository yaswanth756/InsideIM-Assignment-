import "dotenv/config";
import express from "express";
import cors from "cors";
import researchRouter from "./routes/research.js";

const app = express();
const PORT = process.env.PORT || 8000;

const ALLOWED_ORIGINS = process.env.CLIENT_URL
  ? process.env.CLIENT_URL.split(",").map(u => u.trim())
  : [];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (ALLOWED_ORIGINS.length > 0) {
      const isAllowed = ALLOWED_ORIGINS.includes(origin) || 
                        ALLOWED_ORIGINS.includes("*") || 
                        origin.startsWith("http://localhost:");
      return callback(null, isAllowed);
    }
    return callback(null, true);
  },
  credentials: true
}));
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.use("/api/research", researchRouter);

app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

app.use((err, _req, res, _next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal server error" });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});
