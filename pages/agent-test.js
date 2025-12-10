// pages/agent-test.js
import { useState } from "react";

export default function AgentTest() {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  async function callAgent(body) {
    setLoading(true);
    setResult(null);

    try {
      const res = await fetch("/api/agent/run", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      const json = await res.json();
      setResult(json);
    } catch (err) {
      setResult({
        ok: false,
        message: "Request failed",
        error: err.message,
      });
    } finally {
      setLoading(false);
    }
  }

  async function runGoogleTest() {
    await callAgent({
      platform: "google",
      action: "create_simple_campaign",
      payload: {
        customerId: "8060320443", // your MCC / test account
        campaign: {
          name: "Test AI Agent Campaign",
          network: "SEARCH",
          dailyBudgetMicros: 5000000, // 5 INR (just dummy)
          finalUrl: "https://www.gabbarinfo.com/",
        },
        adGroups: [
          {
            name: "Test Ad Group 1",
            cpcBidMicros: 1000000,
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
    });
  }

  async function runMetaTest() {
    await callAgent({
      platform: "meta",
      action: "create_simple_campaign",
      payload: {
        objective: "AWARENESS",
        testNote: "Stub call from /agent-test on meta",
      },
    });
  }

  return (
    <div style={{ padding: "2rem", fontFamily: "system-ui" }}>
      <h1>Agent Test Console</h1>

      <p>
        This page calls <code>/api/agent/run</code> with a stub payload for
        Google Ads and Meta. Right now the server just logs and returns a stub
        response.
      </p>

      <div style={{ display: "flex", gap: "1rem", marginBottom: "1rem" }}>
        <button onClick={runGoogleTest} disabled={loading}>
          {loading ? "Running…" : "Run Google Test"}
        </button>
        <button onClick={runMetaTest} disabled={loading}>
          {loading ? "Running…" : "Run Meta Test"}
        </button>
      </div>

      {result && (
        <pre
          style={{
            background: "#111",
            color: "#0f0",
            padding: "1rem",
            borderRadius: "8px",
            maxHeight: "400px",
            overflow: "auto",
          }}
        >
{JSON.stringify(result, null, 2)}
        </pre>
      )}
    </div>
  );
}
