// lib/instagram/creative-memory.js
import { DEFAULT_CREATIVE_STATE } from "./creative-constants";

export async function loadCreativeState(supabase, email) {
    if (!email) return null;

    try {
        const { data } = await supabase
            .from("agent_memory")
            .select("content")
            .eq("email", email)
            .eq("memory_type", "client")
            .maybeSingle();

        if (!data?.content) return { ...DEFAULT_CREATIVE_STATE };

        const content = JSON.parse(data.content);
        
        // FIX: Load by active_creative_session_id only
        const activeSessionId = content.active_creative_session_id;
        
        if (activeSessionId && content.creative_sessions && content.creative_sessions[activeSessionId]) {
            const sessionState = content.creative_sessions[activeSessionId];
            // Resume the active session
            return { ...sessionState, creativeSessionId: activeSessionId };
        }

        // If no active session, return default
        return { ...DEFAULT_CREATIVE_STATE };
    } catch (e) {
        console.warn("Failed to load creative state:", e);
        return { ...DEFAULT_CREATIVE_STATE };
    }
}

export async function saveCreativeState(supabase, email, sessionId, updates) {
    if (!email || !sessionId) return;

    try {
        const { data: existing } = await supabase
            .from("agent_memory")
            .select("content")
            .eq("email", email)
            .eq("memory_type", "client")
            .maybeSingle();

        let content = {};
        try {
            content = existing?.content ? JSON.parse(existing.content) : {};
        } catch {
            content = {};
        }

        // Initialize structures
        content.creative_sessions = content.creative_sessions || {};
        
        // Load current state for this session or default
        const currentState = content.creative_sessions[sessionId] || { ...DEFAULT_CREATIVE_STATE };

        // Merge updates
        const newState = {
            ...currentState,
            ...updates,
            creativeSessionId: sessionId,
            updated_at: new Date().toISOString()
        };

        // Save back
        content.creative_sessions[sessionId] = newState;
        content.active_creative_session_id = sessionId; // Ensure pointer is active

        const { error } = await supabase.from("agent_memory").upsert(
            {
                email: email,
                memory_type: "client",
                content: JSON.stringify(content),
                updated_at: new Date().toISOString(),
            },
            { onConflict: "email,memory_type" }
        );

        if (error) console.error("Save creative state error:", error);
    } catch (e) {
        console.error("Save creative state exception:", e);
    }
}

export async function clearCreativeState(supabase, email, sessionId) {
    if (!email || !sessionId) return;
    
    try {
        const { data: existing } = await supabase
            .from("agent_memory")
            .select("content")
            .eq("email", email)
            .eq("memory_type", "client")
            .maybeSingle();
            
        if (!existing?.content) return;
        
        let content = JSON.parse(existing.content);
        
        // Remove active pointer if it matches
        if (content.active_creative_session_id === sessionId) {
            delete content.active_creative_session_id;
        }
        
        // Mark session as COMPLETED in storage
        if (content.creative_sessions && content.creative_sessions[sessionId]) {
             content.creative_sessions[sessionId].stage = "COMPLETED";
        }

        await supabase.from("agent_memory").upsert({
            email,
            memory_type: "client",
            content: JSON.stringify(content),
            updated_at: new Date().toISOString()
        }, { onConflict: "email,memory_type" });
        
    } catch (e) {
        console.error("Clear state error:", e);
    }
}
