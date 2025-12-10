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
        action: "create_simple_campaign",
        payload: {
          customerId: "8060320443",
          campaign: {
            name: "Test AI Agent Campaign",
            network: "SEARCH",
            dailyBudgetMicros: 5_000_000,
            finalUrl: "https://www.gabbarinfo.com/",
          },
          adGroups: [
            {
              name: "Test Ad Group 1",
              cpcBidMicros: 1_000_000,
              keywords: ["digital marketing agency", "google ads expert"],
              ads: [
                {
                  headline1: "Gabbarinfo Digital Solutions",
                  headline2: "Google Ads & Meta Ads",
                  description: "This is a stub test from AI agent.",
                },
              ],
            },
          ],
        },
      }),
    });

    const json = await res.json();
    setResult({ source: "google", json });
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
        action: "create_simple_campaign",
        payload: {
          adAccountId: "act_1587806431828953",   // your ad account
          pageId: "100857708465879",             // your FB page ID
          dailyBudget: 500,                      // INR 500 per day (stub)
          currency: "INR",
          targeting: {
            geo_locations: { countries: ["IN"] },
            age_min: 25,
            age_max: 45,
          },
          creative: {
            message: "Stub Meta ad from Gabbarinfo AI agent.",
            link: "https://www.gabbarinfo.com/",
          },
        },
      }),
    });

    const json = await res.json();
    setResult({ source: "meta", json });
    setLoading(false);
  }

  return (
    <div style={{ padding: "20px", fontFamily: "monospace", background: "#000", color: "#0f0", minHeight: "100vh" }}>
      <h1>Agent Test Console</h1>
      <p>
        This page calls <code>/api/agent/run</code> with a stub payload for Google Ads and Meta.
        Right now the server just logs and returns a stub response.
      </p>

      <div style={{ marginBottom: "16px" }}>
        <button onClick={runGoogleTest} disabled={loading} style={{ marginRight: "8px" }}>
          Run Google Test
        </button>
        <button onClick={runMetaTest} disabled={loading}>
          Run Meta Test
        </button>
      </div>

      {loading && <p>Running test…</p>}

      {result && (
        <pre style={{ background: "#050505", padding: "16px", borderRadius: "4px", overflowX: "auto" }}>
{JSON.stringify(result.json, null, 2)}
        </pre>
      )}
    </div>
  );
}
