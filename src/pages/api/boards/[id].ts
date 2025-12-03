// =============================================================================
// Board API - Single Board Operations
// =============================================================================
// GET /api/boards/:id - Get board details
// PATCH /api/boards/:id - Update board metadata
// DELETE /api/boards/:id - Delete board
// =============================================================================

import type { NextApiResponse } from "next";
import { z } from "zod";
import {
  withAuth,
  type AuthenticatedRequest,
} from "@/server/middleware/withAuth";
import { rateLimiters } from "@/server/middleware/ratelimit";
import {
  getBoardWithLatestVersion,
  updateBoard,
  deleteBoard,
  archiveBoard,
} from "@/server/services/boards.service";
import {
  canViewBoard,
  canEditBoard,
  canDeleteBoard,
} from "@/server/services/access.service";
import { logAuditEvent } from "@/server/services/audit.service";

const updateBoardSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).optional(),
  tags: z.array(z.string()).optional(),
  isArchived: z.boolean().optional(),
});

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  const { method, query } = req;
  const boardId = query.id as string;

  if (!boardId || typeof boardId !== "string") {
    return res.status(400).json({
      error: "Bad Request",
      message: "Board ID is required",
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

        const board = await getBoardWithLatestVersion(boardId);
        if (!board) {
          return res.status(404).json({
            error: "Not Found",
            message: "Board not found.",
          });
        }

        // Log view event
        await logAuditEvent({
          orgId: board.orgId,
          actorId: req.user.id,
          action: "board.view",
          targetType: "board",
          targetId: boardId,
          req,
        });

        return res.status(200).json(board);
      }

      case "PATCH": {
        // Check edit permission
        const canEdit = await canEditBoard(req.user.id, boardId);
        if (!canEdit) {
          return res.status(403).json({
            error: "Forbidden",
            message: "You do not have permission to edit this board.",
          });
        }

        const parsed = updateBoardSchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({
            error: "Bad Request",
            details: parsed.error.issues,
          });
        }

        const board = await updateBoard(boardId, req.user.id, parsed.data, req);
        return res.status(200).json(board);
      }

      case "DELETE": {
        // Check delete permission
        const canDel = await canDeleteBoard(req.user.id, boardId);
        if (!canDel) {
          return res.status(403).json({
            error: "Forbidden",
            message: "You do not have permission to delete this board.",
          });
        }

        // Check for ?archive=true query param for soft delete
        if (query.archive === "true") {
          const board = await archiveBoard(boardId, req.user.id, req);
          return res.status(200).json(board);
        }

        await deleteBoard(boardId, req.user.id, req);
        return res.status(204).end();
      }

      default:
        res.setHeader("Allow", ["GET", "PATCH", "DELETE"]);
        return res.status(405).json({ error: `Method ${method} Not Allowed` });
    }
  } catch (error) {
    console.error("[API] Board error:", error);
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
