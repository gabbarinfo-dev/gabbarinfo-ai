// lib/instagram/resolve-context.js

/**
 * RESOLVER RULES:
 * 1. ONLY decide whether a field is complete or needs a question.
 * 2. NEVER assign fields (service, offer, etc.).
 * 3. NEVER return 'updates'.
 * 4. Extraction happens EXCLUSIVELY in WAITING stages in creative-entry.js.
 */
export function resolveContext(state) {
    const platformLabel = state.targetPlatform === "facebook" ? "Facebook" : "Instagram";
    const exampleServices = state.targetPlatform === "facebook" 
        ? "'Website Development', 'Digital Marketing', 'Real Estate'"
        : "'Digital Marketing', 'Website Design', 'Fitness Centre'";

    // 1. Service Context
    if (!state.context.serviceLocked) {
        return {
            complete: false,
            question: `What service or product do you want this ${platformLabel} post to focus on? (e.g., ${exampleServices})`
        };
    }

    // 2. Offer Context
    if (!state.context.offerLocked) {
        return {
            complete: false,
            question: "Is there any special offer or discount you want to mention? (Reply 'None' if not)"
        };
    }

    return { complete: true };
}
