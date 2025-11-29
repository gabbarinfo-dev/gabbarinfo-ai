// pages/api/auth/[...nextauth].js

import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Whitelisted emails
const allowedEmails = [
  "ndantare@gmail.com",
  "aniket_akki17@gmail.com",
  "ankitakasundra92@gmail.com",
  "doctorsdantare@gmail.com",
].map((e) => e.toLowerCase());

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
      if (!email || !allowedEmails.includes(email)) {
        return false;
      }

      // 1) Ensure profile exists
      await supabase.from("profiles").upsert({
        id: user.id,
        full_name: user.name || "",
        email,
      });

      // 2) Ensure credits row exists
      const { data: credits } = await supabase
        .from("credits")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!credits) {
        await supabase.from("credits").insert({
          user_id: user.id,
          credits_left: 20,
        });
      }

      return true;
    },

    async jwt({ token, user }) {
      const email = (user?.email || token?.email || "").toLowerCase();
      token.role = allowedEmails.includes(email) ? "owner" : "user";
      return token;
    },

    async session({ session, token }) {
      session.user.role = token.role;
      return session;
    },
  },

  session: {
    strategy: "jwt",
  },
};

// Default export for NextAuth
export default NextAuth(authOptions);
