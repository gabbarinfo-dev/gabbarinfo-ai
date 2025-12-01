// Send user message -> spend credit (if not owner) -> ask Gemini -> save chat
async function sendMessage(e) {
  e?.preventDefault();

  const userText = input.trim();
  if (!userText || !activeChatId) return;

  // If client and clearly 0 credits → block immediately
  if (role !== "owner" && !unlimited && credits !== null && credits <= 0) {
    setChats((prev) =>
      prev.map((chat) => {
        if (chat.id !== activeChatId) return chat;
        const errMsg = {
          role: "assistant",
          text: "You’ve run out of credits. Please contact GabbarInfo to top up.",
        };
        return {
          ...chat,
          messages: [...(chat.messages || DEFAULT_MESSAGES), errMsg],
        };
      })
    );
    return;
  }

  const userMsg = { role: "user", text: userText };

  // Start from current messages of this chat
  const baseMessages = messages || DEFAULT_MESSAGES;
  const updatedMessages = [...baseMessages, userMsg];

  setInput("");
  setLoading(true);

  try {
    // 1️⃣ If not owner → spend a credit first
    if (role !== "owner" && !unlimited) {
      try {
        const spendRes = await fetch("/api/credits/spend", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ amount: 1 }),
        });

        // Not enough credits
        if (spendRes.status === 402) {
          const data = await spendRes.json().catch(() => ({}));
          const left =
            typeof data.creditsLeft === "number" ? data.creditsLeft : 0;

          const msg =
            data.error ||
            "You’ve run out of credits. Please contact GabbarInfo to top up.";

          setCredits(left);

          setChats((prev) =>
            prev.map((chat) => {
              if (chat.id !== activeChatId) return chat;
              const errMsg = { role: "assistant", text: msg };
              return {
                ...chat,
                messages: [
                  ...(chat.messages || DEFAULT_MESSAGES),
                  userMsg,
                  errMsg,
                ],
              };
            })
          );

          setLoading(false);
          return;
        }

        // Other error
        if (!spendRes.ok) {
          console.error("Failed to spend credit:", await spendRes.text());
        } else {
          const data = await spendRes.json().catch(() => ({}));
          if (typeof data.creditsLeft === "number") {
            setCredits(data.creditsLeft);
          }
          if (data.unlimited === true) {
            setUnlimited(true);
          }
        }
      } catch (err) {
        console.error("Error calling /api/credits/spend:", err);
        // If this fails, we still let the message go through (better UX)
      }
    }

    // 2️⃣ Build prompt with history
    const history = updatedMessages
      .slice(-30)
      .map(
        (m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.text}`
      )
      .join("\n\n");

    const finalPrompt = `
${SYSTEM_PROMPT}

Conversation so far:
${history}

Now respond as GabbarInfo AI.

- If the user asks for a plan, framework or "X-step" strategy, give the **entire**
  plan in this single reply (no stopping at Step 3 or Step 5).
- Use the business type, city, and budget already mentioned.
- Only break things into multiple replies when the user clearly asks for that
  (for example "explain only step 1 first" or "go step by step").
`.trim();

    // 3️⃣ Call the backend generate route
    const res = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: finalPrompt,
        maxOutputTokens: 768,
        temperature: 0.5,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || "Server error");
    }

    const data = await res.json();
    let assistantText = data.text || "";

    if (!assistantText) {
      assistantText = "No response from model.";
    }

    const assistantMsg = { role: "assistant", text: assistantText };

    // Update chats state: update only the active chat
    setChats((prev) =>
      prev.map((chat) => {
        if (chat.id !== activeChatId) return chat;

        // Determine title: if this is first user message, use it as chat title
        const hadUserBefore = (chat.messages || []).some(
          (m) => m.role === "user"
        );
        let newTitle = chat.title;
        if (!hadUserBefore) {
          const snippet =
            userText.length > 40
              ? userText.slice(0, 40) + "…"
              : userText || "New conversation";
          newTitle = snippet;
        }

        const finalMessages = [...updatedMessages, assistantMsg];

        return {
          ...chat,
          title: newTitle,
          messages: finalMessages,
        };
      })
    );
  } catch (err) {
    console.error(err);
    const errMsg = {
      role: "assistant",
      text: "Error: " + (err.message || "Unknown"),
    };

    setChats((prev) =>
      prev.map((chat) => {
        if (chat.id !== activeChatId) return chat;
        return {
          ...chat,
          messages: [...(chat.messages || DEFAULT_MESSAGES), userMsg, errMsg],
        };
      })
    );
  } finally {
    setLoading(false);
    setTimeout(() => {
      const el = document.getElementById("chat-area");
      if (el) el.scrollTop = el.scrollHeight;
    }, 50);
  }
}
