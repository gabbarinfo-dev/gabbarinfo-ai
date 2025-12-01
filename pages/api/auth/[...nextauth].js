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

    // 2) Put role into the JWT
    async jwt({ token, user }) {
      // When the user logs in for the first time in a session
      if (user?.email) {
        const email = user.email.toLowerCase().trim();

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
      }

      return token;
    },

    // 3) Expose role on session.user.role
    async session({ session, token }) {
      if (token?.role) {
        session.user.role = token.role;
      } else {
        session.user.role = "client";
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
