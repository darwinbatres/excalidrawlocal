// =============================================================================
// Boards Service
// =============================================================================
// Business logic for board operations
// =============================================================================

import { prisma } from "../db/prisma";
import { logAuditEvent } from "./audit.service";
import type { NextApiRequest } from "next";

export interface CreateBoardInput {
  orgId: string;
  ownerId: string;
  title: string;
  description?: string;
  tags?: string[];
  sceneJson: unknown;
  appStateJson?: unknown;
}

export interface UpdateBoardInput {
  title?: string;
  description?: string;
  tags?: string[];
  isArchived?: boolean;
}

export interface SaveVersionInput {
  boardId: string;
  userId: string;
  sceneJson: unknown;
  appStateJson?: unknown;
  label?: string;
  expectedEtag?: string;
  thumbnail?: string; // Base64 data URL for preview
}

/**
 * Create a new board with initial version
 */
export async function createBoard(
  input: CreateBoardInput,
  req?: NextApiRequest
) {
  const { orgId, ownerId, title, description, tags, sceneJson, appStateJson } =
    input;

  const board = await prisma.$transaction(async (tx) => {
    // Create the board
    const newBoard = await tx.board.create({
      data: {
        orgId,
        ownerId,
        title,
        description,
        tags: tags || [],
        versionNumber: 1,
      },
    });

    // Create initial version
    await tx.boardVersion.create({
      data: {
        boardId: newBoard.id,
        version: 1,
        createdById: ownerId,
        sceneJson: sceneJson as object,
        appStateJson: appStateJson as object,
      },
    });

    // Update board with current version
    const updated = await tx.board.update({
      where: { id: newBoard.id },
      data: { currentVersionId: newBoard.id },
    });

    return updated;
  });

  // Audit log
  await logAuditEvent({
    orgId,
    actorId: ownerId,
    action: "board.create",
    targetType: "board",
    targetId: board.id,
    metadata: { title },
    req,
  });

  return board;
}

/**
 * Update board metadata
 */
export async function updateBoard(
  boardId: string,
  userId: string,
  input: UpdateBoardInput,
  req?: NextApiRequest
) {
  const board = await prisma.board.update({
    where: { id: boardId },
    data: {
      ...(input.title !== undefined && { title: input.title }),
      ...(input.description !== undefined && {
        description: input.description,
      }),
      ...(input.tags !== undefined && { tags: input.tags }),
      ...(input.isArchived !== undefined && { isArchived: input.isArchived }),
    },
  });

  await logAuditEvent({
    orgId: board.orgId,
    actorId: userId,
    action:
      input.isArchived !== undefined
        ? input.isArchived
          ? "board.archive"
          : "board.unarchive"
        : "board.update",
    targetType: "board",
    targetId: boardId,
    metadata: { changes: input },
    req,
  });

  return board;
}

/**
 * Clean up orphaned files from scene data.
 * Removes files that are not referenced by any image element.
 */
function cleanOrphanedFiles(sceneJson: unknown): unknown {
  const scene = sceneJson as {
    elements?: Array<{ type: string; fileId?: string }>;
    files?: Record<string, unknown>;
  } | null;

  if (!scene?.files || Object.keys(scene.files).length === 0) {
    return sceneJson;
  }

  // Find all file IDs that are actually used by image elements
  const usedFileIds = new Set<string>();
  if (scene.elements) {
    for (const element of scene.elements) {
      if (element.type === "image" && element.fileId) {
        usedFileIds.add(element.fileId);
      }
    }
  }

  // Keep only used files
  const cleanedFiles: Record<string, unknown> = {};
  for (const [fileId, fileData] of Object.entries(scene.files)) {
    if (usedFileIds.has(fileId)) {
      cleanedFiles[fileId] = fileData;
    }
  }

  return {
    ...scene,
    files: cleanedFiles,
  };
}

/**
 * Save a new version of a board (with optimistic locking via etag)
 */
export async function saveVersion(
  input: SaveVersionInput,
  req?: NextApiRequest
) {
  const {
    boardId,
    userId,
    sceneJson,
    appStateJson,
    label,
    expectedEtag,
    thumbnail,
  } = input;

  // Clean up orphaned files before saving
  const cleanedSceneJson = cleanOrphanedFiles(sceneJson);

  const result = await prisma.$transaction(async (tx) => {
    // Get current board state
    const board = await tx.board.findUnique({
      where: { id: boardId },
    });

    if (!board) {
      throw new Error("Board not found");
    }

    // Optimistic concurrency check
    if (expectedEtag && board.etag !== expectedEtag) {
      return { conflict: true, currentEtag: board.etag };
    }

    const newVersion = board.versionNumber + 1;
    const newEtag = `${boardId}-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}`;

    // Create new version
    const version = await tx.boardVersion.create({
      data: {
        boardId,
        version: newVersion,
        createdById: userId,
        sceneJson: cleanedSceneJson as object,
        appStateJson: appStateJson as object,
        label,
        thumbnailUrl: thumbnail,
      },
    });

    // Update board with new version and thumbnail
    await tx.board.update({
      where: { id: boardId },
      data: {
        versionNumber: newVersion,
        currentVersionId: version.id,
        etag: newEtag,
        ...(thumbnail && { thumbnail }),
      },
    });

    return { conflict: false, version, etag: newEtag };
  });

  if (!result.conflict && result.version) {
    await logAuditEvent({
      orgId: (await prisma.board.findUnique({ where: { id: boardId } }))!.orgId,
      actorId: userId,
      action: "version.create",
      targetType: "board_version",
      targetId: result.version.id,
      metadata: { boardId, version: result.version.version, label },
      req,
    });
  }

  return result;
}

/**
 * Get a board by ID with its latest version
 */
export async function getBoardWithLatestVersion(boardId: string) {
  const board = await prisma.board.findUnique({
    where: { id: boardId },
    include: {
      owner: {
        select: { id: true, name: true, email: true, image: true },
      },
      versions: {
        orderBy: { version: "desc" },
        take: 1,
      },
    },
  });

  if (!board) return null;

  return {
    ...board,
    latestVersion: board.versions[0] || null,
  };
}

/**
 * Get version history for a board
 */
export async function getBoardVersions(
  boardId: string,
  options: { limit?: number; offset?: number } = {}
) {
  const { limit = 20, offset = 0 } = options;

  const [versions, total] = await Promise.all([
    prisma.boardVersion.findMany({
      where: { boardId },
      orderBy: { version: "desc" },
      take: limit,
      skip: offset,
      include: {
        createdBy: {
          select: { id: true, name: true, email: true, image: true },
        },
      },
    }),
    prisma.boardVersion.count({ where: { boardId } }),
  ]);

  // Return in PaginatedResponse format expected by the client
  return {
    items: versions,
    total,
    limit,
    offset,
  };
}

/**
 * Get a specific version of a board
 */
export async function getBoardVersion(boardId: string, version: number) {
  return prisma.boardVersion.findUnique({
    where: {
      boardId_version: { boardId, version },
    },
    include: {
      createdBy: {
        select: { id: true, name: true, email: true, image: true },
      },
    },
  });
}

/**
 * Restore a board to a specific version
 */
export async function restoreVersion(
  boardId: string,
  targetVersion: number,
  userId: string,
  req?: NextApiRequest
) {
  const oldVersion = await prisma.boardVersion.findUnique({
    where: {
      boardId_version: { boardId, version: targetVersion },
    },
  });

  if (!oldVersion) {
    throw new Error("Version not found");
  }

  // Create a new version with the old content
  const result = await saveVersion(
    {
      boardId,
      userId,
      sceneJson: oldVersion.sceneJson,
      appStateJson: oldVersion.appStateJson,
      label: `Restored from v${targetVersion}`,
    },
    req
  );

  if (!result.conflict) {
    const board = await prisma.board.findUnique({ where: { id: boardId } });
    await logAuditEvent({
      orgId: board!.orgId,
      actorId: userId,
      action: "version.restore",
      targetType: "board",
      targetId: boardId,
      metadata: { restoredFromVersion: targetVersion },
      req,
    });
  }

  return result;
}

/**
 * Archive a board
 */
export async function archiveBoard(
  boardId: string,
  userId: string,
  req?: NextApiRequest
) {
  const board = await prisma.board.update({
    where: { id: boardId },
    data: { isArchived: true },
  });

  await logAuditEvent({
    orgId: board.orgId,
    actorId: userId,
    action: "board.archive",
    targetType: "board",
    targetId: boardId,
    req,
  });

  return board;
}

/**
 * Restore an archived board
 */
export async function restoreBoard(
  boardId: string,
  userId: string,
  req?: NextApiRequest
) {
  const board = await prisma.board.update({
    where: { id: boardId },
    data: { isArchived: false },
  });

  await logAuditEvent({
    orgId: board.orgId,
    actorId: userId,
    action: "board.restore",
    targetType: "board",
    targetId: boardId,
    req,
  });

  return board;
}

/**
 * Delete a board permanently
 */
export async function deleteBoard(
  boardId: string,
  userId: string,
  req?: NextApiRequest
) {
  const board = await prisma.board.findUnique({
    where: { id: boardId },
  });

  if (!board) {
    throw new Error("Board not found");
  }

  await prisma.board.delete({
    where: { id: boardId },
  });

  await logAuditEvent({
    orgId: board.orgId,
    actorId: userId,
    action: "board.delete",
    targetType: "board",
    targetId: boardId,
    metadata: { title: board.title },
    req,
  });
}

/**
 * Search boards within an organization
 */
export async function searchBoards(
  orgId: string,
  options: {
    query?: string;
    tags?: string[];
    isArchived?: boolean;
    limit?: number;
    offset?: number;
  } = {}
) {
  const { query, tags, isArchived = false, limit = 20, offset = 0 } = options;

  const where = {
    orgId,
    isArchived,
    ...(query && {
      OR: [
        { title: { contains: query, mode: "insensitive" as const } },
        { description: { contains: query, mode: "insensitive" as const } },
      ],
    }),
    ...(tags &&
      tags.length > 0 && {
        tags: { hasSome: tags },
      }),
  };

  const [boards, total] = await Promise.all([
    prisma.board.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      take: limit,
      skip: offset,
      include: {
        owner: {
          select: { id: true, name: true, email: true, image: true },
        },
      },
    }),
    prisma.board.count({ where }),
  ]);

  return {
    items: boards,
    total,
    limit,
    offset,
  };
}
