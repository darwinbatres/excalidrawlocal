// =============================================================================
// Board Save API - Save new version
// =============================================================================
// POST /api/boards/:id/save - Save a new version of the board
// =============================================================================

import type { NextApiResponse } from "next";
import { z } from "zod";
import {
  withAuth,
  type AuthenticatedRequest,
} from "@/server/middleware/withAuth";
import { rateLimiters } from "@/server/middleware/ratelimit";
import { saveVersion } from "@/server/services/boards.service";
import { canEditBoard } from "@/server/services/access.service";

// Increase body size limit for image-heavy boards (default is 1MB)
// Images are stored as base64 in sceneJson, so we need more headroom
export const config = {
  api: {
    bodyParser: {
      sizeLimit: "16mb",
    },
  },
};

const saveVersionSchema = z.object({
  sceneJson: z.unknown(),
  appStateJson: z.unknown().optional(),
  label: z.string().max(255).optional(),
  expectedEtag: z.string().optional(),
  thumbnail: z.string().optional(), // Base64 data URL for preview
});

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
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
    // Check edit permission
    const canEdit = await canEditBoard(req.user.id, boardId);
    if (!canEdit) {
      return res.status(403).json({
        error: "Forbidden",
        message: "You do not have permission to edit this board.",
      });
    }

    const parsed = saveVersionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: "Bad Request",
        details: parsed.error.issues,
      });
    }

    const { sceneJson, appStateJson, label, expectedEtag, thumbnail } =
      parsed.data;

    const result = await saveVersion(
      {
        boardId,
        userId: req.user.id,
        sceneJson,
        appStateJson,
        label,
        expectedEtag,
        thumbnail,
      },
      req
    );

    // Handle optimistic locking conflict
    if (result.conflict) {
      return res.status(409).json({
        error: "Conflict",
        message:
          "The board has been modified by another user. Please refresh and try again.",
        currentEtag: result.currentEtag,
      });
    }

    return res.status(200).json({
      version: result.version,
      etag: result.etag,
    });
  } catch (error) {
    console.error("[API] Save error:", error);
    return res.status(500).json({
      error: "Internal Server Error",
      message:
        process.env.NODE_ENV === "development" && error instanceof Error
          ? error.message
          : "An unexpected error occurred. Please try again.",
    });
  }
}

export default rateLimiters.write(withAuth(handler));
