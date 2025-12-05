// =============================================================================
// System Stats API - Comprehensive storage and usage statistics
// =============================================================================
// GET /api/stats - Get detailed statistics across all tables
// =============================================================================

import type { NextApiResponse } from "next";
import {
  withAuth,
  type AuthenticatedRequest,
} from "@/server/middleware/withAuth";
import { prisma } from "@/server/db/prisma";

export interface SystemStats {
  /** Overview statistics */
  overview: {
    totalUsers: number;
    totalOrganizations: number;
    totalBoards: number;
    totalVersions: number;
    totalAuditEvents: number;
  };

  /** Board statistics */
  boards: {
    active: number;
    archived: number;
    totalElements: number;
    totalImages: number;
    totalImagesSize: number;
    totalImagesSizeFormatted: string;
    totalMarkdownCards: number;
    totalRichTextCards: number;
  };

  /** Storage breakdown in bytes */
  storage: {
    totalBytes: number;
    totalFormatted: string;
    breakdown: {
      sceneData: number;
      sceneDataFormatted: string;
      appState: number;
      appStateFormatted: string;
      thumbnails: number;
      thumbnailsFormatted: string;
      versionHistory: number;
      versionHistoryFormatted: string;
    };
  };

  /** Per-table statistics */
  tables: {
    users: TableStats;
    organizations: TableStats;
    memberships: TableStats;
    boards: TableStats;
    boardVersions: TableStats;
    boardPermissions: TableStats;
    boardAssets: TableStats;
    auditEvents: TableStats;
    shareLinks: TableStats;
    accounts: TableStats;
    sessions: TableStats;
  };

  /** User's accessible data */
  userStats: {
    organizationsCount: number;
    boardsCount: number;
    versionsCreated: number;
  };
}

interface TableStats {
  count: number;
  estimatedBytes: number;
  estimatedFormatted: string;
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

  try {
    // Get user's organizations for filtering their accessible data
    const userMemberships = await prisma.membership.findMany({
      where: { userId: req.user.id },
      select: { orgId: true },
    });
    const userOrgIds = userMemberships.map((m) => m.orgId);

    // Run all count queries in parallel for efficiency
    const [
      totalUsers,
      totalOrganizations,
      totalBoards,
      activeBoards,
      archivedBoards,
      totalVersions,
      totalAuditEvents,
      totalMemberships,
      totalBoardPermissions,
      totalBoardAssets,
      totalShareLinks,
      totalAccounts,
      totalSessions,
      userBoardsCount,
      userVersionsCreated,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.organization.count(),
      prisma.board.count(),
      prisma.board.count({ where: { isArchived: false } }),
      prisma.board.count({ where: { isArchived: true } }),
      prisma.boardVersion.count(),
      prisma.auditEvent.count(),
      prisma.membership.count(),
      prisma.boardPermission.count(),
      prisma.boardAsset.count(),
      prisma.shareLink.count(),
      prisma.account.count(),
      prisma.session.count(),
      prisma.board.count({ where: { orgId: { in: userOrgIds } } }),
      prisma.boardVersion.count({ where: { createdById: req.user.id } }),
    ]);

    // Calculate storage from versions (sample approach for performance)
    // For large datasets, consider caching or background jobs
    const allVersions = await prisma.boardVersion.findMany({
      select: {
        boardId: true,
        version: true,
        sceneJson: true,
        appStateJson: true,
      },
      orderBy: [{ boardId: "asc" }, { version: "desc" }],
    });

    const allBoards = await prisma.board.findMany({
      select: {
        id: true,
        thumbnail: true,
      },
    });

    let totalSceneData = 0;
    let totalAppState = 0;
    let totalVersionHistory = 0;
    let totalElements = 0;
    let totalImages = 0;
    let totalImagesSize = 0;
    let totalMarkdownCards = 0;
    let totalRichTextCards = 0;

    // Track which boards we've already counted elements for (only count latest version)
    const countedBoards = new Set<string>();

    for (const version of allVersions) {
      const sceneSize = getJsonSize(version.sceneJson);
      const appStateSize = getJsonSize(version.appStateJson);

      // Always count towards version history (all versions)
      totalVersionHistory += sceneSize + appStateSize;

      // Only count elements from the LATEST version of each board
      // (versions are ordered by boardId ASC, version DESC, so first occurrence is latest)
      const isLatestVersion = !countedBoards.has(version.boardId);

      if (isLatestVersion) {
        countedBoards.add(version.boardId);

        // Count towards current storage (only latest versions)
        totalSceneData += sceneSize;
        totalAppState += appStateSize;

        // Analyze scene for element counts (only from latest version)
        const scene = version.sceneJson as {
          elements?: Array<{
            type: string;
            fileId?: string;
            customData?: {
              isMarkdownCard?: boolean;
              isRichTextCard?: boolean;
            };
            link?: string;
          }>;
          files?: Record<string, { dataURL?: string }>;
        } | null;

        if (scene?.elements) {
          for (const element of scene.elements) {
            totalElements++;

            const isMarkdownCard =
              element.customData?.isMarkdownCard ||
              element.link?.startsWith("markdown://");
            const isRichTextCard =
              element.customData?.isRichTextCard ||
              element.link?.startsWith("richtext://");
            const isImage = element.type === "image" && element.fileId;

            if (isMarkdownCard) totalMarkdownCards++;
            else if (isRichTextCard) totalRichTextCards++;
            else if (isImage) totalImages++;
          }
        }

        // Calculate image sizes from embedded files
        if (scene?.files) {
          for (const fileData of Object.values(scene.files)) {
            if (fileData?.dataURL) {
              totalImagesSize += getStringSize(fileData.dataURL);
            }
          }
        }
      }
    }

    // Calculate thumbnail storage
    let totalThumbnails = 0;
    for (const board of allBoards) {
      totalThumbnails += getStringSize(board.thumbnail);
    }

    const totalStorageBytes = totalSceneData + totalAppState + totalThumbnails;

    // Estimate table sizes (rough estimates based on typical row sizes)
    const estimateTableSize = (count: number, avgRowBytes: number) => ({
      count,
      estimatedBytes: count * avgRowBytes,
      estimatedFormatted: formatBytes(count * avgRowBytes),
    });

    const stats: SystemStats = {
      overview: {
        totalUsers,
        totalOrganizations,
        totalBoards,
        totalVersions,
        totalAuditEvents,
      },
      boards: {
        active: activeBoards,
        archived: archivedBoards,
        totalElements,
        totalImages,
        totalImagesSize,
        totalImagesSizeFormatted: formatBytes(totalImagesSize),
        totalMarkdownCards,
        totalRichTextCards,
      },
      storage: {
        totalBytes: totalStorageBytes,
        totalFormatted: formatBytes(totalStorageBytes),
        breakdown: {
          sceneData: totalSceneData,
          sceneDataFormatted: formatBytes(totalSceneData),
          appState: totalAppState,
          appStateFormatted: formatBytes(totalAppState),
          thumbnails: totalThumbnails,
          thumbnailsFormatted: formatBytes(totalThumbnails),
          versionHistory: totalVersionHistory,
          versionHistoryFormatted: formatBytes(totalVersionHistory),
        },
      },
      tables: {
        users: estimateTableSize(totalUsers, 500),
        organizations: estimateTableSize(totalOrganizations, 200),
        memberships: estimateTableSize(totalMemberships, 150),
        boards: estimateTableSize(totalBoards, 1000),
        boardVersions: {
          count: totalVersions,
          estimatedBytes: totalVersionHistory,
          estimatedFormatted: formatBytes(totalVersionHistory),
        },
        boardPermissions: estimateTableSize(totalBoardPermissions, 100),
        boardAssets: estimateTableSize(totalBoardAssets, 200),
        auditEvents: estimateTableSize(totalAuditEvents, 500),
        shareLinks: estimateTableSize(totalShareLinks, 150),
        accounts: estimateTableSize(totalAccounts, 800),
        sessions: estimateTableSize(totalSessions, 300),
      },
      userStats: {
        organizationsCount: userOrgIds.length,
        boardsCount: userBoardsCount,
        versionsCreated: userVersionsCreated,
      },
    };

    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json(stats);
  } catch (error) {
    console.error("[API /api/stats]", error);
    return res.status(500).json({
      error: "Internal Server Error",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

export default withAuth(handler);
