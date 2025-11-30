// pages/api/auth/[...nextauth].js
import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";

// Define owners and clients separately
const ownerEmails = ["ndantare@gmail.com"].map((e) => e.toLowerCase());

const clientEmails = [
  "aniketakki17@gmail.com",
  "ankitakasundra92@gmail.com",
  "doctorsdantare@gmail.com",
].map((e) => e.toLowerCase());

// All emails allowed to log in
const allowedEmails = [...ownerEmails, ...clientEmails];

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

      // Only allow defined emails
      if (!allowedEmails.includes(email)) {
        return false; // AccessDenied
      }

      return true;
    },

    async jwt({ token, user }) {
      const email = (user?.email || token?.email || "").toLowerCase();

      if (ownerEmails.includes(email)) {
        token.role = "owner"; // you
      } else if (clientEmails.includes(email)) {
        token.role = "client"; // your clients
      } else {
        token.role = "guest";
      }

      return token;
    },

    async session({ session, token }) {
      session.user.role = token.role || "guest";
      return session;
    },
  },

  session: {
    strategy: "jwt",
  },

  pages: {
    signIn: "/auth/signin",
  },
};

export default NextAuth(authOptions);
