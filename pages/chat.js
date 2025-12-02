"use client";

import { useEffect, useState } from "react";
import { signIn, signOut, useSession } from "next-auth/react";

// Constants for system message and default chat
const SYSTEM_PROMPT = `
You are **GabbarInfo AI**, a senior digital marketing strategist.
[... the rest of your SYSTEM_PROMPT ...]
`;

const DEFAULT_MESSAGES = [
  { role: "assistant", text: "Hi — I’m GabbarInfo AI, your digital marketing strategist. How can I help you today?" },
];

const STORAGE_KEY_CHATS = "gabbarinfo_chats_v1";
const STORAGE_KEY_ACTIVE = "gabbarinfo_active_chat_v1";

function createEmptyChat() {
  const now = Date.now();
  return { id: String(now), title: "New conversation", messages: [...DEFAULT_MESSAGES], createdAt: now };
}

export default function ChatPage() {
  const { data: session, status } = useSession();
  const role = session?.user?.role || "client";

  const [chats, setChats] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [credits, setCredits] = useState(null);
  const [unlimited, setUnlimited] = useState(false);
  const [creditsLoading, setCreditsLoading] = useState(true);
  
  // Simple mobile flag to trigger responsive layout adjustments
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const check = () => setIsMobile(window.innerWidth <= 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Load chats and active chat ID
  useEffect(() => {
    try {
      const storedChats = localStorage.getItem(STORAGE_KEY_CHATS);
      const storedActive = localStorage.getItem(STORAGE_KEY_ACTIVE);
      const parsedChats = storedChats ? JSON.parse(storedChats) : [];
      if (parsedChats.length) {
        setChats(parsedChats);
        setActiveChatId(storedActive || parsedChats[0]?.id);
      } else {
        const newChat = createEmptyChat();
        setChats([newChat]);
        setActiveChatId(newChat.id);
      }
    } catch (e) {
      console.error("Error loading chats:", e);
      setChats([createEmptyChat()]);
    }
  }, []);

  // Save chats and active chat to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_CHATS, JSON.stringify(chats));
      if (activeChatId) {
        localStorage.setItem(STORAGE_KEY_ACTIVE, activeChatId);
      }
    } catch (e) {
      console.error("Failed to save chats:", e);
    }
  }, [chats, activeChatId]);

  // Fetch credits for user (if applicable)
  useEffect(() => {
    async function fetchCredits() {
      try {
        const res = await fetch("/api/credits/get");
        const data = await res.json();
        setCredits(data.credits || 0);
        setUnlimited(data.unlimited || false);
      } catch (err) {
        console.error("Error loading credits:", err);
      } finally {
        setCreditsLoading(false);
      }
    }
    fetchCredits();
  }, []);

  const activeChat = chats.find((chat) => chat.id === activeChatId) || null;
  const messages = activeChat?.messages || DEFAULT_MESSAGES;

  function handleNewChat() {
    const newChat = createEmptyChat();
    setChats((prev) => {
      const updated = [...prev, newChat];
      return updated.length > 5 ? updated.slice(1) : updated;
    });
    setActiveChatId(newChat.id);
    setInput("");
  }

  // Handle message sending
  async function sendMessage(e) {
    e.preventDefault();
    const userText = input.trim();
    if (!userText || !activeChatId) return;

    const userMsg = { role: "user", text: userText };
    const updatedMessages = [...messages, userMsg];

    setInput("");
    setLoading(true);

    try {
      const history = updatedMessages.slice(-30).map(m => `${m.role === "user" ? "User" : "Assistant"}: ${m.text}`).join("\n\n");
      const finalPrompt = `${SYSTEM_PROMPT}\n\nConversation so far:\n${history}\n\nNow respond as GabbarInfo AI.`;

      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: finalPrompt, maxOutputTokens: 768, temperature: 0.5 }),
      });
      const data = await res.json();
      const assistantText = data.text || "No response from model.";

      setChats((prev) => prev.map((chat) => chat.id === activeChatId
        ? { ...chat, messages: [...updatedMessages, { role: "assistant", text: assistantText }] }
        : chat));
    } catch (err) {
      console.error("Error during message send:", err);
    } finally {
      setLoading(false);
      setTimeout(() => {
        const chatArea = document.getElementById("chat-area");
        if (chatArea) chatArea.scrollTop = chatArea.scrollHeight;
      }, 50);
    }
  }

  // Handling user session status
  if (status === "loading") {
    return <div style={{ padding: 40 }}>Checking session…</div>;
  }

  if (!session) {
    return (
      <div style={{ padding: 40, fontFamily: "Inter, Arial" }}>
        <h1>GabbarInfo AI</h1>
        <p>Please sign in with Google to use GabbarInfo AI.</p>
        <button
          onClick={() => signIn("google")}
          style={{ padding: "10px 16px", borderRadius: 6, background: "#fff", border: "1px solid #ddd", cursor: "pointer" }}
        >
          Sign in with Google
        </button>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "Inter, Arial", minHeight: "100vh", display: "flex", flexDirection: "column", background: "#fafafa" }}>
      <header style={{
        display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px", background: "#fff",
        position: "sticky", top: 0, zIndex: 20, borderBottom: "1px solid #eee", flexShrink: 0
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <strong>GabbarInfo AI</strong>
          <button onClick={handleNewChat} style={{
            padding: "4px 10px", borderRadius: 6, border: "1px solid #ddd", fontSize: 12, cursor: "pointer", background: "#fafafa"
          }}>New chat</button>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{
            fontSize: 11, padding: "4px 8px", borderRadius: 999, border: "1px solid #ddd", background: role === "owner" ? "#ffe8cc" : "#e8f0fe",
            color: role === "owner" ? "#8a3c00" : "#174ea6"
          }}>
            {role === "owner" ? "Owner · Unlimited" : creditsLoading ? "Client · Credits: ..." : `Client · Credits: ${credits ?? 0}`}
          </span>
          <span style={{ fontSize: 13, color: "#333", whiteSpace: "nowrap" }}>{session.user?.email}</span>
          <button onClick={() => signOut()} style={{ padding: "6px 10px", borderRadius: 6, fontSize: 12 }}>Sign out</button>
        </div>
      </header>

      <main style={{ flex: 1, display: "flex", flexDirection: isMobile ? "column" : "row" }}>
        <aside style={{
          width: isMobile ? "100%" : 260, borderRight: "1px solid #eee", borderBottom: isMobile ? "1px solid #eee" : "none", padding: 12,
          display: "flex", flexDirection: "column", gap: 10, background: "#fff"
        }}>
          <div style={{ fontWeight: 600, fontSize: 15 }}>Conversations</div>
          <button onClick={handleNewChat} style={{
            width: "100%", textAlign: "left", padding: "10px 12px", borderRadius: 8, border: "1px solid #ddd", background: "#f5f5f5",
            fontSize: 14, cursor: "pointer"
          }}>+ New chat</button>
          <div style={{ fontSize: 11, color: "#999", marginTop: 4 }}>Recent (max 5)</div>
          <div style={{ maxHeight: "60vh", overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
            {chats.map((chat) => (
              <button key={chat.id} onClick={() => setActiveChatId(chat.id)} style={{
                width: "100%", textAlign: "left", padding: "8px 10px", borderRadius: 6, fontSize: 13, cursor: "pointer",
                background: chat.id === activeChatId ? "#e8f0fe" : "#ffffff", border: "1px solid #eee"
              }}>
                {chat.title}
              </button>
            ))}
          </div>
        </aside>

        <section style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
          <div id="chat-area" style={{
            flex: 1, padding: 12, paddingBottom: 8, overflowY: "auto", background: "#fafafa"
          }}>
            {messages.map((m, i) => (
              <div key={i} style={{ marginBottom: 10, display: "flex", flexDirection: m.role === "user" ? "row-reverse" : "row" }}>
                <div style={{
                  maxWidth: "80%", background: m.role === "user" ? "#DCF8C6" : "#fff", padding: 10, borderRadius: 8,
                  border: "1px solid #e6e6e6", fontSize: 14, whiteSpace: "pre-wrap", wordWrap: "break-word"
                }}>
                  {m.text}
                </div>
              </div>
            ))}
          </div>
          <form onSubmit={sendMessage} style={{
            display: "flex", gap: 8, borderTop: "1px solid #eee", padding: 12, background: "#fff"
          }}>
            <input value={input} onChange={(e) => setInput(e.target.value)} placeholder={loading ? "Waiting..." : "Ask anything..."} disabled={loading} style={{
              flex: 1, padding: 10, borderRadius: 8, border: "1px solid #ddd", fontSize: 14
            }} />
            <button type="submit" disabled={loading} style={{ padding: "10px 14px", borderRadius: 8, fontSize: 14 }}>
              {loading ? "Thinking…" : "Send"}
            </button>
          </form>
        </section>
      </main>
    </div>
  );
}
