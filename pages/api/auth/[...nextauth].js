// pages/api/auth/[...nextauth].js

import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";

// Whitelisted emails (owners)
const allowedEmails = [
  "ndantare@gmail.com",
  "aniketakki17@gmail.com",
  "ankitakasundra92@gmail.com",
  "doctorsdantare@gmail.com",
].map((e) => e.toLowerCase());

export const authOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],

  secret: process.env.NEXTAUTH_SECRET,

  callbacks: {
    // Only allow specific email addresses to sign in
    async signIn({ user }) {
      const email = user?.email?.toLowerCase();
      if (!email) return false;

      // Block anyone not on the allowed list
      if (!allowedEmails.includes(email)) {
        return false;
      }

      return true;
    },

    // Attach a simple role to the JWT
    async jwt({ token, user }) {
      const email = (user?.email || token?.email || "").toLowerCase();

      if (email && allowedEmails.includes(email)) {
        token.role = "owner"; // your own accounts
      } else if (email) {
        token.role = "client"; // for future non-owner users
      } else {
        token.role = "guest";
      }

      return token;
    },

    // Expose role on the session object for the frontend
    async session({ session, token }) {
      if (token?.role) {
        session.user.role = token.role;
      }
      return session;
    },
  },

  session: {
    strategy: "jwt",
  },
};

export default NextAuth(authOptions);
