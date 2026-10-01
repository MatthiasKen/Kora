import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { getServerSession } from "next-auth";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { isDemo, storeConfig } from "./config";
export const authOptions: NextAuthOptions = {
  secret:
    process.env.NEXTAUTH_SECRET ||
    (isDemo()
      ? "kora-public-demo-session-secret-no-live-authentication"
      : undefined),
  providers: storeConfig().googleEnabled
    ? [
        GoogleProvider({
          clientId: process.env.GOOGLE_CLIENT_ID!,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        }),
      ]
    : [],
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  pages: { signIn: "/account", error: "/account" },
  callbacks: {
    async signIn({ account, profile }) {
      return (
        account?.provider === "google" &&
        !!profile &&
        "email_verified" in profile &&
        profile.email_verified === true
      );
    },
    async jwt({ token, account, user }) {
      if (account?.provider === "google") {
        const [record] = await getDb()
          .insert(users)
          .values({
            googleId: account.providerAccountId,
            email: user.email!.toLowerCase(),
            name: user.name || "Kora customer",
            image: user.image,
          })
          .onConflictDoUpdate({
            target: users.googleId,
            set: {
              email: user.email!.toLowerCase(),
              name: user.name || "Kora customer",
              image: user.image,
            },
          })
          .returning();
        token.userId = record.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && typeof token.userId === "string")
        session.user.id = token.userId;
      return session;
    },
  },
};
export async function currentUser() {
  if (isDemo()) return null;
  return (await getServerSession(authOptions))?.user ?? null;
}
