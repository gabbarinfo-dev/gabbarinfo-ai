import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  try {
    const session = await getServerSession(req, res, authOptions);
    if (!session || session.user?.role !== "owner") {
      return res.status(403).json({ success: false });
    }

    const { data, error } = await supabase
      .from("allowed_users")
      .select("email, role")
      .eq("role", "client")
      .order("email");

    if (error) {
      return res.status(500).json({ success: false });
    }

    return res.status(200).json({
      success: true,
      users: data || [],
    });
  } catch {
    return res.status(500).json({ success: false });
  }
}
