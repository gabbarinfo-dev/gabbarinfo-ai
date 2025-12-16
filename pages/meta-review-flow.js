// META APP REVIEW — RECORDING 1 UI DEMO
// Permissions covered:
// business_management
// pages_show_list
// pages_read_engagement
// PURPOSE: Meta App Review screen recording ONLY
// NOTE: User is already signed in via Google (pre-condition)

import { useState } from "react";

export default function MetaReviewFlow() {
  const [stage, setStage] = useState("start");
  const [business, setBusiness] = useState("");
  const [page, setPage] = useState("");

  return (
    <div style={styles.app}>
      {/* Top Bar */}
      <header style={styles.topbar}>
        <div style={styles.logo}>Gabbarinfo AI</div>
        <div style={styles.user}>Signed in via Google</div>
      </header>

      {/* MAIN ONLY — no sidebar until page selected */}
      <main style={styles.fullContent}>

        {/* STEP 1 — CONNECT */}
        {stage === "start" && (
          <section style={styles.card}>
            <h2>Connect Facebook Business Account</h2>
            <p>Connect your Facebook business to manage pages and view insights.</p>
            <button style={styles.primaryBtn} onClick={() => setStage("business")}>Connect Facebook Business Account</button>
          </section>
        )}

        {/* STEP 2 — SELECT BUSINESS */}
        {stage === "business" && (
          <section style={styles.card}>
            <h2>Select Business</h2>
            <select style={styles.select} value={business} onChange={(e) => setBusiness(e.target.value)}>
              <option value="">-- Select Business --</option>
              <option value="gabbar">Gabbarinfo Digital Solutions</option>
              <option value="bella">Bella & Diva Jewellery</option>
            </select>
            <button disabled={!business} style={styles.primaryBtn} onClick={() => setStage("page")}>Continue</button>
          </section>
        )}

        {/* STEP 3 — SELECT PAGE */}
        {stage === "page" && (
          <section style={styles.card}>
            <h2>Select Business Page</h2>
            <select style={styles.select} value={page} onChange={(e) => setPage(e.target.value)}>
              <option value="">-- Select Page --</option>
              <option value="fb">GABBARinfo (Facebook Page)</option>
              <option value="ig">@gabbarinfo (Instagram Business)</option>
            </select>
            <button disabled={!page} style={styles.primaryBtn} onClick={() => setStage("dashboard")}>Continue</button>
          </section>
        )}

        {/* STEP 4 — DASHBOARD */}
        {stage === "dashboard" && (
          <div style={styles.dashboardWrap}>
            <aside style={styles.sidebar}>
              <div style={styles.navTitle}>GABBARinfo</div>
              <div style={styles.navItem}>Insights</div>
              <div style={styles.navItem}>Create Post</div>
              <div style={styles.navItemMuted}>Ads Manager</div>
              <div style={styles.navItemMuted}>Instagram Tools</div>
            </aside>

            <section style={styles.card}>
              <div style={styles.switchRow}>
                <strong>Insights</strong>
                <select style={styles.smallSelect} value={page} onChange={(e) => setPage(e.target.value)}>
                  <option value="fb">Facebook</option>
                  <option value="ig">Instagram</option>
                </select>
              </div>

              <div style={styles.metrics}>
                <div style={styles.metricBox}><strong>Views</strong><span>{page === "fb" ? "849" : "16.1K"}</span></div>
                <div style={styles.metricBox}><strong>Reach</strong><span>{page === "fb" ? "1.3K" : "20.3K"}</span></div>
                <div style={styles.metricBox}><strong>Engagement</strong><span>{page === "fb" ? "1,240" : "2.4K"}</span></div>
                <div style={styles.metricBox}><strong>Followers</strong><span>{page === "fb" ? "1.1K" : "4.8K"}</span></div>
              </div>

              <button style={styles.secondaryBtn} onClick={() => setStage("post")}>Create Post</button>
              <div style={styles.note}>All insights are read-only and manually triggered by the user.</div>
            </section>
          </div>
        )}

        {/* STEP 5 — CREATE POST */}
        {stage === "post" && (
          <section style={styles.card}>
            <h2>Create Post</h2>
            <div style={styles.uploadBox}>Insert Image or Video</div>
            <textarea style={styles.textarea} placeholder="Write a caption…" />
            <div style={styles.postRow}>
              <button style={styles.primaryBtn}>Post to Facebook</button>
              <button style={styles.outlineBtn}>Post to Facebook & Instagram</button>
            </div>
          <button
  style={{ marginBottom: 12, background: "none", border: "none", color: "#1877F2", cursor: "pointer" }}
  onClick={() => setStage("dashboard")}
>
  ← Back to Insights
</button>

          </section>
        )}

      </main>
    </div>
  );
}

const styles = {
  app: { height: "100vh", fontFamily: "system-ui, Arial" },
  topbar: { height: 60, background: "#1877F2", color: "#fff", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 24px" },
  logo: { fontSize: 18, fontWeight: 600 },
  user: { fontSize: 14 },
  fullContent: { padding: 40 },
  dashboardWrap: { display: "flex", gap: 24 },
  sidebar: { width: 220, background: "#F0F2F5", padding: 16, borderRadius: 12 },
  navTitle: { fontWeight: 600, marginBottom: 12 },
  navItem: { marginBottom: 8, cursor: "pointer" },
  navItemMuted: { marginBottom: 8, color: "#8A8D91" },
  card: { maxWidth: 640, background: "#fff", padding: 24, borderRadius: 12, boxShadow: "0 2px 12px rgba(0,0,0,0.08)" },
  primaryBtn: { marginTop: 16, background: "#1877F2", color: "#fff", padding: "10px 16px", borderRadius: 6, border: "none" },
  secondaryBtn: { marginTop: 20, background: "#E4E6EB", padding: "10px 16px", borderRadius: 6, border: "none" },
  outlineBtn: { background: "#fff", border: "1px solid #1877F2", color: "#1877F2", padding: "10px 16px", borderRadius: 6 },
  select: { width: "100%", padding: 10, marginTop: 12 },
  smallSelect: { padding: 6 },
  switchRow: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  metrics: { display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16, marginTop: 20 },
  metricBox: { background: "#F0F2F5", padding: 16, borderRadius: 8, display: "flex", justifyContent: "space-between" },
  uploadBox: { height: 120, border: "2px dashed #CCD0D5", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 },
  textarea: { width: "100%", minHeight: 80, padding: 10, marginBottom: 12 },
  postRow: { display: "flex", gap: 12 },
  note: { marginTop: 16, fontSize: 13, color: "#65676B" },
};
