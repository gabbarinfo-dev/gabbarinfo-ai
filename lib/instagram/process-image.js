
import sharp from "sharp";
import fetch from "node-fetch";
import path from "path";
import fs from "fs";
import TextToSVG from "text-to-svg";
import { supabaseServer } from "../supabaseServer";
import arialFontData from "../fonts/arial-font.json";
const { arialFontBase64 } = arialFontData;

// Accent color palette — each template pick is randomised from this list
const ACCENT_COLORS = ["#FFD700", "#FF6B6B", "#00D4FF", "#00E5A0", "#FF9F43", "#C77DFF", "#FF6FD8"];
const LAYOUTS = ["A", "B", "C", "D", "E"];

/**
 * processImage — Overlays one of 5 random layout templates onto a DALL-E background.
 *
 * Layouts:
 *   A — Classic Center strip (refined original)
 *   B — Solid Bottom Card panel
 *   C — Top Headline + gradient bars
 *   D — Left-Side Column gradient
 *   E — Minimal Floating (no panel, heavy text stroke)
 */
export async function processImage({
    imageUrl,
    businessName,
    service,
    tagline,
    offer,
    contact,
    contactMethod,
    email,
    sessionId,
    layoutHint   // optional: "A"|"B"|"C"|"D"|"E" — from caption AI
}) {
    console.log("[ProcessImage] Starting for:", service);

    try {
        const response = await fetch(imageUrl);
        if (!response.ok) throw new Error(`Failed to fetch DALL-E image: ${response.statusText}`);
        const imageBuffer = Buffer.from(await response.arrayBuffer());

        const fontPath = path.join("/tmp", "Arial.ttf");
        if (!fs.existsSync(fontPath)) {
            fs.writeFileSync(fontPath, Buffer.from(arialFontBase64, "base64"));
        }
        const textToSVG = TextToSVG.loadSync(fontPath);

        // ── Choose template & accent ─────────────────────────────────────
        // Layout is controlled by creative-entry.js rotation counter.
        // Fallback to random only if called directly without a hint.
        const templateId = (layoutHint && LAYOUTS.includes(layoutHint))
            ? layoutHint
            : LAYOUTS[Math.floor(Math.random() * LAYOUTS.length)];

        // Accent color cycles every 3 minutes — always fresh, never fixed
        const accentIdx = Math.floor(Date.now() / (3 * 60 * 1000)) % ACCENT_COLORS.length;
        const accentColor = ACCENT_COLORS[accentIdx];
        console.log(`[ProcessImage] Template: ${templateId} | Accent: ${accentColor}`);

        // ── Shared utilities ─────────────────────────────────────────────
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

        // Standard path: stroke+fill for legibility on any background
        const getPath = (text, x, y, size, anchor = "center", color = "#FFFFFF", italic = false) => {
            if (!text) return "";
            const opts = {
                x, y, fontSize: size, anchor,
                attributes: { fill: color, stroke: "black", "stroke-width": 1.8, "paint-order": "stroke fill" }
            };
            if (italic) opts.attributes.transform = `skewX(-12) translate(${-y * Math.tan(-12 * Math.PI / 180)}, 0)`;
            return textToSVG.getPath(text, opts);
        };

        // Heavy-stroke path for minimal/no-panel templates
        const getBoldPath = (text, x, y, size, anchor = "center", color = "#FFFFFF") => {
            if (!text) return "";
            return textToSVG.getPath(text, {
                x, y, fontSize: size, anchor,
                attributes: { fill: color, stroke: "#000000", "stroke-width": 9, "paint-order": "stroke fill" }
            });
        };

        const iconPath = contactMethod === "website"
            ? "M256 8C119 8 8 119 8 256s111 248 248 248 248-111 248-248S393 8 256 8zm0 448c-110.5 0-200-89.5-200-200S145.5 56 256 56s200 89.5 200 200-89.5 200-200 200zm128-200c0 44.3-35.8 80-80 80s-80-35.7-80-80 35.8-80 80-80 80 35.7 80 80z"
            : contactMethod === "none"
            ? "M448 0H64C28.7 0 0 28.7 0 64v288c0 35.3 28.7 64 64 64h96v84c0 9.8 11.2 15.5 19.1 9.7L304 416h144c35.3 0 64-28.7 64-64V64c0-35.3-28.7-64-64-64z"
            : "M386 322c-15-15-38-15-53 0l-30 30-74-74 30-30c15-15 15-38 0-53l-60-60c-15-15-38-15-53 0l-45 45c-15 15-20 37-14 56 30 100 110 180 210 210 19 6 41 1 56-14l45-45c15-15 15-38 0-53l-60-60z";

        const contactDisplay = contactMethod === "none" ? "DM us" : contact;
        const brandStr = (businessName || "").toUpperCase();

        let overlaySVG = "";

        // ═══════════════════════════════════════════════════════════════
        // TEMPLATE A — Classic Center Strip (refined)
        //   Business name: top-left with accent underline
        //   Service title: centre, large, in dark rounded rect
        //   Tagline: italic below title
        //   Offer: accent colour below tagline
        //   Contact: bottom-right with circle icon
        // ═══════════════════════════════════════════════════════════════
        if (templateId === "A") {
            const svcLines = wrapText(service.toUpperCase(), 64, 840);
            const tagLines = wrapText(tagline, 28, 840);
            const brandMetrics = textToSVG.getMetrics(brandStr, { fontSize: 22 });

            let ty = 455;
            const parts = [];
            svcLines.forEach(l => { parts.push(getPath(l, 512, ty, 64, "center", "#FFFFFF")); ty += 76; });
            ty += 8;
            tagLines.forEach(l => { parts.push(getPath(l, 512, ty, 28, "center", "#EEEEEE", true)); ty += 36; });
            if (offer && offer !== "None") {
                ty += 22;
                parts.push(getPath(offer.toUpperCase(), 512, ty, 40, "center", accentColor));
                ty += 48;
            }

            const boxH = ty - 388;
            const contactMetrics = textToSVG.getMetrics(contactDisplay, { fontSize: 26 });
            const iconX = 984 - contactMetrics.width - 44;

            overlaySVG = `<svg width="1024" height="1024" xmlns="http://www.w3.org/2000/svg">
                <rect x="0" y="0" width="1024" height="102" fill="black" fill-opacity="0.28"/>
                ${getPath(brandStr, 40, 58, 22, "left")}
                <rect x="40" y="70" width="${brandMetrics.width}" height="2.5" fill="${accentColor}"/>
                <rect x="62" y="388" width="900" height="${boxH}" rx="18" fill="black" fill-opacity="0.52"/>
                ${parts.join("\n")}
                <defs><linearGradient id="bgA" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stop-color="black" stop-opacity="0"/>
                    <stop offset="100%" stop-color="black" stop-opacity="0.72"/>
                </linearGradient></defs>
                <rect x="0" y="810" width="1024" height="214" fill="url(#bgA)"/>
                <g transform="translate(${iconX},956) scale(0.048)">
                    <circle cx="256" cy="256" r="256" fill="${accentColor}"/>
                    <path d="${iconPath}" fill="black"/>
                </g>
                ${getPath(contactDisplay, 984, 984, 26, "right")}
            </svg>`;
        }

        // ═══════════════════════════════════════════════════════════════
        // TEMPLATE B — Solid Bottom Card
        //   No top bar; business name top-right
        //   Solid dark panel anchored to bottom 42%
        //   Bold accent rule at panel top edge
        //   Title, tagline, offer inside panel
        //   Contact centred at very bottom
        // ═══════════════════════════════════════════════════════════════
        else if (templateId === "B") {
            const svcLines = wrapText(service.toUpperCase(), 52, 900);
            const tagLines = wrapText(tagline, 22, 900);

            // Panel starts at 730 → covers only bottom ~29% instead of 44%
            const panelY = 730;
            let ty = panelY + 50;
            const parts = [];
            svcLines.forEach(l => { parts.push(getPath(l, 512, ty, 52, "center", "#FFFFFF")); ty += 62; });
            ty += 4;
            tagLines.forEach(l => { parts.push(getPath(l, 512, ty, 22, "center", "#CCCCCC", true)); ty += 28; });
            if (offer && offer !== "None") {
                ty += 12;
                parts.push(getPath(offer.toUpperCase(), 512, ty, 30, "center", accentColor));
            }

            overlaySVG = `<svg width="1024" height="1024" xmlns="http://www.w3.org/2000/svg">
                <rect x="0" y="0" width="1024" height="82" fill="black" fill-opacity="0.18"/>
                ${getPath(brandStr, 984, 50, 20, "right", "#FFFFFF")}
                <defs><linearGradient id="bgB" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stop-color="black" stop-opacity="0"/>
                    <stop offset="40%" stop-color="black" stop-opacity="0.72"/>
                    <stop offset="100%" stop-color="black" stop-opacity="0.82"/>
                </linearGradient></defs>
                <rect x="0" y="${panelY - 80}" width="1024" height="${1024 - panelY + 80}" fill="url(#bgB)"/>
                <rect x="120" y="${panelY}" width="784" height="3" rx="1.5" fill="${accentColor}"/>
                ${parts.join("\n")}
                ${getPath(contactDisplay, 512, 1006, 20, "center", "#999999")}
            </svg>`;
        }


        // ═══════════════════════════════════════════════════════════════
        // TEMPLATE C — Top Headline
        //   Strong title at top with gradient fade-down
        //   Accent underline rule below title
        //   Italic tagline below rule
        //   Bottom gradient with brand left + offer centre + contact right
        // ═══════════════════════════════════════════════════════════════
        else if (templateId === "C") {
            const svcLines = wrapText(service.toUpperCase(), 58, 920);
            const tagLines = wrapText(tagline, 26, 900);
            const brandMetrics = textToSVG.getMetrics(brandStr, { fontSize: 20 });
            const contactMetrics = textToSVG.getMetrics(contactDisplay, { fontSize: 22 });
            const iconX = 984 - contactMetrics.width - 38;

            let ty = 86;
            const topParts = [];
            svcLines.forEach(l => { topParts.push(getPath(l, 512, ty, 58, "center", "#FFFFFF")); ty += 70; });
            const ruleW = Math.min(360, svcLines.reduce((mx, l) => Math.max(mx, textToSVG.getMetrics(l, { fontSize: 58 }).width), 0));
            const ruleSVG = `<rect x="${512 - ruleW / 2}" y="${ty + 4}" width="${ruleW}" height="3" rx="1.5" fill="${accentColor}"/>`;
            ty += 22;
            tagLines.forEach(l => { topParts.push(getPath(l, 512, ty, 26, "center", "#DDDDDD", true)); ty += 32; });

            const offerPart = (offer && offer !== "None")
                ? getPath(offer.toUpperCase(), 512, 938, 34, "center", accentColor) : "";

            overlaySVG = `<svg width="1024" height="1024" xmlns="http://www.w3.org/2000/svg">
                <defs>
                    <linearGradient id="tGC" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stop-color="black" stop-opacity="0.78"/>
                        <stop offset="100%" stop-color="black" stop-opacity="0"/>
                    </linearGradient>
                    <linearGradient id="bGC" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stop-color="black" stop-opacity="0"/>
                        <stop offset="100%" stop-color="black" stop-opacity="0.78"/>
                    </linearGradient>
                </defs>
                <rect x="0" y="0" width="1024" height="340" fill="url(#tGC)"/>
                ${topParts.join("\n")}
                ${ruleSVG}
                <rect x="0" y="830" width="1024" height="194" fill="url(#bGC)"/>
                ${offerPart}
                ${getPath(brandStr, 40, 968, 20, "left", "#FFFFFF")}
                <rect x="40" y="972" width="${brandMetrics.width}" height="2" fill="${accentColor}"/>
                <g transform="translate(${iconX},942) scale(0.046)">
                    <circle cx="256" cy="256" r="256" fill="white"/>
                    <path d="${iconPath}" fill="black"/>
                </g>
                ${getPath(contactDisplay, 984, 968, 22, "right", "#CCCCCC")}
            </svg>`;
        }

        // ═══════════════════════════════════════════════════════════════
        // TEMPLATE D — Left-Side Column
        //   Left gradient panel covering ~42% width
        //   Vertical accent bar
        //   Business name top-left
        //   Title, tagline, offer stacked left-aligned
        //   Contact bottom-left
        // ═══════════════════════════════════════════════════════════════
        else if (templateId === "D") {
            const maxW = 380;
            const svcLines = wrapText(service.toUpperCase(), 46, maxW - 30);
            const tagLines = wrapText(tagline, 22, maxW - 30);
            const panelW = 430;
            const brandMetrics = textToSVG.getMetrics(brandStr, { fontSize: 18 });
            const contactMetrics = textToSVG.getMetrics(contactDisplay, { fontSize: 20 });
            const iconX = 50 + contactMetrics.width + 12;

            let ty = 148;
            const parts = [];
            svcLines.forEach(l => { parts.push(getPath(l, 50, ty, 46, "left", "#FFFFFF")); ty += 56; });
            ty += 14;
            tagLines.forEach(l => { parts.push(getPath(l, 50, ty, 22, "left", "#CCCCCC", true)); ty += 28; });
            if (offer && offer !== "None") {
                ty += 18;
                parts.push(getPath(offer.toUpperCase(), 50, ty, 30, "left", accentColor));
                ty += 38;
            }

            overlaySVG = `<svg width="1024" height="1024" xmlns="http://www.w3.org/2000/svg">
                <defs>
                    <linearGradient id="lGD" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stop-color="black" stop-opacity="0.86"/>
                        <stop offset="100%" stop-color="black" stop-opacity="0"/>
                    </linearGradient>
                </defs>
                <rect x="0" y="0" width="${panelW}" height="1024" fill="url(#lGD)"/>
                <rect x="28" y="80" width="4" height="${Math.min(ty + 60, 900)}" rx="2" fill="${accentColor}"/>
                ${getPath(brandStr, 50, 96, 18, "left", "#FFFFFF")}
                <rect x="50" y="100" width="${brandMetrics.width}" height="2" fill="${accentColor}"/>
                ${parts.join("\n")}
                ${getPath(contactDisplay, 50, 974, 20, "left", "#CCCCCC")}
                <g transform="translate(${iconX},952) scale(0.044)">
                    <circle cx="256" cy="256" r="256" fill="${accentColor}"/>
                    <path d="${iconPath}" fill="black"/>
                </g>
            </svg>`;
        }

        // ═══════════════════════════════════════════════════════════════
        // TEMPLATE E — Minimal Floating (no panel at all)
        //   Heavy stroke text directly on photo
        //   Accent-coloured tagline / offer
        //   Thin decorative divider line
        //   Business name top-left, contact bottom-right
        // ═══════════════════════════════════════════════════════════════
        else {
            const svcLines = wrapText(service.toUpperCase(), 70, 940);
            const tagLines = wrapText(tagline, 28, 940);

            let ty = 470;
            const parts = [];
            svcLines.forEach(l => { parts.push(getBoldPath(l, 512, ty, 70, "center", "#FFFFFF")); ty += 84; });
            // Accent divider
            const divY = ty + 8;
            const divSVG = `<line x1="200" y1="${divY}" x2="824" y2="${divY}" stroke="${accentColor}" stroke-width="2.5" stroke-linecap="round"/>`;
            ty += 28;
            tagLines.forEach(l => { parts.push(getBoldPath(l, 512, ty, 28, "center", accentColor)); ty += 36; });
            if (offer && offer !== "None") {
                ty += 18;
                parts.push(getBoldPath(offer.toUpperCase(), 512, ty, 38, "center", "#FFFFFF"));
            }

            overlaySVG = `<svg width="1024" height="1024" xmlns="http://www.w3.org/2000/svg">
                ${getBoldPath(brandStr, 40, 56, 20, "left", "#FFFFFF")}
                ${parts.join("\n")}
                ${divSVG}
                ${getBoldPath(contactDisplay, 984, 984, 24, "right", "#FFFFFF")}
            </svg>`;
        }

        // ── Composite & upload ───────────────────────────────────────────
        const processed = await sharp(imageBuffer)
            .composite([{ input: Buffer.from(overlaySVG), top: 0, left: 0 }])
            .png()
            .toBuffer();

        const fileName = `ig_${sessionId || Date.now()}.png`;
        const { error: uploadErr } = await supabaseServer.storage
            .from("instagram-creatives")
            .upload(fileName, processed, { contentType: "image/png", upsert: true });
        if (uploadErr) throw uploadErr;

        const { data: { publicUrl } } = supabaseServer.storage
            .from("instagram-creatives")
            .getPublicUrl(fileName);

        console.log(`[ProcessImage] Done. Template ${templateId}, file: ${fileName}`);
        return { finalImageUrl: publicUrl, fileName, templateUsed: templateId };

    } catch (e) {
        console.error("[ProcessImage] Error:", e);
        throw e;
    }
}
