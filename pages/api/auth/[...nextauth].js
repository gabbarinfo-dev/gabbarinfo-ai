// pages/api/auth/[...nextauth].js
import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
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
    // 1️⃣ On sign-in: check allowed_users, ensure profile & credits exist
    async signIn({ user }) {
      const email = user?.email?.toLowerCase();
      if (!email) return false;

      try {
        // Check allowed_users
        const { data: allowed, error: allowedErr } = await supabase
          .from("allowed_users")
          .select("role")
          .eq("email", email)
          .maybeSingle();

        if (allowedErr) {
          console.error("allowed_users lookup error:", allowedErr);
          return false;
        }

        if (!allowed) {
          console.warn("Sign-in blocked, not in allowed_users:", email);
          return false;
        }

        const role = allowed.role || "client";

        // Ensure profile exists
        let userId;
        const { data: profile, error: profileErr } = await supabase
          .from("profiles")
          .select("id")
          .eq("email", email)
          .maybeSingle();

        if (profileErr) {
          console.error("Profile lookup error:", profileErr);
          return false;
        }

        if (!profile) {
          const { data: insertedProfile, error: insertProfileErr } =
            await supabase
              .from("profiles")
              .insert({ email })
              .select("id")
              .single();

          if (insertProfileErr) {
            console.error("Profile insert error:", insertProfileErr);
            return false;
          }

          userId = insertedProfile.id;
        } else {
          userId = profile.id;
        }

        // Ensure credits row exists (default 30 for clients, 0 for owner)
        const { data: creditsRow, error: creditsErr } = await supabase
          .from("credits")
          .select("credits_left")
          .eq("user_id", userId)
          .maybeSingle();

        let creditsLeft;

        if (creditsErr) {
          console.error("Credits lookup error:", creditsErr);
          return false;
        }

        if (!creditsRow) {
          const initialCredits = role === "client" ? 30 : 0;

          const { data: insertedCredits, error: insertCreditsErr } =
            await supabase
              .from("credits")
              .insert({
                user_id: userId,
                email,
                credits_left: initialCredits,
              })
              .select("credits_left")
              .single();

          if (insertCreditsErr) {
            console.error("Credits insert error:", insertCreditsErr);
            return false;
          }

          creditsLeft = insertedCredits.credits_left;
        } else {
          creditsLeft = creditsRow.credits_left;
        }

        // Attach to user for jwt()
        user.role = role;
        user.credits = creditsLeft;

        return true;
      } catch (err) {
        console.error("signIn callback error:", err);
        return false;
      }
    },

    // 2️⃣ Put role and credits into JWT
    async jwt({ token, user }) {
      if (user?.role) {
        token.role = user.role;
      }
      if (typeof user?.credits === "number") {
        token.credits = user.credits;
      }
      return token;
    },

    // 3️⃣ Expose role & credits in session for frontend
    async session({ session, token }) {
      if (!session.user) session.user = {};
      if (token?.role) {
        session.user.role = token.role;
      }
      if (typeof token?.credits === "number") {
        session.user.credits = token.credits;
      }
      return session;
    },
  },

  session: {
    strategy: "jwt",
  },

  pages: {
    signIn: "/auth/signin", // if you have a custom page
  },
};

export default NextAuth(authOptions);
