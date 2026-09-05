// lib/instagram/compose-preview.js

export function composePreview(state) {
    const { content, assets } = state;

    if (!content.imageUrl || !content.caption) {
        return "⚠️ Preview not available. Content generation incomplete.";
    }

    const hashtags = (content.hashtags || []).join(" ");

    // Resolve Footer Text for Display
    let footerDisplay = "None";
    if (assets.contactMethod !== "none") {
        if (assets.contactMethod === "website" && assets.websiteUrl) footerDisplay = `Website: ${assets.websiteUrl}`;
        else if ((assets.contactMethod === "phone" || assets.contactMethod === "whatsapp") && assets.phone) footerDisplay = `Phone: ${assets.phone}`;
    }

    // Resolve Logo Display
    let logoDisplay = "None";
    if (assets.logoDecision === "use_logo") logoDisplay = "Business Logo (Image)";
    else if (assets.logoDecision === "use_text") logoDisplay = `Text Logo ("${state.businessName}")`;

    const isFb = state.targetPlatform === "facebook";
    const primaryOption = isFb
        ? `• **Option 1 (Default):** Publish **Only to Facebook Page** (\`${state.businessName || "Facebook Page"}\`)`
        : `• **Option 1 (Default):** Publish **Only to Instagram**`;
    const crossOption = isFb
        ? `• **Option 2:** Publish on **Both Facebook Page & Connected Instagram** *(Cross-Post)*`
        : `• **Option 2:** Publish on **Both Instagram & Connected Facebook Page** *(Cross-Post)*`;

    return `
🎨 **Post Preview**

**Image Details:**
[View Generated Image](${content.imageUrl})
- **Logo Source:** ${logoDisplay}
- **Footer Content:** ${footerDisplay}
- **Tagline:** ${content.tagline || "None"}
- **Visual Theme:** ${state.context?.service || "Brand Post"} for ${state.businessCategory || "Business"}

**Caption:**
${content.caption}

**Hashtags:**
${hashtags}

---
📢 **Where would you like to publish?**
${primaryOption}
${crossOption}

👉 Reply **"Option 1"** (or "Yes"), **"Option 2"** (or "Both"), or tell me what to change!
    `.trim();
}
