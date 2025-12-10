// pages/agent-test.js
import { useState } from "react";

export default function AgentTest() {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  async function runGoogleTest() {
    setLoading(true);
    setResult(null);

    const res = await fetch("/api/agent/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        platform: "google",
        action: "create_google_campaign",
        payload: {
          customerId: "8060320443",
          campaign: {
            name: "Test AI Campaign",
            network: "SEARCH",
            dailyBudgetMicros: 5000000,
            finalUrl: "https://gabbarinfo.com",
          },
          adGroups: [
            {
              name: "AG 1",
              cpcBidMicros: 2000000,
              keywords: ["digital marketing", "google ads"],
              ads: [
                {
                  headline1: "GabbarInfo AI",
                  headline2: "Smart Campaigns",
                  description1: "We optimise your ads automatically.",
                },
              ],
            },
          ],
        },
      }),
    });

    const json = await res.json();
    setResult(json);
    setLoading(false);
  }

  async function runMetaTest() {
    setLoading(true);
    setResult(null);

    const res = await fetch("/api/agent/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        platform: "meta",
        action: "create_meta_campaign",
        payload: {
          adAccountId: "act_1587806431828953",
          pageId: "100857708465879",
          instagramActorId: "17841446447612686",
          objective: "LINK_CLICKS",
          campaignName: "AI Meta Test",
          adsetName: "AI Adset",
          dailyBudget: 200,
          websiteUrl: "https://gabbarinfo.com",
          message: "Test caption from GabbarInfo AI",
          imageHash: "442b13a9f677f13c20018c6155f2f20e",
        },
      }),
    });

    const json = await res.json();
    setResult(json);
    setLoading(false);
  }

  return (
    <div style={{ padding: 24 }}>
      <h1>Agent Test Panel</h1>
      <button disabled={loading} onClick={runGoogleTest}>
        Test Google Campaign (stub)
      </button>
      <button disabled={loading} onClick={runMetaTest} style={{ marginLeft: 12 }}>
        Test Meta Campaign (stub)
      </button>

      {loading && <p>Running…</p>}

      {result && (
        <pre style={{ marginTop: 20, background: "#111", color: "#0f0", padding: 16 }}>
          {JSON.stringify(result, null, 2)}
        </pre>
      )}
    </div>
  );
}
