// pages/api/credits/topup.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// helper to actually change credits
async function setCreditsForEmail(email, delta) {
  const lowerEmail = email.trim().toLowerCase();

  // fetch existing row
  const { data, error } = await supabase
    .from("credits")
    .select("id, credits_left")
    .eq("email", lowerEmail)
    .maybeSingle();

  if (error) {
    console.error("Supabase select error in topup:", error);
    throw new Error("Database error (select)");
  }

  let current = data?.credits_left ?? 0;
  let next = current + delta;
  if (next < 0) next = 0; // don't go negative

  if (data?.id) {
    const { error: updateError } = await supabase
      .from("credits")
      .update({
        credits_left: next,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.id);

    if (updateError) {
      console.error("Supabase update error in topup:", updateError);
      throw new Error("Database error (update)");
    }
  } else {
    const { error: insertError } = await supabase.from("credits").insert({
      email: lowerEmail,
      credits_left: next,
    });

    if (insertError) {
      console.error("Supabase insert error in topup:", insertError);
      throw new Error("Database error (insert)");
    }
  }

  return { email: lowerEmail, credits: next };
}

export default async function handler(req, res) {
  // Only owners are allowed to top up
  const session = await getServerSession(req, res, authOptions);
  const role = session?.user?.role || "client";

  if (!session || role !== "owner") {
    return res.status(403).json({ error: "Forbidden" });
  }

  // Support both GET (via URL) and POST (via JSON body)
  let email;
  let amount;

  if (req.method === "GET") {
    email = req.query.email;
    amount = Number(req.query.amount ?? "0");
  } else if (req.method === "POST") {
    email = req.body?.email;
    amount = Number(req.body?.amount ?? 0);
  } else {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!email || !email.trim()) {
    return res.status(400).json({ error: "Missing email" });
  }

  if (!Number.isFinite(amount) || amount === 0) {
    return res
      .status(400)
      .json({ error: "Amount must be a non-zero number (e.g. 10 or -5)" });
  }

  try {
    const result = await setCreditsForEmail(email, amount);
    return res.status(200).json({
      email: result.email,
      credits: result.credits,
      delta: amount,
    });
  } catch (err) {
    console.error("TOPUP ERROR:", err);
    return res.status(500).json({
      error: "Server error during topup",
      details: err?.message || String(err),
    });
  }
}
