// =============================================================================
// Board Versions API
// =============================================================================
// GET /api/boards/:id/versions - List version history
// =============================================================================

import type { NextApiResponse } from "next";
import { z } from "zod";
import {
  withAuth,
  type AuthenticatedRequest,
} from "@/server/middleware/withAuth";
import { rateLimiters } from "@/server/middleware/ratelimit";
import { getBoardVersions } from "@/server/services/boards.service";
import { canViewBoard } from "@/server/services/access.service";

const querySchema = z.object({
  limit: z.string().optional(),
  offset: z.string().optional(),
});

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  const boardId = req.query.id as string;

  if (!boardId || typeof boardId !== "string") {
    return res.status(400).json({
      error: "Bad Request",
      message: "Board ID is required",
    });
  }

  try {
    // Check view permission
    const canView = await canViewBoard(req.user.id, boardId);
    if (!canView) {
      return res.status(404).json({
        error: "Not Found",
        message: "Board not found or you do not have access.",
      });
    }

    const parsed = querySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({
        error: "Bad Request",
        details: parsed.error.issues,
      });
    }

    const { limit, offset } = parsed.data;

    const result = await getBoardVersions(boardId, {
      limit: limit ? parseInt(limit, 10) : 20,
      offset: offset ? parseInt(offset, 10) : 0,
    });

    return res.status(200).json(result);
  } catch (error) {
    console.error("[API] Versions error:", error);
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
