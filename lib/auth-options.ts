import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/auth";

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
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.profileComplete = (user as { profileComplete?: boolean }).profileComplete;
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
      const u = url.startsWith("/") ? new URL(url, baseUrl) : new URL(url);
      if (u.origin !== baseUrl) return baseUrl;
      const path = u.pathname;
      if (path === "/api/auth/signin" || path === "/login" || path === "/signup") return `${baseUrl}/descopera`;
      return url;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  secret: process.env.NEXTAUTH_SECRET,
};
