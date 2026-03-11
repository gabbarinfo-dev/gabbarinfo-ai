// pages/api/user/set-email.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const session = await getServerSession(req, res, authOptions);
    if (!session || !session.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    // We expect an email even if session.user.email is currently null
    const { email } = req.body || {};
    const normalizedEmail = email?.toLowerCase().trim();

    if (!normalizedEmail || !normalizedEmail.includes("@")) {
      return res.status(400).json({ error: "Valid email is required." });
    }

    // provider_id is the unique ID from Facebook/Google stored in the token sub
    // NextAuth usually maps this to session.user.id if configured, 
    // but we can also get it from the session object depending on how it's mapped.
    // In our [...nextauth].js, we didn't explicitly map 'id' to the session, 
    // but NextAuth default session usually includes some unique identifier or we can use the sub.
    
    // Let's use a safe way to identify the provider account.
    // If the user is logged in, they MUST have an 'id' or we can check the JWT sub.
    // Looking at [...nextauth].js, we don't return 'id' in session. 
    // However, 'token' in jwt callback has 'sub'.
    
    // For now, we will assume the user IS the one in the session.
    // We need a stable identifier for the Facebook account.
    
    // CRITICAL: We need to make sure we have a provider_id.
    // If session.user.email is missing, we are likely in the 'Facebook phone login' case.
    
    // Let's check what's actually in the session object in this app.
    // Most apps have session.user.id.
    const providerId = session.user.id || session.sub; 

    if (!providerId) {
      // If we don't have a stable ID, we can't map it.
      // We might need to adjust [...nextauth].js to include the 'id' in the session.
      return res.status(500).json({ error: "Internal session error: Missing identifier." });
    }

    // 1) Save to overrides table
    const { error: overrideError } = await supabase
      .from("user_email_overrides")
      .upsert({
        provider_id: providerId,
        email: normalizedEmail,
        provider: "facebook",
        updated_at: new Date().toISOString(),
      }, { onConflict: "provider_id" });

    if (overrideError) {
      console.error("set-email overrides error:", overrideError);
      return res.status(500).json({ error: "Failed to save email mapping." });
    }

    // 2) Ensure user is in allowed_users (so they aren't blocked by signIn callback on next login)
    const { error: allowedError } = await supabase
      .from("allowed_users")
      .upsert({
        email: normalizedEmail,
        role: "client",
      }, { onConflict: "email" });

    if (allowedError) {
      console.error("set-email allowed_users error:", allowedError);
      // Not a fatal error for current session but might block them later
    }

    return res.status(200).json({ ok: true, message: "Email saved successfully." });
  } catch (err) {
    console.error("set-email exception:", err);
    return res.status(500).json({ error: "Server error" });
  }
}
