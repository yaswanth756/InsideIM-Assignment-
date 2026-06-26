import "dotenv/config";
import express from "express";
import cors from "cors";
import researchRouter from "./routes/research.js";

const app = express();
const PORT = process.env.PORT || 8000;
const allowedOrigins = [
    process.env.CLIENT_URL|| "https://inside-iim-assignment.vercel.app"
    // Add your production domains here
];

app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (mobile apps, Postman, etc.)
        if (!origin) return callback(null, true);

        if (allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            // In production, you might want to log this
            console.warn(`CORS blocked origin: ${origin}`);
            callback(null, true); // For now, allow - change to callback(new Error('Not allowed by CORS')) in strict mode
        }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    maxAge: 86400 // Cache preflight for 24 hours
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
