// pages/reels.js
import { useEffect } from "react";
import { useRouter } from "next/router";

export default function ReelsRedirect() {
  const router = useRouter();

  useEffect(() => {
    if (router.isReady) {
      const queryParams = new URLSearchParams(window.location.search);
      queryParams.set("tab", "reels");
      router.replace(`/?${queryParams.toString()}`);
    }
  }, [router.isReady]);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#080d1a",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#94a3b8",
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>🎬</div>
        <p>Loading AI Reels & Shorts Studio…</p>
      </div>
    </div>
  );
}
