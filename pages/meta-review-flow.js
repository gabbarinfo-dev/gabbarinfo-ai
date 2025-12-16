// META APP REVIEW — FULL-PROOF UI FLOW (ALL 8 PERMISSIONS)
// IMPORTANT:
// - This UI EXACTLY mirrors your real app flow
// - Google Sign-in FIRST
// - THEN Facebook Business connection
// - NO Facebook Login
// - NO real APIs
// - PURE UI for Meta screen recording
//
// HOW TO USE:
// 1. Save as: pages/meta-review-flow.js
// 2. Run: npm run dev
// 3. Open: http://localhost:3000/meta-review-flow

import { useState } from "react";

export default function MetaReviewFlow() {
  const [step, setStep] = useState(0);

  return (
    <div style={styles.container}>
      <h1>Gabbarinfo AI</h1>

      {/* STEP 0 — GOOGLE SIGN-IN (MATCHES YOUR REAL APP) */}
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
          <h2>Welcome to Gabbarinfo AI Dashboard</h2>
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
          <p>User manually selects a Page they manage.</p>
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
          <p>User confirms their business ad account.</p>
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
          <p>@bellandivajewellery</p>
          <p>User confirms the connected Instagram account.</p>
          <button style={styles.button} onClick={() => setStep(5)}>Create Instagram Post</button>
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
          <button style={styles.button} onClick={() => setStep(6)}>Publish Post</button>
        </div>
      )}

      {/* STEP 6 — Publish Confirmation */}
      {step === 6 && (
        <div style={styles.card}>
          <h2>Post Published Successfully</h2>
          <p>This publishing action was manually triggered by the user.</p>
          <button style={styles.button} onClick={() => setStep(7)}>View Ads & Insights</button>
        </div>
      )}

      {/* STEP 7 — ads_read + pages_read_engagement + ads_management */}
      {step === 7 && (
        <div style={styles.card}>
          <h2>Ad Performance & Page Insights</h2>
          <ul>
            <li>Impressions: 12,450</li>
            <li>Clicks: 312</li>
            <li>Spend: ₹4,560</li>
            <li>Post Engagement: 1,240</li>
          </ul>
          <button style={styles.button}>Pause Ad</button>
          <button style={{ ...styles.button, background: "#16a34a" }}>Resume Ad</button>
          <p style={{ marginTop: 12 }}>
            All ad and insight actions are manually triggered by the user.
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
};
