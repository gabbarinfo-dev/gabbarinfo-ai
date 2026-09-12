import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { supabaseServer } from "../../../lib/supabaseServer";

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  const userEmail = session?.user?.email || req.query?.userEmail;

  if (!userEmail) {
    return res.json({ connected: false });
  }

  const { data, error } = await supabaseServer
    .from("meta_connections")
    .select("*")
    .eq("email", userEmail)
    .maybeSingle(); // 👈 IMPORTANT

  if (error) {
    return res.json({ connected: false });
  }

  return res.json({
    connected: !!data,
    meta: data,
  });
}
