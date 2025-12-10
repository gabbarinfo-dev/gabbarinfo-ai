// pages/api/auth/[...nextauth].js
import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export const authOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      // 🔹 IMPORTANT: Ask Google for Ads permission + offline tokens
      authorization: {
        params: {
          prompt: "consent", // always show consent once → get refresh token
          access_type: "offline",
          response_type: "code",
          scope:
            "openid email profile https://www.googleapis.com/auth/adwords",
        },
      },
    }),
  ],

  secret: process.env.NEXTAUTH_SECRET,

  callbacks: {
    // 1) Only allow emails that exist in allowed_users
    async signIn({ user }) {
      const email = user?.email?.toLowerCase().trim();
      if (!email) return false;

      const { data, error } = await supabase
        .from("allowed_users")
        .select("role")
        .eq("email", email)
        .maybeSingle();

      if (error) {
        console.error("Supabase error in signIn:", error);
        return false;
      }

      if (!data) {
        // not in allowed_users: hard deny
        return false;
      }

      return true;
    },

    // 2) Put role into the JWT + store Google Ads tokens
    async jwt({ token, user, account }) {
      // ----------------------------------------------------
      // A. Handle Google tokens (only when Google sends them)
      // ----------------------------------------------------
      if (account) {
        // Access token (short-lived)
        token.accessToken = account.access_token || token.accessToken;

        // Refresh token only comes the first time user grants consent
        if (account.refresh_token) {
          token.refreshToken = account.refresh_token;
        }

        // 🧠 Persist tokens in Supabase so backend / agent can use them later
        try {
          const email =
            (user?.email || token?.email || "").toLowerCase().trim() || null;

          if (email) {
            const expiresAt =
              account.expires_at != null
                ? new Date(account.expires_at * 1000).toISOString()
                : null;

            // You should have a table like:
            // google_connections(email text primary key, access_token text, refresh_token text, expires_at timestamptz, updated_at timestamptz)
            const { error: upsertError } = await supabase
              .from("google_connections")
              .upsert(
                {
                  email,
                  access_token: account.access_token || null,
                  refresh_token: account.refresh_token || null,
                  expires_at: expiresAt,
                  updated_at: new Date().toISOString(),
                },
                { onConflict: "email" }
              );

            if (upsertError) {
              console.error("Supabase upsert error (google_connections):", upsertError);
            }
          }
        } catch (e) {
          console.error("Error while persisting Google tokens:", e);
        }
      }

      // ----------------------------------------------------
      // B. Existing role logic – unchanged
      // ----------------------------------------------------
      if (user?.email) {
        const email = user.email.toLowerCase().trim();

        try {
          const { data, error } = await supabase
            .from("allowed_users")
            .select("role")
            .eq("email", email)
            .maybeSingle();

          if (error) {
            console.error("Supabase error in jwt:", error);
          }

          if (data?.role) {
            const r = data.role.toLowerCase();
            token.role = r === "owner" ? "owner" : "client";
          } else {
            token.role = "client";
          }
        } catch (e) {
          console.error("Unexpected error in jwt role fetch:", e);
        }
      }

      return token;
    },

    // 3) Expose role on session.user.role + expose tokens on session
    async session({ session, token }) {
      // role (existing behaviour)
      if (token?.role) {
        session.user.role = token.role;
      } else {
        session.user.role = "client";
      }

      // 🔹 Make tokens available to our API routes later (if you need them from client side)
      if (token?.accessToken) {
        session.accessToken = token.accessToken;
      }
      if (token?.refreshToken) {
        session.refreshToken = token.refreshToken;
      }

      return session;
    },
  },

  session: {
    strategy: "jwt",
  },

  pages: {
    signIn: "/auth/signin",
    // error page can stay default
  },
};

export default NextAuth(authOptions);
