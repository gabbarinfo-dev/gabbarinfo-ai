// pages/api/auth/[...nextauth].js
import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";

// 🔒 OWNER (you) and CLIENT emails
const OWNER_EMAILS = ["ndantare@gmail.com"].map((e) => e.toLowerCase());

const CLIENT_EMAILS = [
  "aniketakki17@gmail.com",
  "ankitakasundra92@gmail.com",
  "doctorsdantare@gmail.com",
].map((e) => e.toLowerCase());

export default NextAuth({
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],

  secret: process.env.NEXTAUTH_SECRET,

  callbacks: {
    async signIn({ user }) {
      const email = user?.email?.toLowerCase();

      // If email missing, block
      if (!email) return false;

      // Only allow owner or client emails
      if (
        !OWNER_EMAILS.includes(email) &&
        !CLIENT_EMAILS.includes(email)
      ) {
        return false; // AccessDenied
      }

      return true;
    },

    async jwt({ token, user }) {
      const email = (user?.email || token?.email || "").toLowerCase();

      if (OWNER_EMAILS.includes(email)) {
        token.role = "owner";
      } else if (CLIENT_EMAILS.includes(email)) {
        token.role = "client";
      } else {
        token.role = "guest"; // should never happen, but safe default
      }

      return token;
    },

    async session({ session, token }) {
      if (token?.role) {
        // attach role to session.user
        session.user.role = token.role;
      }
      return session;
    },
  },

  session: {
    strategy: "jwt",
  },

  pages: {
    signIn: "/auth/signin",
  },
});
