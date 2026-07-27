import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import { prisma } from "./lib/prisma";
import authRoutes from "./routes/auth";
import publicTrackingRoutes from "./routes/publicTracking";
import adminRoutes from "./routes/admin";

const app = express();
const port = Number(process.env.PORT || 3000);
const frontendUrl = process.env.FRONTEND_URL || "*";

app.use(helmet());
app.use(compression());
app.use(
  cors({
    origin: frontendUrl === "*" ? true : frontendUrl,
    credentials: true
  })
);
app.use(express.json({ limit: "1mb" }));

app.get("/health", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      ok: true,
      service: "royale-international-backend",
      database: "connected"
    });
  } catch {
    res.status(503).json({
      ok: false,
      service: "royale-international-backend",
      database: "unavailable"
    });
  }
});

app.use("/api/auth", authRoutes);
app.use("/api/shipments", publicTrackingRoutes);
app.use("/api/admin", adminRoutes);

app.use((_req, res) => {
  res.status(404).json({ error: "Route not found" });
});

app.listen(port, "0.0.0.0", () => {
  console.log(`Royale International backend listening on port ${port}`);
});

process.on("SIGTERM", async () => {
  await prisma.$disconnect();
  process.exit(0);
});