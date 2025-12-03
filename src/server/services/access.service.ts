// =============================================================================
// Access Control Service
// =============================================================================
// Centralized permission checking for RBAC
// =============================================================================

import { prisma } from "../db/prisma";
import type { OrgRole, BoardRole } from "@prisma/client";

/**
 * Permission level hierarchy for organizations
 * OWNER > ADMIN > MEMBER > VIEWER
 */
const ORG_ROLE_HIERARCHY: Record<OrgRole, number> = {
  OWNER: 100,
  ADMIN: 75,
  MEMBER: 50,
  VIEWER: 25,
};

/**
 * Permission level hierarchy for boards
 * OWNER > EDITOR > VIEWER
 */
const BOARD_ROLE_HIERARCHY: Record<BoardRole, number> = {
  OWNER: 100,
  EDITOR: 50,
  VIEWER: 25,
};

/**
 * Get a user's membership in an organization
 */
export async function getMembership(userId: string, orgId: string) {
  return prisma.membership.findUnique({
    where: {
      orgId_userId: { orgId, userId },
    },
    include: {
      org: true,
      user: {
        select: { id: true, email: true, name: true, image: true },
      },
    },
  });
}

/**
 * Check if a user has at least the required organization role
 */
export async function hasOrgRole(
  userId: string,
  orgId: string,
  requiredRole: OrgRole
): Promise<boolean> {
  const membership = await getMembership(userId, orgId);
  if (!membership) return false;

  return (
    ORG_ROLE_HIERARCHY[membership.role] >= ORG_ROLE_HIERARCHY[requiredRole]
  );
}

/**
 * Check if a user can manage organization members
 */
export async function canManageMembers(
  userId: string,
  orgId: string
): Promise<boolean> {
  return hasOrgRole(userId, orgId, "ADMIN");
}

/**
 * Check if a user is an organization owner
 */
export async function isOrgOwner(
  userId: string,
  orgId: string
): Promise<boolean> {
  return hasOrgRole(userId, orgId, "OWNER");
}

/**
 * Get a user's effective permission level for a board
 * Considers both org role and explicit board permissions
 */
export async function getBoardPermission(
  userId: string,
  boardId: string
): Promise<BoardRole | null> {
  // First get the board to check org membership
  const board = await prisma.board.findUnique({
    where: { id: boardId },
    select: { orgId: true, ownerId: true },
  });

  if (!board) return null;

  // Board owner always has OWNER permission
  if (board.ownerId === userId) return "OWNER";

  // Get org membership
  const membership = await getMembership(userId, board.orgId);
  if (!membership) return null;

  // Org owners and admins have full access to all boards
  if (membership.role === "OWNER" || membership.role === "ADMIN") {
    return "OWNER";
  }

  // Check explicit board permission
  const boardPermission = await prisma.boardPermission.findUnique({
    where: {
      boardId_membershipId: {
        boardId,
        membershipId: membership.id,
      },
    },
  });

  if (boardPermission) {
    return boardPermission.role;
  }

  // Default permission for org members
  if (membership.role === "MEMBER") return "VIEWER";
  if (membership.role === "VIEWER") return "VIEWER";

  return null;
}

/**
 * Check if a user can edit a board
 */
export async function canEditBoard(
  userId: string,
  boardId: string
): Promise<boolean> {
  const permission = await getBoardPermission(userId, boardId);
  if (!permission) return false;

  return BOARD_ROLE_HIERARCHY[permission] >= BOARD_ROLE_HIERARCHY["EDITOR"];
}

/**
 * Check if a user can view a board
 */
export async function canViewBoard(
  userId: string,
  boardId: string
): Promise<boolean> {
  const permission = await getBoardPermission(userId, boardId);
  return permission !== null;
}

/**
 * Check if a user can delete a board
 */
export async function canDeleteBoard(
  userId: string,
  boardId: string
): Promise<boolean> {
  const permission = await getBoardPermission(userId, boardId);
  if (!permission) return false;

  return permission === "OWNER";
}

/**
 * Check if a user can manage board permissions
 */
export async function canManageBoardPermissions(
  userId: string,
  boardId: string
): Promise<boolean> {
  const permission = await getBoardPermission(userId, boardId);
  if (!permission) return false;

  return permission === "OWNER";
}

/**
 * Grant board permission to a membership
 */
export async function grantBoardPermission(
  boardId: string,
  membershipId: string,
  role: BoardRole
) {
  return prisma.boardPermission.upsert({
    where: {
      boardId_membershipId: { boardId, membershipId },
    },
    create: { boardId, membershipId, role },
    update: { role },
  });
}

/**
 * Revoke board permission from a membership
 */
export async function revokeBoardPermission(
  boardId: string,
  membershipId: string
) {
  return prisma.boardPermission.delete({
    where: {
      boardId_membershipId: { boardId, membershipId },
    },
  });
}

/**
 * Get all accessible boards for a user in an organization
 */
export async function getAccessibleBoards(userId: string, orgId: string) {
  const membership = await getMembership(userId, orgId);
  if (!membership) return [];

  // Org owners and admins can see all boards
  if (membership.role === "OWNER" || membership.role === "ADMIN") {
    return prisma.board.findMany({
      where: { orgId, isArchived: false },
      orderBy: { updatedAt: "desc" },
    });
  }

  // Others can see boards they own or have explicit access to
  const [ownedBoards, permittedBoards] = await Promise.all([
    prisma.board.findMany({
      where: { orgId, ownerId: userId, isArchived: false },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.board.findMany({
      where: {
        orgId,
        isArchived: false,
        permissions: {
          some: { membershipId: membership.id },
        },
      },
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  // Merge and dedupe
  const boardMap = new Map<string, (typeof ownedBoards)[0]>();
  [...ownedBoards, ...permittedBoards].forEach((b) => boardMap.set(b.id, b));

  return Array.from(boardMap.values()).sort(
    (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()
  );
}
