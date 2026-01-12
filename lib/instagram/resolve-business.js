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

    const accessToken = metaRow.fb_user_access_token;

    try {
        const url = `https://graph.facebook.com/v21.0/me/accounts?fields=name,id,instagram_business_account{id,username}&access_token=${accessToken}`;
        const res = await fetch(url);
        const data = await res.json();

        if (data.error) throw new Error("Meta account fetch failed.");

        const validAccounts = (data.data || []).filter(p => p.instagram_business_account);

        if (validAccounts.length === 0) {
            throw new Error("No Instagram Business accounts found.");
        }

        if (validAccounts.length === 1) {
            const username = validAccounts[0].instagram_business_account.username;
            return {
                complete: false,
                question: `I found your Instagram account @${username}. Should I use this for the post?`
            };
        }

        const options = validAccounts.map(acc => `@${acc.instagram_business_account.username}`).join(", ");
        return {
            complete: false,
            question: `Which account should I post to? Available: ${options}`
        };

    } catch (e) {
        console.error("resolveBusiness Error:", e);
        throw e;
    }
}
