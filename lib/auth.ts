/**
 * auth.ts — NextAuth.js Configuration
 *
 * GitHub OAuth provider. JWT sessions (stateless, no DB needed).
 * Stores the user's GitHub access token in the JWT so we can
 * use it for GitHub API calls (per-user rate limits).
 */

import type { NextAuthOptions } from "next-auth";
import GitHubProvider from "next-auth/providers/github";

if (!process.env.GITHUB_CLIENT_ID || !process.env.GITHUB_CLIENT_SECRET) {
  // Don't throw — auth is optional. Anonymous mode still works.
  console.warn(
    "[Dependency Obituary] GITHUB_CLIENT_ID or GITHUB_CLIENT_SECRET not set. Auth disabled."
  );
}

export const authOptions: NextAuthOptions = {
  providers: [
    ...(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET
      ? [
          GitHubProvider({
            clientId: process.env.GITHUB_CLIENT_ID,
            clientSecret: process.env.GITHUB_CLIENT_SECRET,
            authorization: {
              params: {
                scope: "read:user user:email",
              },
            },
          }),
        ]
      : []),
  ],
  callbacks: {
    async jwt({ token, account, profile }) {
      // On initial sign-in, persist the GitHub access token + profile data
      if (account && profile) {
        token.accessToken = account.access_token;
        token.githubId = (profile as Record<string, unknown>).id as number;
        token.login = (profile as Record<string, unknown>).login as string;
      }
      return token;
    },
    async session({ session, token }) {
      // Expose GitHub info to the client session
      return {
        ...session,
        accessToken: token.accessToken as string | undefined,
        user: {
          ...session.user,
          githubId: token.githubId as number | undefined,
          login: token.login as string | undefined,
        },
      };
    },
  },
  pages: {
    signIn: "/auth/signin",
  },
  secret: process.env.NEXTAUTH_SECRET || "dev-secret-change-in-production",
};
