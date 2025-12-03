// =============================================================================
// Organizations API - List and Create
// =============================================================================
// GET /api/orgs - List user's organizations
// POST /api/orgs - Create a new organization
// =============================================================================

import type { NextApiResponse } from "next";
import { z } from "zod";
import {
  withAuth,
  type AuthenticatedRequest,
} from "@/server/middleware/withAuth";
import { rateLimiters } from "@/server/middleware/ratelimit";
import { prisma } from "@/server/db/prisma";
import { logAuditEvent } from "@/server/services/audit.service";

const createOrgSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z
    .string()
    .min(3)
    .max(50)
    .regex(
      /^[a-z0-9-]+$/,
      "Slug must be lowercase alphanumeric with hyphens only"
    ),
});

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  const { method } = req;

  try {
    switch (method) {
      case "GET": {
        // Get all orgs where user is a member
        const memberships = await prisma.membership.findMany({
          where: { userId: req.user.id },
          include: {
            org: {
              include: {
                _count: {
                  select: {
                    memberships: true,
                    boards: { where: { isArchived: false } },
                  },
                },
              },
            },
          },
          orderBy: { org: { name: "asc" } },
        });

        const orgs = memberships.map((m) => ({
          id: m.org.id,
          name: m.org.name,
          slug: m.org.slug,
          role: m.role,
          memberCount: m.org._count.memberships,
          boardCount: m.org._count.boards,
          createdAt: m.org.createdAt,
        }));

        return res.status(200).json({ organizations: orgs });
      }

      case "POST": {
        const parsed = createOrgSchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({
            error: "Bad Request",
            details: parsed.error.issues,
          });
        }

        const { name, slug } = parsed.data;

        // Check if slug is taken
        const existing = await prisma.organization.findUnique({
          where: { slug },
        });
        if (existing) {
          return res.status(409).json({
            error: "Conflict",
            message: "An organization with this slug already exists.",
          });
        }

        // Create org and add user as owner
        const org = await prisma.$transaction(async (tx) => {
          const newOrg = await tx.organization.create({
            data: { name, slug },
          });

          await tx.membership.create({
            data: {
              orgId: newOrg.id,
              userId: req.user.id,
              role: "OWNER",
            },
          });

          return newOrg;
        });

        await logAuditEvent({
          orgId: org.id,
          actorId: req.user.id,
          action: "org.create",
          targetType: "organization",
          targetId: org.id,
          metadata: { name, slug },
          req,
        });

        return res.status(201).json(org);
      }

      default:
        res.setHeader("Allow", ["GET", "POST"]);
        return res.status(405).json({ error: `Method ${method} Not Allowed` });
    }
  } catch (error) {
    console.error("[API] Orgs error:", error);
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
