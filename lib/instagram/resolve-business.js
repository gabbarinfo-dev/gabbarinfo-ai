// lib/instagram/resolve-business.js

/**
 * RESOLVER RULES:
 * 1. ONLY decide whether a field is complete or needs a question.
 * 2. NEVER assign fields (businessId, etc.).
 * 3. NEVER return data/updates.
 * 4. Extraction/Matching happens EXCLUSIVELY in WAITING stages.
 */
export async function resolveBusiness(session, metaRow, state) {
    // 1. If business already selected, return complete
    if (state.businessId) {
        return { complete: true };
    }

    // 2. Need metaRow to proceed
    if (!metaRow || !metaRow.fb_user_access_token) {
        throw new Error("No Meta connection found. Please connect Facebook/Instagram first.");
    }

    // FIX: Removed all Meta Graph API network calls (fetch).
    // Creative mode must never talk to Meta directly.
    const igId = metaRow.instagram_actor_id || metaRow.ig_business_id;

    if (igId) {
        // We assume one primary account is connected in metaRow.
        // If we don't have the username cached, we use a generic reference.
        return {
            complete: false,
            question: "I see your connected Instagram account. Should I use it for this post?"
        };
    }

    throw new Error("No Instagram Business account found in your connection settings.");
}
