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
        throw new Error("No Meta connection found. Please connect Facebook/Instagram in your dashboard first.");
    }

    const isFb = state.targetPlatform === "facebook";
    const pageId = metaRow.fb_page_id;
    const igId = metaRow.instagram_actor_id || metaRow.ig_business_id;

    if (isFb) {
        if (pageId) {
            const pageName = metaRow.business_name || "GABBARinfo";
            return {
                complete: false,
                question: `I see your connected **${pageName}** Facebook Page. I will use it for this post. Should I proceed? *(If you want a different account, go to the dashboard, disconnect Facebook Business, and reconnect the page you want this post to go on.)*`
            };
        }
        throw new Error("No connected Facebook Page found in your account settings. Please connect a Facebook Page in the dashboard.");
    }

    // Instagram mode
    if (igId) {
        const igName = metaRow.business_name || "gabbarinfo";
        return {
            complete: false,
            question: `I see your connected **${igName}** Instagram account. I will use it for this post. Should I proceed? *(If you want a different account, go to the dashboard, disconnect Facebook Business, and reconnect the account you want this post to go on.)*`
        };
    }

    throw new Error("No Instagram Business account found in your connection settings. Please connect your account in the dashboard.");
}
