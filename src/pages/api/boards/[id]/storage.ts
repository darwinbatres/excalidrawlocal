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
    /** Standard Excalidraw elements (shapes, text, arrows, etc.) */
    standardElements: number;
    /** Embedded files (images as base64) */
    embeddedFiles: number;
    /** Markdown card content (markdown text in customData) */
    markdownCards: number;
    /** Rich text card content (Tiptap JSON in customData) */
    richTextCards: number;
    /** Hidden search text elements for card searchability */
    searchTextElements: number;
    /** App state */
    appState: number;
    /** Thumbnail preview */
    thumbnail: number;
    /** Version history (all versions combined) */
    versionHistory: number;
  };
  /** Element counts by type */
  elementCounts: {
    total: number;
    standard: number;
    images: number;
    markdownCards: number;
    richTextCards: number;
    searchText: number;
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
    let appStateSize = 0;
    let versionHistorySize = 0;
    let embeddedFilesSize = 0;
    let markdownCardsSize = 0;
    let richTextCardsSize = 0;
    let searchTextElementsSize = 0;
    let standardElementsSize = 0;

    // Element counts
    let totalElements = 0;
    let standardCount = 0;
    let imagesCount = 0;
    let markdownCardsCount = 0;
    let richTextCardsCount = 0;
    let searchTextCount = 0;

    // Current version (first one, most recent)
    if (versions.length > 0) {
      const currentScene = versions[0].sceneJson as {
        elements?: Array<{
          type: string;
          fileId?: string;
          customData?: {
            isMarkdownCard?: boolean;
            isRichTextCard?: boolean;
            isMarkdownSearchText?: boolean;
            isRichTextSearchText?: boolean;
            markdown?: string;
            richTextContent?: string;
          };
          link?: string;
          id?: string;
        }>;
        files?: Record<string, unknown>;
      } | null;

      // Calculate embedded files separately (these are base64 images)
      if (currentScene?.files) {
        embeddedFilesSize = getJsonSize(currentScene.files);
      }

      // Analyze elements by type
      if (currentScene?.elements) {
        totalElements = currentScene.elements.length;

        for (const element of currentScene.elements) {
          const elementSize = getJsonSize(element);

          // Check if this is a markdown card
          const isMarkdownCard =
            element.customData?.isMarkdownCard ||
            element.link?.startsWith("markdown://");

          // Check if this is a rich text card
          const isRichTextCard =
            element.customData?.isRichTextCard ||
            element.link?.startsWith("richtext://");

          // Check if this is a search text element
          const isSearchText =
            element.customData?.isMarkdownSearchText ||
            element.customData?.isRichTextSearchText ||
            element.id?.startsWith("rtsearch-") ||
            element.id?.startsWith("mdsearch-");

          // Check if this is an image
          const isImage = element.type === "image" && element.fileId;

          if (isMarkdownCard) {
            markdownCardsSize += elementSize;
            markdownCardsCount++;
          } else if (isRichTextCard) {
            richTextCardsSize += elementSize;
            richTextCardsCount++;
          } else if (isSearchText) {
            searchTextElementsSize += elementSize;
            searchTextCount++;
          } else if (isImage) {
            // Image element metadata (not the file data itself)
            standardElementsSize += elementSize;
            imagesCount++;
          } else {
            standardElementsSize += elementSize;
            standardCount++;
          }
        }
      }

      appStateSize = getJsonSize(versions[0].appStateJson);
    }

    // Version history (all versions including current)
    for (const version of versions) {
      versionHistorySize += getJsonSize(version.sceneJson);
      versionHistorySize += getJsonSize(version.appStateJson);
    }

    const thumbnailSize = getStringSize(board.thumbnail);

    // Total current board size (elements + files + app state + thumbnail)
    const totalBytes =
      standardElementsSize +
      embeddedFilesSize +
      markdownCardsSize +
      richTextCardsSize +
      searchTextElementsSize +
      appStateSize +
      thumbnailSize;

    const response: StorageBreakdown = {
      totalBytes,
      totalFormatted: formatBytes(totalBytes),
      breakdown: {
        standardElements: standardElementsSize,
        embeddedFiles: embeddedFilesSize,
        markdownCards: markdownCardsSize,
        richTextCards: richTextCardsSize,
        searchTextElements: searchTextElementsSize,
        appState: appStateSize,
        thumbnail: thumbnailSize,
        versionHistory: versionHistorySize,
      },
      elementCounts: {
        total: totalElements,
        standard: standardCount,
        images: imagesCount,
        markdownCards: markdownCardsCount,
        richTextCards: richTextCardsCount,
        searchText: searchTextCount,
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
