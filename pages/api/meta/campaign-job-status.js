// pages/api/meta/campaign-job-status.js
import { getMetaCampaignJobStatus } from "../../../lib/railway/dispatch-meta-campaign";

export default async function handler(req, res) {
  const jobId = req.query.jobId || req.body?.jobId;

  if (!jobId) {
    return res.status(400).json({ ok: false, error: "Missing required jobId parameter" });
  }

  try {
    const jobData = await getMetaCampaignJobStatus(jobId);
    if (!jobData || !jobData.ok) {
      return res.status(404).json({
        ok: false,
        error: jobData?.error || "Job not found or worker unreachable",
      });
    }

    return res.status(200).json(jobData);
  } catch (err) {
    console.error("[CampaignJobStatus] Error querying job:", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
