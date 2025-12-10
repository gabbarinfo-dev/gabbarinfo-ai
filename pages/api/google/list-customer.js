// pages/api/google/list-campaigns.js
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]";
import { getGoogleAdsCustomerForEmail } from "../../../lib/googleAdsClient";

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);

  if (!session?.user?.email) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  try {
    const customer = await getGoogleAdsCustomerForEmail(session.user.email);

    // Simple example: list up to 10 campaigns
    const campaigns = await customer.campaigns.list({
      limit: 10,
      // you can add where/fields if you want
    });

    return res.status(200).json({
      ok: true,
      campaigns: campaigns.map((c) => ({
        id: c.id,
        name: c.name,
        status: c.status,
      })),
    });
  } catch (err) {
    console.error("Error in list-campaigns:", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
