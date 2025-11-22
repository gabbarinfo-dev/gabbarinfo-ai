// pages/api/auth/[...nextauth].js
import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";

export default NextAuth({
  // Providers
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],

  // IMPORTANT: set a NEXTAUTH_SECRET in Vercel env vars (see step 4 below)
  secret: process.env.NEXTAUTH_SECRET,

  // Optional: tweak pages if you want NextAuth to serve its built-in sign-in page
  pages: {
    signIn: "/api/auth/signin", // default NextAuth sign-in page
  },

  // Session & JWT settings (defaults are fine for basic usage)
  session: {
    strategy: "jwt",
  },

  // Debug in server logs while you troubleshoot (remove or set to false later)
  debug: false,
});
