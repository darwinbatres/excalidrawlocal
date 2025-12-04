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
    /** Standard Excalidraw elements (shapes, text, arrows, etc.) */
    standardElements: number;
    /** Embedded files (images as base64) */
    embeddedFiles: number;
    /** Markdown card content */
    markdownCards: number;
    /** Rich text card content */
    richTextCards: number;
    /** Hidden search text elements */
    searchTextElements: number;
    /** App state */
    appState: number;
    /** Thumbnails */
    thumbnails: number;
    /** Version history */
    versionHistory: number;
  };
  /** Element counts across all boards */
  totalElementCounts: {
    total: number;
    standard: number;
    images: number;
    markdownCards: number;
    richTextCards: number;
    searchText: number;
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
    let totalStandardElements = 0;
    let totalEmbeddedFiles = 0;
    let totalMarkdownCards = 0;
    let totalRichTextCards = 0;
    let totalSearchTextElements = 0;
    let totalAppState = 0;
    let totalThumbnails = 0;
    let totalVersionHistory = 0;

    // Element counts
    let elementsTotal = 0;
    let elementsStandard = 0;
    let elementsImages = 0;
    let elementsMarkdownCards = 0;
    let elementsRichTextCards = 0;
    let elementsSearchText = 0;

    // Group versions by board to find current version
    const versionsByBoard = new Map<string, typeof versions>();
    for (const version of versions) {
      if (!versionsByBoard.has(version.boardId)) {
        versionsByBoard.set(version.boardId, []);
      }
      versionsByBoard.get(version.boardId)!.push(version);
    }

    // Calculate storage from current versions only (first in each group, sorted desc)
    for (const [, boardVersions] of versionsByBoard) {
      if (boardVersions.length > 0) {
        const currentVersion = boardVersions[0];
        const currentScene = currentVersion.sceneJson as {
          elements?: Array<{
            type: string;
            fileId?: string;
            customData?: {
              isMarkdownCard?: boolean;
              isRichTextCard?: boolean;
              isMarkdownSearchText?: boolean;
              isRichTextSearchText?: boolean;
            };
            link?: string;
            id?: string;
          }>;
          files?: Record<string, unknown>;
        } | null;

        // Embedded files
        if (currentScene?.files) {
          totalEmbeddedFiles += getJsonSize(currentScene.files);
        }

        // Analyze elements by type
        if (currentScene?.elements) {
          for (const element of currentScene.elements) {
            const elementSize = getJsonSize(element);
            elementsTotal++;

            // Check element types
            const isMarkdownCard =
              element.customData?.isMarkdownCard ||
              element.link?.startsWith("markdown://");
            const isRichTextCard =
              element.customData?.isRichTextCard ||
              element.link?.startsWith("richtext://");
            const isSearchText =
              element.customData?.isMarkdownSearchText ||
              element.customData?.isRichTextSearchText ||
              element.id?.startsWith("rtsearch-") ||
              element.id?.startsWith("mdsearch-");
            const isImage = element.type === "image" && element.fileId;

            if (isMarkdownCard) {
              totalMarkdownCards += elementSize;
              elementsMarkdownCards++;
            } else if (isRichTextCard) {
              totalRichTextCards += elementSize;
              elementsRichTextCards++;
            } else if (isSearchText) {
              totalSearchTextElements += elementSize;
              elementsSearchText++;
            } else if (isImage) {
              totalStandardElements += elementSize;
              elementsImages++;
            } else {
              totalStandardElements += elementSize;
              elementsStandard++;
            }
          }
        }

        totalAppState += getJsonSize(currentVersion.appStateJson);
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

    const totalBytes =
      totalStandardElements +
      totalEmbeddedFiles +
      totalMarkdownCards +
      totalRichTextCards +
      totalSearchTextElements +
      totalAppState +
      totalThumbnails;

    const response: WorkspaceStorage = {
      totalBytes,
      totalFormatted: formatBytes(totalBytes),
      boardCount: boards.length,
      breakdown: {
        standardElements: totalStandardElements,
        embeddedFiles: totalEmbeddedFiles,
        markdownCards: totalMarkdownCards,
        richTextCards: totalRichTextCards,
        searchTextElements: totalSearchTextElements,
        appState: totalAppState,
        thumbnails: totalThumbnails,
        versionHistory: totalVersionHistory,
      },
      totalElementCounts: {
        total: elementsTotal,
        standard: elementsStandard,
        images: elementsImages,
        markdownCards: elementsMarkdownCards,
        richTextCards: elementsRichTextCards,
        searchText: elementsSearchText,
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
