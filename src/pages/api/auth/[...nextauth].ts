// =============================================================================
// NextAuth Configuration
// =============================================================================
// Enterprise auth setup with credentials provider
// Supports Google, GitHub, and email/password authentication
// =============================================================================

import NextAuth, { type NextAuthOptions, type User } from "next-auth";
import type { NextApiRequest, NextApiResponse } from "next";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import GitHubProvider from "next-auth/providers/github";
import { PrismaAdapter } from "@auth/prisma-adapter";
import type { Adapter } from "next-auth/adapters";
import { prisma } from "@/server/db/prisma";
import { rateLimiters } from "@/server/middleware/ratelimit";
import bcrypt from "bcryptjs";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      image?: string | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
  }
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as Adapter,

  providers: [
    // Credentials provider for email/password login
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials): Promise<User | null> {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Email and password required");
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });

        if (!user || !user.passwordHash) {
          // Use same error for both cases to prevent user enumeration
          throw new Error("Invalid credentials");
        }

        const isValid = await bcrypt.compare(
          credentials.password,
          user.passwordHash
        );
        if (!isValid) {
          throw new Error("Invalid credentials");
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
        };
      },
    }),

    // Google OAuth (if configured)
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          }),
        ]
      : []),

    // GitHub OAuth (if configured)
    ...(process.env.GITHUB_ID && process.env.GITHUB_SECRET
      ? [
          GitHubProvider({
            clientId: process.env.GITHUB_ID,
            clientSecret: process.env.GITHUB_SECRET,
          }),
        ]
      : []),
  ],

  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },

  // Cookie security settings
  // Use secure cookies only when actually on HTTPS (not just NODE_ENV=production)
  // This allows running production builds locally over HTTP for testing
  cookies: {
    sessionToken: {
      name: process.env.NEXTAUTH_URL?.startsWith("https://")
        ? "__Secure-next-auth.session-token"
        : "next-auth.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NEXTAUTH_URL?.startsWith("https://") ?? false,
      },
    },
  },

  // Use default NextAuth pages (we handle login in the index page)
  // pages: {
  //   signIn: "/auth/signin",
  //   error: "/auth/error",
  // },

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },

    async session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
      }
      return session;
    },

    async signIn({ user, account }) {
      // Allow credentials signin without additional checks
      if (account?.provider === "credentials") {
        return true;
      }

      // For OAuth providers, ensure user exists or will be created
      if (user.email) {
        return true;
      }

      return false;
    },
  },

  events: {
    async signIn({ user, account }) {
      // Log auth events to audit log
      if (user.id) {
        // Get user's first org for audit context (or create audit without org)
        const membership = await prisma.membership.findFirst({
          where: { userId: user.id },
        });

        if (membership) {
          await prisma.auditEvent.create({
            data: {
              orgId: membership.orgId,
              actorId: user.id,
              action: "auth.login",
              targetType: "user",
              targetId: user.id,
              metadata: { provider: account?.provider || "credentials" },
            },
          });
        }
      }
    },
  },

  debug: process.env.NODE_ENV === "development",
};

const authHandler = NextAuth(authOptions);

// Only rate limit actual login attempts (POST to callback/credentials)
// Don't rate limit session checks, CSRF tokens, or other read operations
function handler(req: NextApiRequest, res: NextApiResponse) {
  // Check if this is a login attempt (POST to credentials callback)
  const isLoginAttempt =
    req.method === "POST" && req.url?.includes("/callback/credentials");

  if (isLoginAttempt) {
    // Apply strict rate limiting to login attempts only (10/min for brute-force protection)
    return rateLimiters.auth(authHandler)(req, res);
  }

  // All other auth routes (session, csrf, signout) - no rate limiting
  return authHandler(req, res);
}

export default handler;
