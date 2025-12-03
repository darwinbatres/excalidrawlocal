// =============================================================================
// Organization Storage API - Calculate total storage for a workspace
// =============================================================================
// GET /api/orgs/[id]/storage - Get storage summary for all boards in workspace
// =============================================================================

import type { NextApiResponse } from "next";
import {
  withAuth,
  type AuthenticatedRequest,
} from "@/server/middleware/withAuth";
import { prisma } from "@/server/db/prisma";

export interface WorkspaceStorage {
  /** Total bytes used by all boards */
  totalBytes: number;
  /** Human-readable total size */
  totalFormatted: string;
  /** Number of boards */
  boardCount: number;
  /** Storage breakdown */
  breakdown: {
    sceneData: number;
    appState: number;
    thumbnails: number;
    versionHistory: number;
  };
  /** Total versions across all boards */
  totalVersions: number;
}

/**
 * Format bytes to human-readable string
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Calculate byte size of a JSON value
 */
function getJsonSize(value: unknown): number {
  if (value === null || value === undefined) return 0;
  return new TextEncoder().encode(JSON.stringify(value)).length;
}

/**
 * Calculate byte size of a string
 */
function getStringSize(value: string | null | undefined): number {
  if (!value) return 0;
  return new TextEncoder().encode(value).length;
}

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  const orgId = req.query.id as string;

  try {
    // Verify user is a member of this org
    const membership = await prisma.membership.findUnique({
      where: {
        orgId_userId: {
          orgId,
          userId: req.user.id,
        },
      },
    });

    if (!membership) {
      return res.status(404).json({ error: "Organization not found" });
    }

    // Parse archived filter from query (defaults to false)
    const showArchived = req.query.archived === "true";

    // Get boards filtered by archived status
    const boards = await prisma.board.findMany({
      where: { orgId, isArchived: showArchived },
      select: {
        id: true,
        thumbnail: true,
      },
    });

    // Get board IDs for filtering versions
    const boardIds = boards.map((b) => b.id);

    // Get all versions for non-archived boards in this org
    const versions = await prisma.boardVersion.findMany({
      where: {
        boardId: { in: boardIds },
      },
      select: {
        boardId: true,
        version: true,
        sceneJson: true,
        appStateJson: true,
      },
      orderBy: [{ boardId: "asc" }, { version: "desc" }],
    });

    // Calculate totals
    let totalSceneData = 0;
    let totalAppState = 0;
    let totalThumbnails = 0;
    let totalVersionHistory = 0;

    // Group versions by board to find current version
    const versionsByBoard = new Map<string, typeof versions>();
    for (const version of versions) {
      if (!versionsByBoard.has(version.boardId)) {
        versionsByBoard.set(version.boardId, []);
      }
      versionsByBoard.get(version.boardId)!.push(version);
    }

    // Calculate scene data from current versions only
    for (const [, boardVersions] of versionsByBoard) {
      if (boardVersions.length > 0) {
        // First version is current (sorted desc)
        totalSceneData += getJsonSize(boardVersions[0].sceneJson);
        totalAppState += getJsonSize(boardVersions[0].appStateJson);
      }

      // All versions for history total
      for (const version of boardVersions) {
        totalVersionHistory += getJsonSize(version.sceneJson);
        totalVersionHistory += getJsonSize(version.appStateJson);
      }
    }

    // Thumbnails
    for (const board of boards) {
      totalThumbnails += getStringSize(board.thumbnail);
    }

    const totalBytes = totalSceneData + totalAppState + totalThumbnails;

    const response: WorkspaceStorage = {
      totalBytes,
      totalFormatted: formatBytes(totalBytes),
      boardCount: boards.length,
      breakdown: {
        sceneData: totalSceneData,
        appState: totalAppState,
        thumbnails: totalThumbnails,
        versionHistory: totalVersionHistory,
      },
      totalVersions: versions.length,
    };

    // No cache - always fresh data
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json(response);
  } catch (error) {
    console.error("[API /api/orgs/[id]/storage]", error);
    return res.status(500).json({
      error: "Internal Server Error",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

export default withAuth(handler);
