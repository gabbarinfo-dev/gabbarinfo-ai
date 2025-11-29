// pages/api/auth/[...nextauth].js
import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";

// Read allowed emails from env variable (comma-separated)
const allowedEmails =
  (process.env.ALLOWED_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

export default NextAuth({
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],

  // Already set in Vercel
  secret: process.env.NEXTAUTH_SECRET,

  callbacks: {
    // 1) Block sign-in if email is not in allowed list
    async signIn({ user }) {
      const email = user?.email?.toLowerCase();
      if (!email) return false;

      // If ALLOWED_EMAILS is set, only those emails can login
      if (allowedEmails.length > 0 && !allowedEmails.includes(email)) {
        return false; // NextAuth will show "Access Denied"
      }

      return true;
    },

    // 2) Put a role into the JWT token
    async jwt({ token, user }) {
      const email = (user?.email || token?.email || "").toLowerCase();

      if (allowedEmails.includes(email)) {
        // For now: all allowed emails are "owner"
        token.role = "owner";
      } else {
        token.role = "guest";
      }

      return token;
    },

    // 3) Expose the role to the frontend (session.user.role)
    async session({ session, token }) {
      if (!session.user) session.user = {};
      if (token?.role) {
        session.user.role = token.role;
      }
      return session;
    },
  },

  session: {
    strategy: "jwt",
  },

  // Use your custom sign-in page (already created)
  pages: {
    signIn: "/auth/signin",
  },
});
