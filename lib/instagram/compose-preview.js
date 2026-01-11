// lib/instagram/compose-preview.js

export function composePreview(state) {
    const { content, assets } = state;
    
    if (!content.imageUrl || !content.caption) {
        return "⚠️ Preview not available. Content generation incomplete.";
    }

    const hashtags = content.hashtags.join(" ");
    
    return `
🎨 **Preview Your Post**

**Image**: [Generated Image](${content.imageUrl})
(Includes logo: "${state.businessName}" & Footer: "${assets.websiteUrl || "Phone/City"}")

**Caption**:
${content.caption}

${hashtags}

---
**Ready to publish?** Reply "Yes" to confirm, or tell me what to change (e.g., "Change caption to...", "Regenerate image").
    `.trim();
}
