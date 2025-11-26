"use client";
import { useEffect, useState } from "react";
import { signIn, signOut, useSession } from "next-auth/react";

export default function Home() {
  const { data: session, status } = useSession();
  const [messages, setMessages] = useState([
    { role: "assistant", text: "Hi — ask me anything. I’ll answer using Gemini." },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  // Send user message -> call server -> append assistant response
  async function sendMessage(e) {
    e?.preventDefault();
    const prompt = input.trim();
    if (!prompt) return;
    const userMsg = { role: "user", text: prompt };
    setMessages((m) => [...m, userMsg]);
    setInput("");
    setLoading(true);

   try {
  // Send correct shape expected by pages/api/generate.js
  const res = await fetch("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt }), // <-- correct: send { prompt }
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Server error");
  }

  const data = await res.json();
  const assistantText =
    data.text ||
    data.output ||
    data.candidates?.[0]?.content?.parts?.[0]?.text ||
    "No response";

  const assistant = { role: "assistant", text: assistantText };
  setMessages((m) => [...m, assistant]);
} catch (err) {
  console.error(err);
  const errMsg = { role: "assistant", text: "Error: " + (err.message || "Unknown") };
  setMessages((m) => [...m, errMsg]);
} finally {
  setLoading(false);
  setTimeout(() => {
    const el = document.getElementById("chat-area");
    if (el) el.scrollTop = el.scrollHeight;
  }, 50);
}
  }
  // Signed out: show simple login button
  if (!session) {
    return (
      <div style={{ fontFamily: "Inter, Arial", padding: 40 }}>
        <h1>Sign in to continue</h1>
        <p>Sign in with Google to use the chat interface.</p>
        <button
          onClick={() => signIn("google")}
          style={{
            padding: "10px 16px",
            borderRadius: 6,
            border: "1px solid #ddd",
            background: "#fff",
            cursor: "pointer",
          }}
        >
          Sign in with Google
        </button>
      </div>
    );
  }

  // Signed in: show chat UI
  return (
    <div style={{ fontFamily: "Inter, Arial", height: "100vh", display: "flex", flexDirection: "column" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: 18, borderBottom: "1px solid #eee" }}>
        <div>
          <strong>GabbarInfo AI</strong> — Chat
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div style={{ fontSize: 13, color: "#333" }}>{session.user?.email}</div>
          <button onClick={() => signOut()} style={{ padding: "6px 10px", borderRadius: 6 }}>Sign out</button>
        </div>
      </header>

      <main style={{ display: "flex", flex: 1 }}>
        <aside style={{ width: 260, borderRight: "1px solid #eee", padding: 12 }}>
          <div style={{ fontWeight: 600, marginBottom: 12 }}>Conversations</div>
          <div style={{ color: "#666" }}>This demo uses Gemini (server-side). Type to start a conversation.</div>
        </aside>

        <section style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          <div id="chat-area" style={{ flex: 1, padding: 20, overflow: "auto", background: "#fafafa" }}>
            {messages.map((m, i) => (
              <div key={i} style={{ marginBottom: 12, display: "flex", flexDirection: m.role === "user" ? "row-reverse" : "row" }}>
                <div style={{
                  maxWidth: "75%",
                  background: m.role === "user" ? "#DCF8C6" : "#fff",
                  padding: 12,
                  borderRadius: 8,
                  border: "1px solid #e6e6e6",
                }}>
                  <div style={{ fontSize: 14, whiteSpace: "pre-wrap" }}>{m.text}</div>
                </div>
              </div>
            ))}
          </div>

          <form onSubmit={sendMessage} style={{ display: "flex", padding: 12, gap: 8, borderTop: "1px solid #eee" }}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={loading ? "Waiting for response..." : "Ask anything..."}
              style={{ flex: 1, padding: 12, borderRadius: 8, border: "1px solid #ddd" }}
              disabled={loading}
            />
            <button type="submit" disabled={loading} style={{ padding: "10px 14px", borderRadius: 8 }}>
              {loading ? "Thinking…" : "Send"}
            </button>
          </form>
        </section>
      </main>
    </div>
  );
}
