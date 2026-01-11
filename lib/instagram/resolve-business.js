// lib/instagram/resolve-business.js
import { CREATIVE_STAGES } from "./creative-constants";

export async function resolveBusiness(session, metaRow, instruction, state) {
    // 1. If business already selected, verify and return
    if (state.businessId) {
        return {
            complete: true,
            businessId: state.businessId,
            businessName: state.businessName
        };
    }

    // 2. Need metaRow to proceed
    if (!metaRow || !metaRow.fb_user_access_token) {
         // If no connection, we can't really do "Creative Mode" for Instagram specifically 
         // without knowing who we are posting as. 
         // But maybe we can proceed with a placeholder?
         // No, user said "Display choices as Instagram handles".
         throw new Error("No Meta connection found. Please connect Facebook/Instagram first.");
    }

    const accessToken = metaRow.fb_user_access_token;

    // 3. Fetch Accounts
    try {
        // Fetch Pages and their connected Instagram accounts
        const url = `https://graph.facebook.com/v21.0/me/accounts?fields=name,id,instagram_business_account{id,username,profile_picture_url}&access_token=${accessToken}`;
        const res = await fetch(url);
        const data = await res.json();
        
        if (data.error) {
            console.error("Meta Account Fetch Error:", data.error);
            throw new Error("Failed to fetch Instagram accounts.");
        }

        const pages = data.data || [];
        const validAccounts = pages.filter(p => p.instagram_business_account);

        if (validAccounts.length === 0) {
            throw new Error("No Instagram Business accounts found linked to your Facebook Pages.");
        }

        // 4. Single Account -> Auto-select
        if (validAccounts.length === 1) {
            const acc = validAccounts[0];
            return {
                complete: true,
                businessId: acc.instagram_business_account.id,
                businessName: acc.instagram_business_account.username,
                logoUrl: acc.instagram_business_account.profile_picture_url // opportunistic capture
            };
        }

        // 5. Multiple Accounts -> Check instruction for match
        const lowerInstruction = instruction.toLowerCase();
        const matched = validAccounts.find(acc => 
            lowerInstruction.includes(acc.name.toLowerCase()) || 
            lowerInstruction.includes(acc.instagram_business_account.username.toLowerCase())
        );

        if (matched) {
            return {
                complete: true,
                businessId: matched.instagram_business_account.id,
                businessName: matched.instagram_business_account.username,
                logoUrl: matched.instagram_business_account.profile_picture_url
            };
        }

        // 6. Ambiguous -> Ask User
        const options = validAccounts.map(acc => `@${acc.instagram_business_account.username}`).join(", ");
        return {
            complete: false,
            question: `Which account should I post to? Available: ${options}`
        };

    } catch (e) {
        console.error("resolveBusiness Error:", e);
        // Fallback to what we have in metaRow if API fails, assuming single connection logic in execute.js
        if (metaRow.ig_business_id) {
             return {
                complete: true,
                businessId: metaRow.ig_business_id,
                businessName: "Default Account" 
            };
        }
        throw e;
    }
}
