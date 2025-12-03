// =============================================================================
// Organization API - Single Organization Operations
// =============================================================================
// DELETE /api/orgs/[id] - Delete an organization
// =============================================================================

import type { NextApiResponse } from "next";
import {
  withAuth,
  type AuthenticatedRequest,
} from "@/server/middleware/withAuth";
import { prisma } from "@/server/db/prisma";

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  const { method } = req;
  const orgId = req.query.id as string;

  if (!orgId) {
    return res.status(400).json({ error: "Organization ID is required" });
  }

  try {
    switch (method) {
      case "DELETE": {
        // 1. Check user is a member and has OWNER role
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

        if (membership.role !== "OWNER") {
          return res.status(403).json({
            error: "Forbidden",
            message: "Only owners can delete a workspace",
          });
        }

        // 2. Check user has at least 2 orgs (must keep one)
        const userOrgCount = await prisma.membership.count({
          where: { userId: req.user.id },
        });

        if (userOrgCount <= 1) {
          return res.status(400).json({
            error: "Bad Request",
            message: "You must have at least one workspace. Create a new workspace before deleting this one.",
          });
        }

        // 3. Check org has no boards (including archived)
        const boardCount = await prisma.board.count({
          where: { orgId },
        });

        if (boardCount > 0) {
          return res.status(400).json({
            error: "Bad Request",
            message: `This workspace has ${boardCount} board(s). Delete all boards before deleting the workspace.`,
          });
        }

        // 4. Get org details for logging
        const org = await prisma.organization.findUnique({
          where: { id: orgId },
          select: { name: true, slug: true },
        });

        // 5. Delete the organization (cascade deletes memberships, audit events)
        await prisma.organization.delete({
          where: { id: orgId },
        });

        // 6. Log the deletion
        console.log(`[Audit] User ${req.user.id} deleted org ${orgId} (${org?.name})`);

        return res.status(200).json({
          success: true,
          message: "Workspace deleted successfully",
        });
      }

      default:
        res.setHeader("Allow", ["DELETE"]);
        return res.status(405).json({ error: `Method ${method} Not Allowed` });
    }
  } catch (error) {
    console.error("[API /api/orgs/[id]]", error);
    return res.status(500).json({
      error: "Internal Server Error",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

export default withAuth(handler);
