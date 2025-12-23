import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]";
import { supabase } from "../../../lib/supabaseServer";

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) {
    return res.json({ connected: false });
  }

  const { data } = await supabase
    .from("meta_connections")
    .select("*")
    .eq("email", session.user.email)
    .single();

  return res.json({
    connected: !!data,
    meta: data || null,
  });
}
