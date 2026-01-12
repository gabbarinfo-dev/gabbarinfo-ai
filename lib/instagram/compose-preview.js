// lib/instagram/compose-preview.js


export default function composePreview(state) {
    const { content, assets } = state;

    if (!content.imageUrl || !content.caption) {
        return "⚠️ Preview not available. Content generation incomplete.";
    }

    const hashtags = content.hashtags.join(" ");

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

    return `
🎨 **Post Preview**

**Image Details:**
[View Generated Image](${content.imageUrl})
- **Logo Source:** ${logoDisplay}
- **Footer Content:** ${footerDisplay}
- **Visual Theme:** ${state.context.service} for ${state.businessCategory || "Business"}

**Caption:**
${content.caption}

**Hashtags:**
${hashtags}

---
**Ready to publish?**
    `.trim();
}
