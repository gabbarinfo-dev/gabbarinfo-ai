// lib/instagram/creative-memory.js
import { DEFAULT_CREATIVE_STATE } from "./creative-constants";

export async function loadCreativeState(supabase, email, businessId) {
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
        const bizData = content.business_answers?.[businessId] || {};
        
        return bizData.creative_state || { ...DEFAULT_CREATIVE_STATE };
    } catch (e) {
        console.warn("Failed to load creative state:", e);
        return { ...DEFAULT_CREATIVE_STATE };
    }
}

export async function saveCreativeState(supabase, email, businessId, updates) {
    if (!email || !businessId) return;

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

        content.business_answers = content.business_answers || {};
        const bizData = content.business_answers[businessId] || {};
        const currentState = bizData.creative_state || { ...DEFAULT_CREATIVE_STATE };

        // Deep merge logic could be added here if needed, but for now specific updates are enough
        const newState = {
            ...currentState,
            ...updates,
            updated_at: new Date().toISOString()
        };

        content.business_answers[businessId] = {
            ...bizData,
            creative_state: newState
        };

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

export async function clearCreativeState(supabase, email, businessId) {
    await saveCreativeState(supabase, email, businessId, { ...DEFAULT_CREATIVE_STATE });
}
