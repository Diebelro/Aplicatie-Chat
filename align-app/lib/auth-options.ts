import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import FacebookProvider from "next-auth/providers/facebook";
import AppleProvider from "next-auth/providers/apple";
import AzureADProvider from "next-auth/providers/azure-ad";
import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/auth";
import { resolveNextAuthRedirect } from "@/lib/auth-redirect";
import {
  prismaEnsureOwnerAdminRole,
  prismaFindOrCreateOAuthUser,
  prismaFindUserByEmailForLogin,
} from "@/lib/repo-prisma";

const NEXTAUTH_SECRET_BUILD_PLACEHOLDER =
  "align-missing-nextauth-secret-build-placeholder-min-32-chars-xxxx";

/**
 * Fără secret, NextAuth pică la `/api/auth/session` → în browser apare [CLIENT_FETCH_ERROR] cu mesaj gol.
 * Pe Vercel Preview, `next build` rulează uneori fără NEXTAUTH_SECRET în env-ul de build — folosim placeholder
 * doar când VERCEL_ENV nu e `production`; pe producție Vercel secretul rămâne obligatoriu.
 */
function resolveNextAuthSecret(): string {
  const s = process.env.NEXTAUTH_SECRET?.trim();
  if (s) return s;
  if (process.env.NODE_ENV !== "production") {
    return "align-local-dev-nextauth-secret-min-32-chars-do-not-use-in-prod";
  }
  if (process.env.VERCEL === "1") {
    if (process.env.VERCEL_ENV === "production") {
      throw new Error("NEXTAUTH_SECRET este obligatoriu în producție (Vercel / .env).");
    }
    return NEXTAUTH_SECRET_BUILD_PLACEHOLDER;
  }
  throw new Error("NEXTAUTH_SECRET este obligatoriu în producție (Vercel / .env).");
}

function buildOAuthProviders(): NonNullable<NextAuthOptions["providers"]> {
  const list: NonNullable<NextAuthOptions["providers"]> = [];
  if (process.env.GOOGLE_CLIENT_ID?.trim() && process.env.GOOGLE_CLIENT_SECRET?.trim()) {
    list.push(
      GoogleProvider({
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      })
    );
  }
  if (process.env.FACEBOOK_CLIENT_ID?.trim() && process.env.FACEBOOK_CLIENT_SECRET?.trim()) {
    list.push(
      FacebookProvider({
        clientId: process.env.FACEBOOK_CLIENT_ID,
        clientSecret: process.env.FACEBOOK_CLIENT_SECRET,
      })
    );
  }
  if (process.env.APPLE_ID?.trim() && process.env.APPLE_SECRET?.trim()) {
    list.push(
      AppleProvider({
        clientId: process.env.APPLE_ID,
        clientSecret: process.env.APPLE_SECRET,
      })
    );
  }
  if (process.env.AZURE_AD_CLIENT_ID?.trim() && process.env.AZURE_AD_CLIENT_SECRET?.trim()) {
    list.push(
      AzureADProvider({
        clientId: process.env.AZURE_AD_CLIENT_ID,
        clientSecret: process.env.AZURE_AD_CLIENT_SECRET,
        tenantId: process.env.AZURE_AD_TENANT_ID?.trim() || "common",
      })
    );
  }
  return list;
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Email și parolă",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Parolă", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password || !process.env.DATABASE_URL) return null;
        try {
          const user = await prisma.user.findUnique({
            where: { email: credentials.email.trim().toLowerCase() },
            include: { profile: true },
          });
          if (!user?.passwordHash || !user.profile) return null;
          const ok = verifyPassword(credentials.password, user.passwordHash);
          if (!ok) return null;
          return {
            id: user.id,
            email: user.email,
            profileComplete: !!user.profile.completedAt,
          };
        } catch {
          return null;
        }
      },
    }),
    ...buildOAuthProviders(),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (!account || account.provider === "credentials") return true;
      if (!process.env.DATABASE_URL) return false;
      try {
        const email = user.email?.trim().toLowerCase();
        if (!email) return false;
        const row = await prismaFindUserByEmailForLogin(email);
        if (row?.isBanned) {
          return `/cont-blocat?email=${encodeURIComponent(email)}`;
        }
        const { id, profileComplete } = await prismaFindOrCreateOAuthUser({
          email,
          name: user.name,
        });
        await prismaEnsureOwnerAdminRole(id, email);
        user.id = id;
        (user as { profileComplete?: boolean }).profileComplete = profileComplete;
        return true;
      } catch (e) {
        console.error("[nextauth signIn oauth]", e);
        return false;
      }
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.profileComplete = (user as { profileComplete?: boolean }).profileComplete ?? false;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { id?: string }).id = token.id as string;
        (session.user as { profileComplete?: boolean }).profileComplete = token.profileComplete as boolean;
      }
      return session;
    },
    redirect({ url, baseUrl }) {
      return resolveNextAuthRedirect(url, baseUrl);
    },
  },
  pages: {
    signIn: "/login",
  },
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  secret: resolveNextAuthSecret(),
  /** Loguri detaliate NextAuth în terminal (sesiune / erori) — ajută la CLIENT_FETCH_ERROR. */
  debug: process.env.NODE_ENV === "development" || process.env.AUTH_DEBUG === "1",
};
