// lib/instagram/resolve-assets.js

/**
 * RESOLVER RULES:
 * 1. ONLY decide whether a field is complete or needs a question.
 * 2. NEVER assign fields (contactMethod, phone, etc.).
 * 3. NEVER return 'updates'.
 * 4. Extraction happens EXCLUSIVELY in WAITING stages in creative-entry.js.
 */
export default async function resolveAssets(supabase, state, metaRow) {
    const brandName = metaRow?.business_name || "your brand";

    // 1. Contact Preference
    if (!state.assets.contactLocked) {
        return {
            complete: false,
            question: `How should customers contact ${brandName}? (Reply: 'Website', 'Call', 'WhatsApp', or 'None')`
        };
    }

    // 2. Asset Confirmation
    if (!state.assets.assetsConfirmed) {
        const method = state.assets.contactMethod;
        const needsWebsite = method === "website";
        const needsPhone = method === "phone" || method === "whatsapp";

        let website = state.assets.websiteUrl || metaRow?.business_website;
        let phone = state.assets.phone || metaRow?.business_phone;

        const missingWebsite = needsWebsite && !website;
        const missingPhone = needsPhone && !phone;

        if (missingWebsite || missingPhone) {
            let q = `I need some details for ${brandName}.`;
            if (missingWebsite && missingPhone) q = `Please provide the Website URL and Phone Number for ${brandName}.`;
            else if (missingWebsite) q = `Please provide the Website URL for ${brandName}.`;
            else if (missingPhone) q = `Please provide the Phone Number for ${brandName}.`;

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
