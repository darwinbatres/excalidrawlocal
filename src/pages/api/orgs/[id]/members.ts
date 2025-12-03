// =============================================================================
// Organization Members API
// =============================================================================
// GET /api/orgs/:id/members - List members
// POST /api/orgs/:id/members - Invite member
// PATCH /api/orgs/:id/members - Update member role
// DELETE /api/orgs/:id/members - Remove member
// =============================================================================

import type { NextApiResponse } from "next";
import { z } from "zod";
import {
  withAuth,
  type AuthenticatedRequest,
} from "@/server/middleware/withAuth";
import { rateLimiters } from "@/server/middleware/ratelimit";
import { prisma } from "@/server/db/prisma";
import { hasOrgRole, canManageMembers } from "@/server/services/access.service";
import { logAuditEvent } from "@/server/services/audit.service";

const inviteMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(["ADMIN", "MEMBER", "VIEWER"]).default("MEMBER"),
});

const updateMemberSchema = z.object({
  membershipId: z.string().min(1),
  role: z.enum(["ADMIN", "MEMBER", "VIEWER"]),
});

const removeMemberSchema = z.object({
  membershipId: z.string().min(1),
});

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  const { method, query } = req;
  const orgId = query.id as string;

  if (!orgId || typeof orgId !== "string") {
    return res.status(400).json({
      error: "Bad Request",
      message: "Organization ID is required",
    });
  }

  // Verify user has access to this org
  const hasAccess = await hasOrgRole(req.user.id, orgId, "VIEWER");
  if (!hasAccess) {
    return res.status(404).json({
      error: "Not Found",
      message: "Organization not found.",
    });
  }

  try {
    switch (method) {
      case "GET": {
        const members = await prisma.membership.findMany({
          where: { orgId },
          include: {
            user: {
              select: { id: true, email: true, name: true, image: true },
            },
          },
          orderBy: { createdAt: "asc" },
        });

        return res.status(200).json({ members });
      }

      case "POST": {
        // Check admin permission
        const canManage = await canManageMembers(req.user.id, orgId);
        if (!canManage) {
          return res.status(403).json({
            error: "Forbidden",
            message: "You do not have permission to manage members.",
          });
        }

        const parsed = inviteMemberSchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({
            error: "Bad Request",
            details: parsed.error.issues,
          });
        }

        const { email, role } = parsed.data;

        // Find user by email
        const user = await prisma.user.findUnique({
          where: { email },
        });

        if (!user) {
          return res.status(404).json({
            error: "Not Found",
            message:
              "User with this email not found. They must create an account first.",
          });
        }

        // Check if already a member
        const existingMembership = await prisma.membership.findUnique({
          where: { orgId_userId: { orgId, userId: user.id } },
        });

        if (existingMembership) {
          return res.status(409).json({
            error: "Conflict",
            message: "User is already a member of this organization.",
          });
        }

        const membership = await prisma.membership.create({
          data: {
            orgId,
            userId: user.id,
            role,
          },
          include: {
            user: {
              select: { id: true, email: true, name: true, image: true },
            },
          },
        });

        await logAuditEvent({
          orgId,
          actorId: req.user.id,
          action: "member.invite",
          targetType: "membership",
          targetId: membership.id,
          metadata: { email, role },
          req,
        });

        return res.status(201).json(membership);
      }

      case "PATCH": {
        const canManage = await canManageMembers(req.user.id, orgId);
        if (!canManage) {
          return res.status(403).json({
            error: "Forbidden",
            message: "You do not have permission to manage members.",
          });
        }

        const parsed = updateMemberSchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({
            error: "Bad Request",
            details: parsed.error.issues,
          });
        }

        const { membershipId, role } = parsed.data;

        // Get the membership
        const membership = await prisma.membership.findUnique({
          where: { id: membershipId },
          include: { user: true },
        });

        if (!membership || membership.orgId !== orgId) {
          return res.status(404).json({
            error: "Not Found",
            message: "Membership not found.",
          });
        }

        // Cannot change owner role (use transfer ownership instead)
        if (membership.role === "OWNER") {
          return res.status(400).json({
            error: "Bad Request",
            message: "Cannot change the role of an organization owner.",
          });
        }

        const updated = await prisma.membership.update({
          where: { id: membershipId },
          data: { role },
          include: {
            user: {
              select: { id: true, email: true, name: true, image: true },
            },
          },
        });

        await logAuditEvent({
          orgId,
          actorId: req.user.id,
          action: "member.role_change",
          targetType: "membership",
          targetId: membershipId,
          metadata: { oldRole: membership.role, newRole: role },
          req,
        });

        return res.status(200).json(updated);
      }

      case "DELETE": {
        const canManage = await canManageMembers(req.user.id, orgId);
        if (!canManage) {
          return res.status(403).json({
            error: "Forbidden",
            message: "You do not have permission to manage members.",
          });
        }

        const parsed = removeMemberSchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({
            error: "Bad Request",
            details: parsed.error.issues,
          });
        }

        const { membershipId } = parsed.data;

        const membership = await prisma.membership.findUnique({
          where: { id: membershipId },
        });

        if (!membership || membership.orgId !== orgId) {
          return res.status(404).json({
            error: "Not Found",
            message: "Membership not found.",
          });
        }

        // Cannot remove owner
        if (membership.role === "OWNER") {
          return res.status(400).json({
            error: "Bad Request",
            message: "Cannot remove the organization owner.",
          });
        }

        await prisma.membership.delete({
          where: { id: membershipId },
        });

        await logAuditEvent({
          orgId,
          actorId: req.user.id,
          action: "member.remove",
          targetType: "membership",
          targetId: membershipId,
          metadata: { removedUserId: membership.userId },
          req,
        });

        return res.status(204).end();
      }

      default:
        res.setHeader("Allow", ["GET", "POST", "PATCH", "DELETE"]);
        return res.status(405).json({ error: `Method ${method} Not Allowed` });
    }
  } catch (error) {
    console.error("[API] Members error:", error);
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
