// pages/chat.js
import { useSession, signIn, signOut } from "next-auth/react";
import { useEffect, useRef, useState } from "react";

export default function ChatPage() {
  const { data: session, status } = useSession();
  const [messages, setMessages] = useState([
    { id: 1, role: "assistant", text: "Hi — ask me anything about digital marketing." },
  ]);
  const [input, setInput] = useState("");
  const listRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (status === "unauthenticated") {
      signIn("google");
    }
  }, [status]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function sendMessage() {
    const text = input.trim();
    if (!text) return;
    const userMsg = { id: Date.now(), role: "user", text };
    setMessages((m) => [...m, userMsg]);
    setInput("");
    inputRef.current?.focus();

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      const data = await res.json();
      const reply = data?.text ?? "Sorry, no response.";
      setMessages((m) => [...m, { id: Date.now() + 1, role: "assistant", text: reply }]);
    } catch (err) {
      setMessages((m) => [...m, { id: Date.now() + 2, role: "assistant", text: "Error: " + err.message }]);
    }
  }

  if (status === "loading") return <div style={{ padding: 40 }}>Loading…</div>;

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", fontFamily: "Arial, sans-serif" }}>
      <header style={{ padding: "12px 18px", borderBottom: "1px solid #eee", display: "flex", justifyContent: "space-between" }}>
        <div>
          <strong>GabbarInfo AI</strong>
          <div style={{ fontSize: 12, color: "#666" }}>{session?.user?.email}</div>
        </div>
        <div>
          <button onClick={() => signOut()} style={{ padding: "6px 10px" }}>Sign out</button>
        </div>
      </header>

      <div ref={listRef} style={{ flex: 1, overflow: "auto", padding: 20, background: "#fafafa" }}>
        {messages.map((m) => (
          <div key={m.id} style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 12, color: "#888", textTransform: "capitalize" }}>{m.role}</div>
            <div style={{ padding: 12, background: m.role === "assistant" ? "#fff" : "#dcfce7", borderRadius: 8, maxWidth: "80%" }}>
              {m.text}
            </div>
          </div>
        ))}
      </div>

      <div style={{ padding: 12, borderTop: "1px solid #eee", display: "flex", gap: 8 }}>
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={async (e) => { if (e.key === "Enter") await sendMessage(); }}
          placeholder="Type your message..."
          style={{ flex: 1, padding: 12, borderRadius: 8, border: "1px solid #ddd" }}
        />
        <button onClick={sendMessage} style={{ padding: "10px 14px", borderRadius: 8, background: "#0ea5a1", color: "white", border: "none" }}>
          Send
        </button>
      </div>
    </div>
  );
}
