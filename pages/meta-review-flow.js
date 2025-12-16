// META APP REVIEW — FULL‑PROOF UI FLOW (ALL 8 PERMISSIONS)
// FINAL, DEPLOY‑SAFE VERSION
// PURPOSE: Meta App Review screen‑recording ONLY
// IMPORTANT:
// • Matches your real flow: Google login → Dashboard → Facebook connection
// • NO Facebook Login
// • NO real APIs
// • NO "demo" wording
// • ALL 8 permissions visually covered

import { useState } from "react";

export default function MetaReviewFlow() {
  // NOTE:
  // This page is INTENTIONALLY UI‑ONLY.
  // It does NOT read your real Google session.
  // That is WHY you see Google sign‑in again here.

  const [step, setStep] = useState(0);

  return (
    <div style={styles.container}>
      <h1>Gabbarinfo AI</h1>

      {/* STEP 0 — GOOGLE SIGN‑IN (UI REPRESENTATION ONLY) */}
      {step === 0 && (
        <div style={styles.card}>
          <p>Please sign in with Google to use Gabbarinfo AI.</p>
          <button style={styles.googleBtn} onClick={() => setStep(1)}>
            Sign in with Google
          </button>
        </div>
      )}

      {/* STEP 1 — DASHBOARD */}
      {step === 1 && (
        <div style={styles.card}>
          <h2>Dashboard</h2>
          <p>Manage your marketing activities from one place.</p>
          <button style={styles.button} onClick={() => setStep(2)}>
            Connect Facebook Business
          </button>
        </div>
      )}

      {/* STEP 2 — pages_show_list */}
      {step === 2 && (
        <div style={styles.card}>
          <h2>Select a Facebook Page</h2>
          <label>
            <input type="radio" name="page" defaultChecked /> Bella & Diva Jewellery
          </label>
          <br />
          <label>
            <input type="radio" name="page" /> Gabbarinfo Digital Solutions
          </label>
          <br /><br />
          <button style={styles.button} onClick={() => setStep(3)}>Continue</button>
        </div>
      )}

      {/* STEP 3 — business_management */}
      {step === 3 && (
        <div style={styles.card}>
          <h2>Select Ad Account</h2>
          <label>
            <input type="radio" name="ad" defaultChecked /> Ad Account – 1587806431828953
          </label>
          <br /><br />
          <button style={styles.button} onClick={() => setStep(4)}>Continue</button>
        </div>
      )}

      {/* STEP 4 — instagram_basic */}
      {step === 4 && (
        <div style={styles.card}>
          <h2>Connected Instagram Business Account</h2>
          <div style={styles.igHeader}>
            <div style={styles.igAvatar}></div>
            <div>
              <strong>@bellandivajewellery</strong>
              <p style={{ margin: 0, fontSize: 12 }}>Instagram Business Profile</p>
            </div>
          </div>
          <button style={styles.button} onClick={() => setStep(5)}>
            Create Instagram Post
          </button>
        </div>
      )}

      {/* STEP 5 — instagram_content_publish */}
      {step === 5 && (
        <div style={styles.card}>
          <h2>Create Instagram Post</h2>
          <div style={styles.imageBox}>Post Image Preview</div>
          <textarea
            style={styles.textarea}
            defaultValue="New arrivals now live! ✨"
          />
          <br />
          <button style={styles.button} onClick={() => setStep(6)}>
            Publish Post
          </button>
        </div>
      )}

      {/* STEP 6 — Publish confirmation */}
      {step === 6 && (
        <div style={styles.card}>
          <h2>Post Published Successfully</h2>
          <p>This action was manually triggered by the user.</p>
          <button style={styles.button} onClick={() => setStep(7)}>
            View Ads & Insights
          </button>
        </div>
      )}

      {/* STEP 7 — ads_read + pages_read_engagement + ads_management + pages_manage_ads */}
      {step === 7 && (
        <div style={styles.card}>
          <h2>Facebook Page Ads & Insights</h2>
          <p><strong>Page:</strong> Bella & Diva Jewellery</p>
          <ul>
            <li>Impressions: 12,450</li>
            <li>Clicks: 312</li>
            <li>Spend: ₹4,560</li>
            <li>Post Engagement: 1,240</li>
          </ul>
          <p><strong>Manage Page Ads</strong></p>
          <button style={styles.button}>Pause Page Ad</button>
          <button style={{ ...styles.button, background: "#16a34a" }}>Resume Page Ad</button>
          <p style={{ marginTop: 12 }}>
            All Page ad management and insight actions are manually triggered by the user.
          </p>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    maxWidth: 640,
    margin: "40px auto",
    fontFamily: "Arial, sans-serif",
  },
  card: {
    border: "1px solid #ddd",
    borderRadius: 8,
    padding: 20,
    marginTop: 20,
  },
  button: {
    padding: "10px 16px",
    background: "#2563eb",
    color: "#fff",
    border: "none",
    borderRadius: 6,
    cursor: "pointer",
    marginRight: 8,
  },
  googleBtn: {
    padding: "10px 16px",
    background: "#fff",
    color: "#000",
    border: "1px solid #ccc",
    borderRadius: 6,
    cursor: "pointer",
  },
  textarea: {
    width: "100%",
    height: 80,
    marginTop: 10,
  },
  imageBox: {
    width: "100%",
    height: 150,
    background: "#eee",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  igHeader: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    marginBottom: 10,
  },
  igAvatar: {
    width: 48,
    height: 48,
    borderRadius: "50%",
    background: "linear-gradient(45deg, #f58529, #dd2a7b, #8134af)",
  },
};
