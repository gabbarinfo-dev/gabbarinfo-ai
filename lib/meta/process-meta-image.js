

// lib/meta/process-meta-image.js
// Composites a clean professional overlay onto a DALL-E base64 image.
// Layout (bottom-up):
//   ① Brand name + accent underline  — top-left bar
//   ② Service name (large, white, centred)  — bottom panel
//   ③ Tagline (medium, white, italic style) — below service
//   ④ Offer text (accent colour, bold)      — below tagline

import sharp from "sharp";
import path from "path";
import fs from "fs";
import TextToSVG from "text-to-svg";
import arialFontData from "../fonts/arial-font.json";
const { arialFontBase64 } = arialFontData;

// ─── Accent palette ───────────────────────────────────────────────────────────
const ACCENT_COLORS = [
  "#FFD700", "#FF6B6B", "#00D4FF", "#00E5A0", "#FF9F43", "#C77DFF", "#FF6FD8",
];

/**
 * processMetaAdImage
 *
 * @param {string} imageBase64  - Raw base64 PNG/JPG from DALL-E (NO data-URI prefix)
 * @param {string} service      - Service/product name  e.g. "Hair Smoothening"
 * @param {string} offer        - Short offer text      e.g. "20% OFF This Week"
 * @param {string} tagline      - Punchy tagline        e.g. "Look Your Best Today"
 * @param {string} businessName - Page / brand name     e.g. "Bella & Diva"
 *
 * @returns {string} processedBase64 — base64 string of the composited JPEG (q85)
 * NOTE: Output is JPEG to stay well within Meta's upload size limits.
 */
export async function processMetaAdImage({
  imageBase64,
  service = "",
  offer = "",
  tagline = "",
  businessName = "",
}) {
  console.log("[ProcessMetaAdImage] Starting overlay for:", service, "| offer:", offer, "| tagline:", tagline);

  try {
    // ── Decode base64 → Buffer ─────────────────────────────────────────────
    const imageBuffer = Buffer.from(imageBase64, "base64");

    // ── Load font ──────────────────────────────────────────────────────────
    const fontPath = path.join("/tmp", "Arial.ttf");
    if (!fs.existsSync(fontPath)) {
      fs.writeFileSync(fontPath, Buffer.from(arialFontBase64, "base64"));
    }
    const textToSVG = TextToSVG.loadSync(fontPath);

    // ── Accent colour — cycles every 3 minutes ─────────────────────────────
    const accentIdx =
      Math.floor(Date.now() / (3 * 60 * 1000)) % ACCENT_COLORS.length;
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

    const getPath = (
      text,
      x,
      y,
      size,
      anchor = "center",
      color = "#FFFFFF"
    ) => {
      if (!text) return "";
      return textToSVG.getPath(text, {
        x,
        y,
        fontSize: size,
        anchor,
        attributes: {
          fill: color,
          stroke: "black",
          "stroke-width": 2,
          "paint-order": "stroke fill",
        },
      });
    };

    // ── Prepare strings ────────────────────────────────────────────────
    const serviceStr = (service || "").toUpperCase();
    const brandStr   = (businessName || "").toUpperCase();
    const taglineStr = tagline ? tagline.trim() : "";
    const hasOffer   =
      offer && offer.trim() !== "" && offer.toLowerCase() !== "none";

    const brandMetrics = textToSVG.getMetrics(brandStr, { fontSize: 20 });

    // ── Auto-scale service font for long names ─────────────────────────
    // Keeps text inside the image no matter how long the service name is
    const svcFontSize =
      serviceStr.length > 38 ? 38 :
      serviceStr.length > 28 ? 46 : 56;
    const svcLineHeight = svcFontSize + 10;

    // ── Pre-calculate all line counts to derive a dynamic panelY ──────
    const svcLines    = wrapText(serviceStr, svcFontSize, 920);
    const tagLines    = taglineStr ? wrapText(taglineStr, 28, 860) : [];
    const offerLines  = hasOffer ? wrapText(offer.toUpperCase(), 34, 880) : [];

    const contentHeight =
      svcLines.length  * svcLineHeight +
      (tagLines.length  > 0 ? 6  + tagLines.length  * 36 : 0) +
      (offerLines.length > 0 ? 8  + offerLines.length * 42 : 0);

    // Panel starts high enough so all text fits (50 top-pad + content + 24 bottom)
    const neededPanelY = 1024 - 50 - contentHeight - 24;
    const panelY = Math.min(690, Math.max(480, neededPanelY));

    let ty = panelY + 50;
    const parts = [];

    // ① Service name — large, white, centred (font auto-scaled)
    svcLines.forEach((l) => {
      parts.push(getPath(l, 512, ty, svcFontSize, "center", "#FFFFFF"));
      ty += svcLineHeight;
    });

    // ② Tagline — smaller, slightly dimmed white, centred
    if (tagLines.length > 0) {
      ty += 6;
      tagLines.forEach((l) => {
        parts.push(getPath(l, 512, ty, 28, "center", "#E0E0E0"));
        ty += 36;
      });
    }

    // ③ Offer — accent colour, bold, centred
    if (offerLines.length > 0) {
      ty += 8;
      offerLines.forEach((l) => {
        parts.push(getPath(l, 512, ty, 34, "center", accentColor));
        ty += 42;
      });
    }

    // ── Build SVG overlay ──────────────────────────────────────────────────
    const overlaySVG = `<svg width="1024" height="1024" xmlns="http://www.w3.org/2000/svg">

      <!-- Top brand bar -->
      <rect x="0" y="0" width="1024" height="90" fill="black" fill-opacity="0.38"/>
      ${getPath(brandStr, 36, 52, 22, "left", "#FFFFFF")}
      <rect x="36" y="62" width="${brandMetrics.width}" height="2.5" fill="${accentColor}"/>

      <!-- Bottom gradient panel -->
      <defs>
        <linearGradient id="metaBG" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stop-color="black" stop-opacity="0"/>
          <stop offset="35%"  stop-color="black" stop-opacity="0.60"/>
          <stop offset="100%" stop-color="black" stop-opacity="0.90"/>
        </linearGradient>
      </defs>
      <rect x="0" y="${panelY - 60}" width="1024" height="${1024 - panelY + 60}" fill="url(#metaBG)"/>

      <!-- Accent rule at panel top -->
      <rect x="80" y="${panelY}" width="864" height="3" rx="1.5" fill="${accentColor}"/>

      <!-- Service + tagline + offer text -->
      ${parts.join("\n")}

    </svg>`;

    // ── Composite with sharp — output JPEG (q85) for Meta upload compatibility ─
    // PNG at 1024×1024 is 2–5 MB; JPEG q85 keeps it under 500 KB.
    const processed = await sharp(imageBuffer)
      .resize(1024, 1024, { fit: "cover" })
      .composite([{ input: Buffer.from(overlaySVG), top: 0, left: 0 }])
      .jpeg({ quality: 85, mozjpeg: true })
      .toBuffer();

    const resultBase64 = processed.toString("base64");
    console.log(
      "[ProcessMetaAdImage] Overlay complete (JPEG q85). Size:",
      processed.length,
      "bytes"
    );
    return resultBase64;
  } catch (err) {
    console.error("[ProcessMetaAdImage] Error applying overlay:", err.message);
    // Fail gracefully — return original image so campaign can still proceed
    return imageBase64;
  }
}
