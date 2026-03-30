/**
 * auth.ts — Auth.js v5 Configuration
 *
 * GitHub OAuth provider. JWT sessions (stateless, no DB needed).
 * Stores the user's GitHub access token in the JWT so we can
 * use it for GitHub API calls (per-user rate limits).
 */

import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    GitHub({
      clientId: process.env.AUTH_GITHUB_ID,
      clientSecret: process.env.AUTH_GITHUB_SECRET,
      authorization: {
        params: {
          scope: "read:user user:email",
        },
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account, profile }) {
      if (account && profile) {
        token.accessToken = account.access_token;
        token.githubId = (profile as Record<string, unknown>).id as number;
        token.login = (profile as Record<string, unknown>).login as string;
      }
      return token;
    },
    async session({ session, token }) {
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
});
