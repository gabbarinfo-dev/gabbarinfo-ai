// pages/api/auth/[...nextauth].js
import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";

// Read allowed emails from Vercel env: ALLOWED_EMAILS
// Example value in Vercel: "ndantare@gmail.com, aniketakki17@gmail.com, ankitakasundra92@gmail.com, doctorsdantare@gmail.com"
const allowedEmails = (process.env.ALLOWED_EMAILS || "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export const authOptions = {
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
      if (!email) return false;

      // Only allow emails from ALLOWED_EMAILS
      if (allowedEmails.length > 0 && !allowedEmails.includes(email)) {
        return false; // AccessDenied
      }

      return true;
    },

    async jwt({ token, user }) {
      const email = (user?.email || token?.email || "").toLowerCase();

      if (allowedEmails.includes(email)) {
        token.role = "owner"; // you + other admin emails
      } else {
        token.role = "client";
      }

      return token;
    },

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

  pages: {
    signIn: "/auth/signin", // your custom sign-in page
  },
};

export default NextAuth(authOptions);
