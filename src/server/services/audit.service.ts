// =============================================================================
// Audit Service
// =============================================================================
// Enterprise audit logging for compliance and security
// =============================================================================

import { prisma } from "../db/prisma";
import type { NextApiRequest } from "next";

export type AuditAction =
  | "board.create"
  | "board.update"
  | "board.delete"
  | "board.view"
  | "board.restore"
  | "board.archive"
  | "board.unarchive"
  | "version.create"
  | "version.restore"
  | "permission.grant"
  | "permission.revoke"
  | "org.create"
  | "org.update"
  | "org.delete"
  | "member.invite"
  | "member.remove"
  | "member.role_change"
  | "auth.login"
  | "auth.logout"
  | "auth.password_change";

export type AuditTargetType =
  | "board"
  | "board_version"
  | "organization"
  | "membership"
  | "user"
  | "board_permission";

interface AuditLogInput {
  orgId: string;
  actorId?: string | null;
  action: AuditAction;
  targetType: AuditTargetType;
  targetId: string;
  metadata?: Record<string, unknown>;
  req?: NextApiRequest;
}

/**
 * Log an audit event to the database
 */
export async function logAuditEvent(input: AuditLogInput): Promise<void> {
  try {
    const { orgId, actorId, action, targetType, targetId, metadata, req } =
      input;

    await prisma.auditEvent.create({
      data: {
        orgId,
        actorId,
        action,
        targetType,
        targetId,
        ip:
          req?.headers?.["x-forwarded-for"]?.toString() ||
          req?.socket?.remoteAddress ||
          null,
        userAgent: req?.headers?.["user-agent"] || null,
        metadata: metadata ? JSON.parse(JSON.stringify(metadata)) : null,
      },
    });
  } catch (error) {
    // Log audit errors but don't throw - audit should never break the main flow
    console.error("[Audit] Failed to log audit event:", error);
  }
}

/**
 * Get audit logs with filters and pagination
 */
export async function getAuditLogs(options: {
  orgId: string;
  actorId?: string;
  action?: string;
  targetType?: AuditTargetType;
  targetId?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}) {
  const {
    orgId,
    actorId,
    action,
    targetType,
    targetId,
    startDate,
    endDate,
    limit = 50,
    offset = 0,
  } = options;

  const where = {
    orgId,
    ...(actorId && { actorId }),
    ...(action && { action }),
    ...(targetType && { targetType }),
    ...(targetId && { targetId }),
    ...(startDate || endDate
      ? {
          createdAt: {
            ...(startDate && { gte: startDate }),
            ...(endDate && { lte: endDate }),
          },
        }
      : {}),
  };

  const [logs, total] = await Promise.all([
    prisma.auditEvent.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.auditEvent.count({ where }),
  ]);

  return {
    logs,
    pagination: {
      total,
      limit,
      offset,
      hasMore: offset + logs.length < total,
    },
  };
}

/**
 * Get audit stats for a time period
 */
export async function getAuditStats(orgId: string, days: number = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const events = await prisma.auditEvent.groupBy({
    by: ["action"],
    where: {
      orgId,
      createdAt: { gte: startDate },
    },
    _count: { action: true },
  });

  const totalEvents = events.reduce((sum, e) => sum + e._count.action, 0);

  return {
    totalEvents,
    byAction: events.map((e) => ({
      action: e.action,
      count: e._count.action,
    })),
    period: {
      start: startDate,
      end: new Date(),
      days,
    },
  };
}
