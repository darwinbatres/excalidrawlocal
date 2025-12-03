// =============================================================================
// Boards API - List and Create
// =============================================================================
// GET /api/boards - List boards in an organization
// POST /api/boards - Create a new board
// =============================================================================

import type { NextApiResponse } from "next";
import { z } from "zod";
import {
  withAuth,
  type AuthenticatedRequest,
} from "@/server/middleware/withAuth";
import { rateLimiters } from "@/server/middleware/ratelimit";
import { createBoard, searchBoards } from "@/server/services/boards.service";
import { hasOrgRole } from "@/server/services/access.service";

const createBoardSchema = z.object({
  orgId: z.string().min(1),
  title: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  tags: z.array(z.string()).optional(),
  sceneJson: z
    .unknown()
    .optional()
    .default({ type: "excalidraw", elements: [], appState: {} }),
});

const listBoardsSchema = z.object({
  orgId: z.string().min(1),
  query: z.string().optional(),
  tags: z.string().optional(), // comma-separated
  archived: z.enum(["true", "false"]).optional(),
  limit: z.string().optional(),
  offset: z.string().optional(),
});

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  const { method } = req;

  try {
    switch (method) {
      case "GET": {
        const parsed = listBoardsSchema.safeParse(req.query);
        if (!parsed.success) {
          return res.status(400).json({
            error: "Bad Request",
            details: parsed.error.issues,
          });
        }

        const { orgId, query, tags, archived, limit, offset } = parsed.data;

        // Check org access
        const hasAccess = await hasOrgRole(req.user.id, orgId, "VIEWER");
        if (!hasAccess) {
          return res.status(403).json({
            error: "Forbidden",
            message: "You do not have access to this organization.",
          });
        }

        const result = await searchBoards(orgId, {
          query,
          tags: tags ? tags.split(",").filter(Boolean) : undefined,
          isArchived: archived === "true",
          limit: limit ? parseInt(limit, 10) : 20,
          offset: offset ? parseInt(offset, 10) : 0,
        });

        return res.status(200).json(result);
      }

      case "POST": {
        const parsed = createBoardSchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({
            error: "Bad Request",
            details: parsed.error.issues,
          });
        }

        const { orgId, title, description, tags, sceneJson } = parsed.data;

        // Check org access - need at least MEMBER role to create boards
        const hasAccess = await hasOrgRole(req.user.id, orgId, "MEMBER");
        if (!hasAccess) {
          return res.status(403).json({
            error: "Forbidden",
            message:
              "You do not have permission to create boards in this organization.",
          });
        }

        const board = await createBoard(
          {
            orgId,
            ownerId: req.user.id,
            title,
            description,
            tags,
            sceneJson,
          },
          req
        );

        return res.status(201).json(board);
      }

      default:
        res.setHeader("Allow", ["GET", "POST"]);
        return res.status(405).json({ error: `Method ${method} Not Allowed` });
    }
  } catch (error) {
    console.error("[API] Boards error:", error);
    // Don't leak internal error details in production
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
