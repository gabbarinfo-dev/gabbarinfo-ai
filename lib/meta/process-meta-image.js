
// lib/meta/process-meta-image.js
// Composites a clean professional overlay (service name + offer/headline + business name)
// onto a DALL-E generated base64 image before uploading to Meta.
// Modelled after lib/instagram/process-image.js but simpler and Meta-ad-optimised.

import sharp from "sharp";
import path from "path";
import fs from "fs";
import TextToSVG from "text-to-svg";
import arialFontData from "../fonts/arial-font.json";
const { arialFontBase64 } = arialFontData;

// ─── Accent palette (same as Instagram for brand consistency) ────────────────
const ACCENT_COLORS = [
  "#FFD700", "#FF6B6B", "#00D4FF", "#00E5A0", "#FF9F43", "#C77DFF", "#FF6FD8",
];

/**
 * processMetaAdImage
 *
 * @param {string} imageBase64  - Raw base64 PNG/JPG from DALL-E (NO data-URI prefix)
 * @param {string} service      - Service/product name  e.g. "Hair Smoothening"
 * @param {string} offer        - Short offer text      e.g. "20% OFF This Week"
 * @param {string} businessName - Page / brand name     e.g. "Bella & Diva"
 *
 * @returns {string} processedBase64 — base64 string of the composited PNG
 */
export async function processMetaAdImage({
  imageBase64,
  service = "",
  offer = "",
  businessName = "",
}) {
  console.log("[ProcessMetaAdImage] Starting overlay for:", service);

  try {
    // ── Decode base64 → Buffer ─────────────────────────────────────────────
    const imageBuffer = Buffer.from(imageBase64, "base64");

    // ── Load font ──────────────────────────────────────────────────────────
    const fontPath = path.join("/tmp", "Arial.ttf");
    if (!fs.existsSync(fontPath)) {
      fs.writeFileSync(fontPath, Buffer.from(arialFontBase64, "base64"));
    }
    const textToSVG = TextToSVG.loadSync(fontPath);

    // ── Accent colour — cycles every 3 minutes (matches Instagram) ─────────
    const accentIdx = Math.floor(Date.now() / (3 * 60 * 1000)) % ACCENT_COLORS.length;
    const accentColor = ACCENT_COLORS[accentIdx];

    // ── Text helpers ────────────────────────────────────────────────────────
    const wrapText = (text, fontSize, maxWidth) => {
      if (!text) return [];
      const words = text.split(/\s+/);
      const lines = [];
      let cur = words[0];
      for (let i = 1; i < words.length; i++) {
        const test = cur + " " + words[i];
        if (textToSVG.getMetrics(test, { fontSize }).width > maxWidth) {
          lines.push(cur);
          cur = words[i];
        } else {
          cur = test;
        }
      }
      lines.push(cur);
      return lines;
    };

    const getPath = (text, x, y, size, anchor = "center", color = "#FFFFFF") => {
      if (!text) return "";
      return textToSVG.getPath(text, {
        x, y, fontSize: size, anchor,
        attributes: {
          fill: color,
          stroke: "black",
          "stroke-width": 2,
          "paint-order": "stroke fill",
        },
      });
    };

    // ── Prepare strings ───────────────────────────────────────────────────
    const serviceStr  = (service || "").toUpperCase();
    const brandStr    = (businessName || "").toUpperCase();
    const hasOffer    = offer && offer.trim() !== "" && offer.toLowerCase() !== "none";

    // ── Layout: Bottom Panel (dark gradient) ─────────────────────────────
    //   • Brand name — top-left corner with accent underline
    //   • Service name — large, centred in bottom panel
    //   • Offer text — accent colour below service name
    // ─────────────────────────────────────────────────────────────────────

    const svcLines = wrapText(serviceStr, 58, 900);
    const brandMetrics = textToSVG.getMetrics(brandStr, { fontSize: 20 });

    // Compute panel layout
    const panelY = 700;
    let ty = panelY + 52;
    const parts = [];

    svcLines.forEach((l) => {
      parts.push(getPath(l, 512, ty, 58, "center", "#FFFFFF"));
      ty += 70;
    });

    if (hasOffer) {
      ty += 10;
      parts.push(getPath(offer.toUpperCase(), 512, ty, 34, "center", accentColor));
      ty += 44;
    }

    const overlaySVG = `<svg width="1024" height="1024" xmlns="http://www.w3.org/2000/svg">

      <!-- Top brand bar -->
      <rect x="0" y="0" width="1024" height="90" fill="black" fill-opacity="0.35"/>
      ${getPath(brandStr, 36, 52, 22, "left", "#FFFFFF")}
      <rect x="36" y="62" width="${brandMetrics.width}" height="2.5" fill="${accentColor}"/>

      <!-- Bottom gradient panel -->
      <defs>
        <linearGradient id="metaBG" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stop-color="black" stop-opacity="0"/>
          <stop offset="40%"  stop-color="black" stop-opacity="0.65"/>
          <stop offset="100%" stop-color="black" stop-opacity="0.88"/>
        </linearGradient>
      </defs>
      <rect x="0" y="${panelY - 60}" width="1024" height="${1024 - panelY + 60}" fill="url(#metaBG)"/>

      <!-- Accent top rule on panel -->
      <rect x="80" y="${panelY}" width="864" height="3" rx="1.5" fill="${accentColor}"/>

      <!-- Service name + offer -->
      ${parts.join("\n")}

    </svg>`;

    // ── Composite using sharp ─────────────────────────────────────────────
    const processed = await sharp(imageBuffer)
      .resize(1024, 1024, { fit: "cover" }) // ensure 1024×1024
      .composite([{ input: Buffer.from(overlaySVG), top: 0, left: 0 }])
      .png()
      .toBuffer();

    const resultBase64 = processed.toString("base64");
    console.log("[ProcessMetaAdImage] Overlay complete. Size:", processed.length, "bytes");
    return resultBase64;

  } catch (err) {
    console.error("[ProcessMetaAdImage] Error applying overlay:", err.message);
    // Fail gracefully — return original image so campaign can still proceed
    return imageBase64;
  }
}
