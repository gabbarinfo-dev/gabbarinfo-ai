// lib/instagram/resolve-assets.js

/**
 * RESOLVER RULES:
 * 1. ONLY decide whether a field is complete or needs a question.
 * 2. NEVER assign fields (contactMethod, phone, etc.).
 * 3. NEVER return 'updates'.
 * 4. Extraction happens EXCLUSIVELY in WAITING stages in creative-entry.js.
 */
export async function resolveAssets(supabase, state, metaRow) {
    // 1. Contact Preference
    if (!state.assets.contactLocked) {
        return {
            complete: false,
            question: "How should customers contact you? (Reply: 'Website', 'Call', 'WhatsApp', or 'None')"
        };
    }

    // 2. Asset Confirmation
    if (!state.assets.assetsConfirmed) {
        const method = state.assets.contactMethod;
        const needsWebsite = method === "website";
        const needsPhone = method === "phone" || method === "whatsapp";

        let website = state.assets.websiteUrl || metaRow?.website;
        let phone = state.assets.phone || metaRow?.phone;

        const missingWebsite = needsWebsite && !website;
        const missingPhone = needsPhone && !phone;

        if (missingWebsite || missingPhone) {
            let q = "I need some details.";
            if (missingWebsite && missingPhone) q = "Please provide your Website URL and Phone Number.";
            else if (missingWebsite) q = "Please provide your Website URL.";
            else if (missingPhone) q = "Please provide your Phone Number.";

            return { complete: false, question: q };
        }
    }

    // 3. Logo Decision (Automatic decision is NOT an assignment, it's a recommendation)
    if (!state.assets.logoLocked) {
        // We will let the WAITING logic handle the actual lock
        return { complete: true };
    }

    return { complete: true };
}
