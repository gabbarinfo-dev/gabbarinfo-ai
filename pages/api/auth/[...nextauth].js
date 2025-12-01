// pages/api/auth/[...nextauth].js
import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { createClient } from "@supabase/supabase-js";

// Server-side Supabase client (for auth checks)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export const authOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],

  secret: process.env.NEXTAUTH_SECRET,

  callbacks: {
    // 1️⃣ Check if email is allowed, and get role from allowed_users
    async signIn({ user }) {
      const email = user?.email?.toLowerCase();
      if (!email) return false;

      try {
        const { data, error } = await supabase
          .from("allowed_users")
          .select("role")
          .eq("email", email)
          .maybeSingle();

        if (error) {
          console.error("allowed_users lookup error:", error);
          return false;
        }

        // No row => not allowed to sign in
        if (!data) {
          console.warn("Sign-in blocked, email not in allowed_users:", email);
          return false;
        }

        // Attach role to user object so jwt() can read it
        user.role = data.role || "client";
        return true;
      } catch (err) {
        console.error("signIn callback error:", err);
        return false;
      }
    },

    // 2️⃣ Put role into JWT token
    async jwt({ token, user }) {
      if (user?.role) {
        token.role = user.role;
      }
      return token;
    },

    // 3️⃣ Expose role in session for frontend (index.js already uses this)
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
    signIn: "/auth/signin",
  },
};

export default NextAuth(authOptions);
