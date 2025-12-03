// =============================================================================
// Board Version API - Get/Restore specific version
// =============================================================================
// GET /api/boards/:id/versions/:version - Get a specific version
// POST /api/boards/:id/versions/:version - Restore this version
// =============================================================================

import type { NextApiResponse } from "next";
import {
  withAuth,
  type AuthenticatedRequest,
} from "@/server/middleware/withAuth";
import { rateLimiters } from "@/server/middleware/ratelimit";
import {
  getBoardVersion,
  restoreVersion,
} from "@/server/services/boards.service";
import { canViewBoard, canEditBoard } from "@/server/services/access.service";

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  const { method, query } = req;
  const boardId = query.id as string;
  const versionNum = parseInt(query.version as string, 10);

  if (!boardId || typeof boardId !== "string") {
    return res.status(400).json({
      error: "Bad Request",
      message: "Board ID is required",
    });
  }

  if (isNaN(versionNum) || versionNum < 1) {
    return res.status(400).json({
      error: "Bad Request",
      message: "Valid version number is required",
    });
  }

  try {
    switch (method) {
      case "GET": {
        // Check view permission
        const canView = await canViewBoard(req.user.id, boardId);
        if (!canView) {
          return res.status(404).json({
            error: "Not Found",
            message: "Board not found or you do not have access.",
          });
        }

        const version = await getBoardVersion(boardId, versionNum);
        if (!version) {
          return res.status(404).json({
            error: "Not Found",
            message: "Version not found.",
          });
        }

        return res.status(200).json(version);
      }

      case "POST": {
        // Restore version - requires edit permission
        const canEdit = await canEditBoard(req.user.id, boardId);
        if (!canEdit) {
          return res.status(403).json({
            error: "Forbidden",
            message: "You do not have permission to edit this board.",
          });
        }

        const result = await restoreVersion(
          boardId,
          versionNum,
          req.user.id,
          req
        );

        if (result.conflict) {
          return res.status(409).json({
            error: "Conflict",
            message:
              "The board has been modified. Please refresh and try again.",
            currentEtag: result.currentEtag,
          });
        }

        return res.status(200).json({
          message: `Board restored to version ${versionNum}`,
          version: result.version,
          etag: result.etag,
        });
      }

      default:
        res.setHeader("Allow", ["GET", "POST"]);
        return res.status(405).json({ error: `Method ${method} Not Allowed` });
    }
  } catch (error) {
    console.error("[API] Version error:", error);
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
