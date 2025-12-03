// =============================================================================
// Health Check API
// =============================================================================
// GET /api/health - Health check endpoint for Docker and load balancers
// =============================================================================

import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/server/db/prisma";

interface HealthStatus {
  status: "healthy" | "unhealthy";
  timestamp: string;
  uptime: number;
  version: string;
  checks: {
    database: "ok" | "error";
    memory: {
      used: number;
      total: number;
      percentage: number;
    };
  };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<HealthStatus | { error: string }>
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  let databaseStatus: "ok" | "error" = "ok";

  // Check database connection
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (error) {
    console.error("[Health] Database check failed:", error);
    databaseStatus = "error";
  }

  // Get memory usage
  const memoryUsage = process.memoryUsage();
  const memoryMB = {
    used: Math.round(memoryUsage.heapUsed / 1024 / 1024),
    total: Math.round(memoryUsage.heapTotal / 1024 / 1024),
  };

  const status: HealthStatus = {
    status: databaseStatus === "ok" ? "healthy" : "unhealthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || "0.1.0",
    checks: {
      database: databaseStatus,
      memory: {
        used: memoryMB.used,
        total: memoryMB.total,
        percentage: Math.round((memoryMB.used / memoryMB.total) * 100),
      },
    },
  };

  // Return 503 if unhealthy
  const statusCode = status.status === "healthy" ? 200 : 503;
  return res.status(statusCode).json(status);
}
