// =============================================================================
// Auth Middleware
// =============================================================================
// Wraps API routes with authentication checks
// =============================================================================

import type { NextApiRequest, NextApiResponse, NextApiHandler } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/pages/api/auth/[...nextauth]";

export interface AuthenticatedRequest extends NextApiRequest {
  user: {
    id: string;
    email: string;
    name?: string | null;
  };
}

export type AuthenticatedHandler = (
  req: AuthenticatedRequest,
  res: NextApiResponse
) => Promise<unknown> | unknown;

/**
 * Middleware to require authentication for an API route
 */
export function withAuth(handler: AuthenticatedHandler): NextApiHandler {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    const session = await getServerSession(req, res, authOptions);

    if (!session?.user?.email) {
      return res.status(401).json({
        error: "Unauthorized",
        message: "You must be logged in to access this resource.",
      });
    }

    // Attach user to request
    (req as AuthenticatedRequest).user = {
      id: session.user.id as string,
      email: session.user.email,
      name: session.user.name,
    };

    return handler(req as AuthenticatedRequest, res);
  };
}

/**
 * Optional auth - attaches user if present, but doesn't require it
 */
export function withOptionalAuth(handler: NextApiHandler): NextApiHandler {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    const session = await getServerSession(req, res, authOptions);

    if (session?.user?.email) {
      (req as AuthenticatedRequest).user = {
        id: session.user.id as string,
        email: session.user.email,
        name: session.user.name,
      };
    }

    return handler(req, res);
  };
}

/**
 * Combine multiple middleware functions
 */
export function composeMiddleware(
  ...middlewares: Array<(handler: NextApiHandler) => NextApiHandler>
) {
  return (handler: NextApiHandler): NextApiHandler => {
    return middlewares.reduceRight(
      (acc, middleware) => middleware(acc),
      handler
    );
  };
}
