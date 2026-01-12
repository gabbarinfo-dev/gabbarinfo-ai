// lib/instagram/resolve-context.js

/**
 * RESOLVER RULES:
 * 1. ONLY decide whether a field is complete or needs a question.
 * 2. NEVER assign fields (service, offer, etc.).
 * 3. NEVER return 'updates'.
 * 4. Extraction happens EXCLUSIVELY in WAITING stages in creative-entry.js.
 */
export default function resolveContext(state) {
    const brandName = state.businessName || "your brand";

    // 1. Service Context
    if (!state.context.serviceLocked) {
        return {
            complete: false,
            question: `What primary service or product should this post for ${brandName} focus on? (e.g., 'Laundry Service')`
        };
    }

    // 2. Offer Context
    if (!state.context.offerLocked) {
        return {
            complete: false,
            question: `Is there any special offer or discount for ${brandName} you want to mention? (Reply 'None' if not)`
        };
    }

    return { complete: true };
}
