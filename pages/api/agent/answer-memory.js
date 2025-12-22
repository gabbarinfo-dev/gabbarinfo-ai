// pages/api/agent/answer-memory.js

import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, message: "POST only" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) {
    return res.status(401).json({ ok: false, message: "Unauthorized" });
  }

  const {
    business_id,
    answers = {}, // { budget_per_day, total_days, location, objective, approval }
  } = req.body || {};

  if (!business_id) {
    return res.status(400).json({
      ok: false,
      message: "business_id is required",
    });
  }

  const email = session.user.email.toLowerCase();

  // Read existing memory (if any)
  const { data: existing } = await supabase
    .from("agent_memory")
    .select("content")
    .eq("email", email)
    .eq("memory_type", "client")
    .maybeSingle();

  let content = {};
  try {
    content = existing?.content ? JSON.parse(existing.content) : {};
  } catch {
    content = {};
  }

  // Ensure per-business namespace
  content.business_answers = content.business_answers || {};
  content.business_answers[business_id] = {
    ...(content.business_answers[business_id] || {}),
    ...answers,
    updated_at: new Date().toISOString(),
  };

  await supabase.from("agent_memory").upsert(
    {
      email,
      memory_type: "client",
      content: JSON.stringify(content),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "email,memory_type" }
  );

  return res.status(200).json({
    ok: true,
    saved_for_business: business_id,
    answers: content.business_answers[business_id],
  });
}
