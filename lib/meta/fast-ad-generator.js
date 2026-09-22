// lib/meta/fast-ad-generator.js
import sharp from "sharp";

function escapeXml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Generates an ultra-crisp, high-converting Meta Ad visual in under 200 milliseconds
 * using Sharp vector SVG compositing. Completely bypasses DALL-E latency and avoids
 * Vercel FUNCTION_INVOCATION_TIMEOUT completely.
 */
export async function generateFastBrandedAdVisual({
  supabaseClient,
  service = "Digital Marketing",
  location = "India",
  offer = "",
  tagline = "",
  businessName = "GABBARINFO AI",
  cta = "LEARN MORE",
}) {
  const cleanBrand = escapeXml((businessName || "GABBARINFO AI").toUpperCase().slice(0, 32));
  const cleanService = escapeXml((service || "Digital Marketing").toUpperCase().slice(0, 50));
  const cleanLocation = escapeXml((location || "").toUpperCase().slice(0, 40));
  const cleanOffer = escapeXml((offer || "Maximize Conversions & Traffic").slice(0, 55));
  const cleanTagline = escapeXml((tagline || "Autonomous Growth AI").slice(0, 60));
  const cleanCTA = escapeXml((cta || "LEARN MORE").toUpperCase().replace(/_/g, " "));

  // Words split for balanced 2-line service headline
  const serviceWords = cleanService.split(" ");
  const mid = Math.ceil(serviceWords.length / 2);
  const line1 = serviceWords.slice(0, mid).join(" ") || cleanService;
  const line2 = serviceWords.length > 1 ? serviceWords.slice(mid).join(" ") : "";

  const svg = `
  <svg width="1080" height="1080" viewBox="0 0 1080 1080" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#04060d"/>
        <stop offset="40%" stop-color="#0b1120"/>
        <stop offset="100%" stop-color="#1e1b4b"/>
      </linearGradient>
      <linearGradient id="brandGrad" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="#6366f1"/>
        <stop offset="100%" stop-color="#00d4ff"/>
      </linearGradient>
      <linearGradient id="accentGrad" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="#ff9f43"/>
        <stop offset="100%" stop-color="#ffd700"/>
      </linearGradient>
      <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
        <feDropShadow dx="0" dy="4" stdDeviation="6" flood-opacity="0.5"/>
      </filter>
    </defs>

    <!-- Deep Tech Gradient Canvas -->
    <rect width="1080" height="1080" fill="url(#bg)"/>

    <!-- Subtle Ambient Neon Glows -->
    <circle cx="540" cy="380" r="300" fill="#6366f1" fill-opacity="0.09"/>
    <circle cx="540" cy="380" r="200" fill="#00d4ff" fill-opacity="0.07"/>

    <!-- Top Brand Tag -->
    <g transform="translate(540, 140)">
      <rect x="-190" y="-24" width="380" height="48" rx="24" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.18)" stroke-width="1.5"/>
      <circle cx="-150" cy="0" r="6" fill="#00d4ff"/>
      <text x="-130" y="6" font-family="system-ui, -apple-system, sans-serif" font-size="16" font-weight="700" fill="#E2E8F0" letter-spacing="2">${cleanBrand}</text>
    </g>

    <!-- Service Title (Bold & Legible) -->
    <text x="540" y="${line2 ? 360 : 390}" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="52" font-weight="900" fill="#FFFFFF" letter-spacing="1" filter="url(#shadow)">
      ${line1}
    </text>
    ${line2 ? `
    <text x="540" y="425" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="52" font-weight="900" fill="url(#brandGrad)" letter-spacing="1" filter="url(#shadow)">
      ${line2}
    </text>
    ` : ""}

    <!-- Location Pill -->
    ${cleanLocation ? `
    <g transform="translate(540, 510)">
      <rect x="-180" y="-22" width="360" height="44" rx="22" fill="rgba(99,102,241,0.22)" stroke="rgba(99,102,241,0.4)" stroke-width="1.2"/>
      <text x="0" y="7" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="20" font-weight="700" fill="#C7D2FE" letter-spacing="0.5">
        📍 ${cleanLocation}
      </text>
    </g>
    ` : ""}

    <!-- Tagline -->
    ${cleanTagline ? `
    <text x="540" y="600" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="24" font-weight="500" fill="#94A3B8" letter-spacing="0.3">
      ${cleanTagline}
    </text>
    ` : ""}

    <!-- Value Proposition / Offer Badge -->
    <g transform="translate(540, 710)">
      <rect x="-310" y="-36" width="620" height="72" rx="36" fill="url(#accentGrad)" filter="url(#shadow)"/>
      <text x="0" y="10" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="26" font-weight="900" fill="#050811" letter-spacing="0.5">
        ⚡ ${cleanOffer}
      </text>
    </g>

    <!-- Call to Action Button -->
    <g transform="translate(540, 890)">
      <rect x="-190" y="-30" width="380" height="60" rx="30" fill="url(#brandGrad)" filter="url(#shadow)"/>
      <text x="0" y="8" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="22" font-weight="800" fill="#FFFFFF" letter-spacing="2">
        ${cleanCTA} →
      </text>
    </g>
  </svg>
  `;

  const jpegBuffer = await sharp(Buffer.from(svg))
    .jpeg({ quality: 88, mozjpeg: true })
    .toBuffer();

  const storageFileName = `meta_ad_fast_${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;

  if (supabaseClient) {
    try {
      const { error: uploadError } = await supabaseClient.storage
        .from("instagram-creatives")
        .upload(storageFileName, jpegBuffer, { contentType: "image/jpeg" });

      if (!uploadError) {
        const { data: { publicUrl } } = supabaseClient.storage
          .from("instagram-creatives")
          .getPublicUrl(storageFileName);

        return {
          ok: true,
          imageUrl: publicUrl,
          storageFileName,
          imageBuffer: jpegBuffer,
        };
      } else {
        console.warn("⚠️ Supabase storage upload warning:", uploadError.message);
      }
    } catch (sErr) {
      console.warn("⚠️ Supabase storage exception:", sErr.message);
    }
  }

  return {
    ok: true,
    imageUrl: `data:image/jpeg;base64,${jpegBuffer.toString("base64")}`,
    storageFileName,
    imageBuffer: jpegBuffer,
  };
}
