// =============================================================================
// Board Cleanup API - Remove unused embedded files from a board
// =============================================================================
// POST /api/boards/[id]/cleanup - Clean up orphaned files and optimize storage
// =============================================================================

import type { NextApiResponse } from "next";
import {
  withAuth,
  type AuthenticatedRequest,
} from "@/server/middleware/withAuth";
import { prisma } from "@/server/db/prisma";

interface CleanupResult {
  /** Whether cleanup was performed */
  cleaned: boolean;
  /** Bytes freed */
  bytesFreed: number;
  /** Human-readable bytes freed */
  bytesFreedFormatted: string;
  /** Number of orphaned files removed */
  filesRemoved: number;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
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
      select: { id: true },
    });

    if (!board) {
      return res.status(404).json({ error: "Board not found" });
    }

    // Get the latest version
    const latestVersion = await prisma.boardVersion.findFirst({
      where: { boardId },
      orderBy: { version: "desc" },
      select: {
        id: true,
        version: true,
        sceneJson: true,
        appStateJson: true,
      },
    });

    if (!latestVersion) {
      return res.status(200).json({
        cleaned: false,
        bytesFreed: 0,
        bytesFreedFormatted: "0 B",
        filesRemoved: 0,
      } as CleanupResult);
    }

    const scene = latestVersion.sceneJson as {
      elements?: Array<{ type: string; fileId?: string }>;
      files?: Record<string, unknown>;
    } | null;

    if (!scene?.files || Object.keys(scene.files).length === 0) {
      return res.status(200).json({
        cleaned: false,
        bytesFreed: 0,
        bytesFreedFormatted: "0 B",
        filesRemoved: 0,
      } as CleanupResult);
    }

    // Find all file IDs that are actually used by elements
    const usedFileIds = new Set<string>();
    if (scene.elements) {
      for (const element of scene.elements) {
        if (element.type === "image" && element.fileId) {
          usedFileIds.add(element.fileId);
        }
      }
    }

    // Find orphaned files
    const allFileIds = Object.keys(scene.files);
    const orphanedFileIds = allFileIds.filter((id) => !usedFileIds.has(id));

    if (orphanedFileIds.length === 0) {
      return res.status(200).json({
        cleaned: false,
        bytesFreed: 0,
        bytesFreedFormatted: "0 B",
        filesRemoved: 0,
      } as CleanupResult);
    }

    // Calculate bytes that will be freed
    let bytesFreed = 0;
    for (const fileId of orphanedFileIds) {
      const fileData = scene.files[fileId];
      bytesFreed += new TextEncoder().encode(JSON.stringify(fileData)).length;
    }

    // Create cleaned scene - keep only used files
    const cleanedFiles: { [key: string]: unknown } = {};
    for (const fileId of allFileIds) {
      if (usedFileIds.has(fileId)) {
        cleanedFiles[fileId] = scene.files[fileId];
      }
    }

    // Build cleaned scene as a plain object for Prisma JSON compatibility
    const cleanedScene = JSON.parse(
      JSON.stringify({
        ...scene,
        files: cleanedFiles,
      })
    );

    // Create a new version with cleaned data
    const newVersion = await prisma.boardVersion.create({
      data: {
        boardId,
        version: latestVersion.version + 1,
        sceneJson: cleanedScene,
        appStateJson: latestVersion.appStateJson ?? undefined,
        createdById: req.user.id,
      },
    });

    // Update board's updatedAt
    await prisma.board.update({
      where: { id: boardId },
      data: { updatedAt: new Date() },
    });

    console.log(
      `[Cleanup] Board ${boardId}: removed ${
        orphanedFileIds.length
      } orphaned files, freed ${formatBytes(bytesFreed)}`
    );

    return res.status(200).json({
      cleaned: true,
      bytesFreed,
      bytesFreedFormatted: formatBytes(bytesFreed),
      filesRemoved: orphanedFileIds.length,
      newVersion: newVersion.version,
    } as CleanupResult & { newVersion: number });
  } catch (error) {
    console.error("[API /api/boards/[id]/cleanup]", error);
    return res.status(500).json({
      error: "Internal Server Error",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

export default withAuth(handler);
