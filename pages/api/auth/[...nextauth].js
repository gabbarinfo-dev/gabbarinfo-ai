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

    FacebookProvider({
      clientId: process.env.FACEBOOK_CLIENT_ID,
      clientSecret: process.env.FACEBOOK_CLIENT_SECRET,
      authorization: {
        params: {
          scope: "email,public_profile",
        },
      },
      profile(profile) {
        const rawEmail = profile.email ? String(profile.email).toLowerCase().trim() : null;
        // Deterministic synthetic email for Facebook users registered with phone number only
        const syntheticEmail = `fb_${profile.id}@facebook.gabbarinfo.ai`;
        return {
          id: String(profile.id),
          name: profile.name,
          email: rawEmail || syntheticEmail,
          image: profile.picture?.data?.url || null,
        };
      },
    }),
  ],

  secret: process.env.NEXTAUTH_SECRET,

  callbacks: {
    // 🔐 SIGN-IN CONTROL (Open to all Google and Facebook users)
    async signIn({ user, account }) {
      const email = user?.email?.toLowerCase().trim();
      if (!email) return false;

      // Auto-provision user in allowed_users and credits if not present
      if (supabaseServer) {
        try {
          const { data: existingUser } = await supabaseServer
            .from("allowed_users")
            .select("role")
            .eq("email", email)
            .maybeSingle();

          if (!existingUser) {
            await supabaseServer
              .from("allowed_users")
              .insert({ email, role: "client" });
          }

          const { data: creditRow } = await supabaseServer
            .from("credits")
            .select("credits_left")
            .eq("email", email)
            .maybeSingle();

          if (!creditRow) {
            await supabaseServer
              .from("credits")
              .insert({ email, credits_left: 30 });
          }
        } catch (dbErr) {
          console.warn("Auto-provision user in allowed_users / credits error:", dbErr.message);
        }
      }

      return true;
    },

    // 🧠 JWT
    async jwt({ token, user, account }) {
      if (account) {
        token.accessToken = account.access_token || token.accessToken;
        if (account.refresh_token) {
          token.refreshToken = account.refresh_token;
        }
        token.provider = account.provider;
      }

      if (user) {
        token.sub = String(user.id || token.sub);
        if (user.email) {
          token.email = user.email.toLowerCase().trim();
        }
      }

      // 🔍 FALLBACK: Check for user-defined email override in user_email_overrides
      if (token.sub && supabaseServer) {
        try {
          const { data } = await supabaseServer
            .from("user_email_overrides")
            .select("email")
            .eq("provider_id", token.sub)
            .maybeSingle();
          
          if (data?.email) {
            token.email = data.email.toLowerCase().trim();
          }
        } catch (_) {}
      }

      // If token still lacks an email but has a sub from Facebook, assign synthetic fallback
      if (!token.email && token.sub) {
        token.email = `fb_${token.sub}@facebook.gabbarinfo.ai`;
      }

      if (token.email && supabaseClient) {
        try {
          const { data } = await supabaseClient
            .from("allowed_users")
            .select("role")
            .eq("email", token.email.toLowerCase().trim())
            .maybeSingle();

          token.role = data?.role || "client";
        } catch (_) {
          token.role = token.role || "client";
        }
      } else {
        token.role = token.role || "client";
      }

      return token;
    },

    // 🧾 SESSION
    async session({ session, token }) {
      session.user.role = token?.role || "client";
      session.user.id = token?.sub; 
      session.user.email = token?.email || session.user.email;
      session.accessToken = token?.accessToken;
      session.refreshToken = token?.refreshToken;
      session.provider = token?.provider;
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
    // 💾 SAVE GOOGLE REFRESH TOKEN
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
        .upsert(upsertObj, { onConflict: "email" });

      if (error) {
        console.error("Google refresh token save failed:", error);
      }
    },
  },
};

export default NextAuth(authOptions);

