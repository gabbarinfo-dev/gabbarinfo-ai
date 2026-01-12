// lib/instagram/resolve-context.js

/**
 * RESOLVER RULES:
 * 1. ONLY decide whether a field is complete or needs a question.
 * 2. NEVER assign fields (service, offer, etc.).
 * 3. NEVER return 'updates'.
 * 4. Extraction happens EXCLUSIVELY in WAITING stages in creative-entry.js.
 */
export function resolveContext(state) {
    // 1. Service Context
    if (!state.context.serviceLocked) {
        return {
            complete: false,
            question: "What service do you want this Instagram post to focus on? (e.g., 'Laundry Service', 'Fitness Centre')"
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
