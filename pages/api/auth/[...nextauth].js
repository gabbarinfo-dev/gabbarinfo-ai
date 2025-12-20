l// pages/api/auth/[...nextauth].js
import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import FacebookProvider from "next-auth/providers/facebook";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Minimal server-side supabase client using service role (for secure writes)
const supabaseServer =
  SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    : null;

// Optional client (unused for writes) - kept for backwards compatibility
const supabaseClient =
  SUPABASE_URL && SUPABASE_ANON_KEY ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

export const authOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      authorization: {
        params: {
          prompt: "consent",
          access_type: "offline",
          response_type: "code",
          scope: "openid email profile https://www.googleapis.com/auth/adwords",
        },
      },
    }),
    FacebookProvider({
  clientId: process.env.FB_APP_ID,
  clientSecret: process.env.FB_APP_SECRET,
  authorization: {
    params: {
      scope: "email,public_profile", 
    },
  },
}),
],

  secret: process.env.NEXTAUTH_SECRET,

  callbacks: {
  async signIn({ user, account }) {
    // ✅ Allow Facebook login WITHOUT email
    if (account?.provider === "facebook") {
      return true;
    }

    // 🔒 Google login still requires email whitelist
    const email = user?.email?.toLowerCase().trim();
    if (!email) return false;

    const { data, error } = await supabaseClient
      .from("allowed_users")
      .select("role")
      .eq("email", email)
      .maybeSingle();

    if (error || !data) return false;

    return true;
  },

  async jwt({ token, user, account }) {
    if (account) {
      token.accessToken = account.access_token || token.accessToken;
      if (account.refresh_token) {
        token.refreshToken = account.refresh_token;
      }
    }

    if (user?.email) {
      const { data } = await supabaseClient
        .from("allowed_users")
        .select("role")
        .eq("email", user.email.toLowerCase().trim())
        .maybeSingle();

      token.role = data?.role || "client";
    }

    return token;
  },

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
};

// Additional NOTE:
// We also want to save the Google refresh token into Supabase securely when a user signs in.
// NextAuth's `signIn` callback doesn't receive `account`. To reliably persist refresh_token
// we implement an additional event handler in NextAuth's `events` below. The 'signIn' event
// receives `user` and `account` data server-side — we'll use that to upsert into Supabase.

authOptions.events = {
  async signIn(message) {
    // message = { user, account, profile, isNewUser }
    try {
      const { user, account } = message || {};
      if (!user?.email) return;

      // account.refresh_token is only present the first time the user consented
      const refreshToken = account?.refresh_token || null;

      // If we have a refresh token, upsert into public.google_connections
      if (refreshToken && supabaseServer) {
        const email = user.email.toLowerCase().trim();

        // Optionally try to fetch customerId if account.provider === 'google' and account.id_token exists
        // But we will only upsert what we have: refresh_token and timestamp
        const upsertObj = {
          email,
          refresh_token: refreshToken,
          access_token: null,
          customer_id: null,
          updated_at: new Date().toISOString(),
        };

        try {
          const { error } = await supabaseServer
            .from("google_connections")
            .upsert(upsertObj, { onConflict: ["email"] });

          if (error) {
            console.error("Failed to upsert google_connections:", error);
          } else {
            console.log("Saved Google refresh token for", email);
          }
        } catch (err) {
          console.error("Exception upserting google_connections:", err);
        }
      }
    } catch (err) {
      console.error("Error in NextAuth signIn event:", err);
    }
  },
};

export default NextAuth(authOptions);
