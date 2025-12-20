// pages/api/auth/[...nextauth].js

import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import FacebookProvider from "next-auth/providers/facebook";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Server-side Supabase (secure)
const supabaseServer =
  SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    : null;

// Client-side Supabase (read-only checks)
const supabaseClient =
  SUPABASE_URL && SUPABASE_ANON_KEY
    ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null;

export const authOptions = {
  providers: [
    // ✅ GOOGLE (unchanged)
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      authorization: {
        params: {
          prompt: "consent",
          access_type: "offline",
          response_type: "code",
          scope:
            "openid email profile https://www.googleapis.com/auth/adwords",
        },
      },
    }),

    // ✅ FACEBOOK (fixed + clean)
    FacebookProvider({
      clientId: process.env.FACEBOOK_CLIENT_ID,
      clientSecret: process.env.FACEBOOK_CLIENT_SECRET,
      authorization: {
        params: {
          scope: "email,public_profile",
        },
      },
    }),
  ],

  secret: process.env.NEXTAUTH_SECRET,

  callbacks: {
    // 🔐 SIGN-IN CONTROL
    async signIn({ user, account }) {
      // ✅ Allow ALL Facebook logins (reviewers / testers)
      if (account?.provider === "facebook") {
        return true;
      }

      // 🔒 Google login → whitelist check
      const email = user?.email?.toLowerCase().trim();
      if (!email || !supabaseClient) return false;

      const { data, error } = await supabaseClient
        .from("allowed_users")
        .select("role")
        .eq("email", email)
        .maybeSingle();

      if (error || !data) return false;
      return true;
    },

    // 🧠 JWT
    async jwt({ token, user, account }) {
      if (account) {
        token.accessToken = account.access_token || token.accessToken;
        if (account.refresh_token) {
          token.refreshToken = account.refresh_token;
        }
      }

      if (user?.email && supabaseClient) {
        const { data } = await supabaseClient
          .from("allowed_users")
          .select("role")
          .eq("email", user.email.toLowerCase().trim())
          .maybeSingle();

        token.role = data?.role || "client";
      }

      return token;
    },

    // 🧾 SESSION
    async session({ session, token }) {
      session.user.role = token?.role || "client";
      session.accessToken = token?.accessToken;
      session.refreshToken = token?.refreshToken;
      return session;
    },
  },

  session: {
    strategy: "jwt",
  },

  pages: {
    signIn: "/auth/signin",
  },

  events: {
    // 💾 SAVE GOOGLE REFRESH TOKEN (unchanged logic, safer guards)
    async signIn({ user, account }) {
      if (
        account?.provider !== "google" ||
        !account?.refresh_token ||
        !user?.email ||
        !supabaseServer
      )
        return;

      const email = user.email.toLowerCase().trim();

      const upsertObj = {
        email,
        refresh_token: account.refresh_token,
        access_token: null,
        customer_id: null,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabaseServer
        .from("google_connections")
        .upsert(upsertObj, { onConflict: ["email"] });

      if (error) {
        console.error("Google refresh token save failed:", error);
      }
    },
  },
};

export default NextAuth(authOptions);
