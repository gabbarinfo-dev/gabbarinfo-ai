// pages/api/tiktok/job-status.js
import { getTikTokJobStatus } from "../../../lib/railway/dispatch-tiktok-creative";

export default async function handler(req, res) {
  const jobId = req.query.jobId || req.body?.jobId;

  if (!jobId) {
    return res.status(400).json({ ok: false, error: "Missing required jobId parameter" });
  }

  try {
    const jobData = await getTikTokJobStatus(jobId);
    if (!jobData || !jobData.ok) {
      return res.status(404).json({
        ok: false,
        error: jobData?.error || "Job not found on Railway worker",
      });
    }

    return res.status(200).json(jobData);
  } catch (err) {
    console.error("[TikTokJobStatus] Error querying job:", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
