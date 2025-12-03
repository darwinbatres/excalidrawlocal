// =============================================================================
// Audit Logs API
// =============================================================================
// GET /api/audit - Get audit logs for an organization
// =============================================================================

import type { NextApiResponse } from "next";
import { z } from "zod";
import {
  withAuth,
  type AuthenticatedRequest,
} from "@/server/middleware/withAuth";
import { rateLimiters } from "@/server/middleware/ratelimit";
import { hasOrgRole } from "@/server/services/access.service";
import { getAuditLogs, getAuditStats } from "@/server/services/audit.service";

const querySchema = z.object({
  orgId: z.string().min(1),
  actorId: z.string().optional(),
  action: z.string().optional(),
  targetType: z.string().optional(),
  targetId: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  limit: z.string().optional(),
  offset: z.string().optional(),
  stats: z.enum(["true", "false"]).optional(),
  statsDays: z.string().optional(),
});

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  try {
    const parsed = querySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({
        error: "Bad Request",
        details: parsed.error.issues,
      });
    }

    const {
      orgId,
      actorId,
      action,
      targetType,
      targetId,
      startDate,
      endDate,
      limit,
      offset,
      stats,
      statsDays,
    } = parsed.data;

    // Only admins can view audit logs
    const isAdmin = await hasOrgRole(req.user.id, orgId, "ADMIN");
    if (!isAdmin) {
      return res.status(403).json({
        error: "Forbidden",
        message: "You must be an admin to view audit logs.",
      });
    }

    // If stats requested, return stats instead
    if (stats === "true") {
      const auditStats = await getAuditStats(
        orgId,
        statsDays ? parseInt(statsDays, 10) : 30
      );
      return res.status(200).json(auditStats);
    }

    const result = await getAuditLogs({
      orgId,
      actorId,
      action,
      targetType: targetType as
        | "board"
        | "board_version"
        | "organization"
        | "membership"
        | "user"
        | "board_permission"
        | undefined,
      targetId,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      limit: limit ? parseInt(limit, 10) : 50,
      offset: offset ? parseInt(offset, 10) : 0,
    });

    return res.status(200).json(result);
  } catch (error) {
    console.error("[API] Audit error:", error);
    return res.status(500).json({
      error: "Internal Server Error",
      message:
        process.env.NODE_ENV === "development" && error instanceof Error
          ? error.message
          : "An unexpected error occurred. Please try again.",
    });
  }
}

export default rateLimiters.api(withAuth(handler));
