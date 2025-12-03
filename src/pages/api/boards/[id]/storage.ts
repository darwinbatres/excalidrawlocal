// =============================================================================
// Board Storage API - Calculate storage used by a board
// =============================================================================
// GET /api/boards/[id]/storage - Get storage breakdown for a board
// =============================================================================

import type { NextApiResponse } from "next";
import {
  withAuth,
  type AuthenticatedRequest,
} from "@/server/middleware/withAuth";
import { prisma } from "@/server/db/prisma";

export interface StorageBreakdown {
  /** Total bytes used by this board */
  totalBytes: number;
  /** Human-readable total size */
  totalFormatted: string;
  /** Breakdown by category */
  breakdown: {
    /** Current scene data (elements only, without embedded files) */
    sceneData: number;
    /** Embedded files (images as base64) */
    embeddedFiles: number;
    /** App state */
    appState: number;
    /** Thumbnail preview */
    thumbnail: number;
    /** Version history (all versions combined) */
    versionHistory: number;
  };
  /** Number of versions stored */
  versionCount: number;
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
 * Calculate byte size of a string (including base64 data URLs)
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

  const boardId = req.query.id as string;

  try {
    // Verify user has access to this board
    const board = await prisma.board.findFirst({
      where: {
        id: boardId,
        org: {
          memberships: {
            some: { userId: req.user.id },
          },
        },
      },
      select: {
        id: true,
        thumbnail: true,
      },
    });

    if (!board) {
      return res.status(404).json({ error: "Board not found" });
    }

    // Get all versions for this board
    const versions = await prisma.boardVersion.findMany({
      where: { boardId },
      select: {
        sceneJson: true,
        appStateJson: true,
      },
      orderBy: { version: "desc" },
    });

    // Calculate storage breakdown
    let sceneDataSize = 0;
    let appStateSize = 0;
    let versionHistorySize = 0;
    let embeddedFilesSize = 0;

    // Current version (first one, most recent)
    if (versions.length > 0) {
      const currentScene = versions[0].sceneJson as {
        elements?: unknown;
        files?: Record<string, unknown>;
      } | null;

      // Calculate embedded files separately (these are base64 images)
      if (currentScene?.files) {
        embeddedFilesSize = getJsonSize(currentScene.files);
      }

      // Scene data is the full JSON including files
      sceneDataSize = getJsonSize(versions[0].sceneJson);
      appStateSize = getJsonSize(versions[0].appStateJson);
    }

    // Version history (all versions including current)
    for (const version of versions) {
      versionHistorySize += getJsonSize(version.sceneJson);
      versionHistorySize += getJsonSize(version.appStateJson);
    }

    const thumbnailSize = getStringSize(board.thumbnail);

    // Total is current scene + thumbnail
    const totalBytes = sceneDataSize + appStateSize + thumbnailSize;

    const response: StorageBreakdown = {
      totalBytes,
      totalFormatted: formatBytes(totalBytes),
      breakdown: {
        sceneData: sceneDataSize - embeddedFilesSize, // Elements only
        embeddedFiles: embeddedFilesSize, // Images/files
        appState: appStateSize,
        thumbnail: thumbnailSize,
        versionHistory: versionHistorySize,
      },
      versionCount: versions.length,
    };

    // No cache - always fresh data
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json(response);
  } catch (error) {
    console.error("[API /api/boards/[id]/storage]", error);
    return res.status(500).json({
      error: "Internal Server Error",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

export default withAuth(handler);
