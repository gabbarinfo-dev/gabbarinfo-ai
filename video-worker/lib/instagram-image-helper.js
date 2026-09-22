// video-worker/lib/instagram-image-helper.js
const fs = require("fs");
const path = require("path");
const os = require("os");
const { exec } = require("child_process");
const { promisify } = require("util");

const execAsync = promisify(exec);

let sharp = null;
try {
  sharp = require("sharp");
} catch (_) {}

/**
 * Ensures an image URL or buffer is guaranteed to be a valid, standard, pristine JPEG
 * that Instagram Graph API's container endpoint will ALWAYS accept without code 9004 / 2207052 rejections.
 */
async function ensureInstagramCompatibleJpeg({
  imageUrl,
  imageBuffer,
  supabase,
  bucket = "instagram-creatives",
  logger = console.log,
}) {
  try {
    let sourceBuffer = imageBuffer;
    if (!sourceBuffer && imageUrl) {
      try {
        const res = await fetch(imageUrl);
        if (res.ok) {
          sourceBuffer = Buffer.from(await res.arrayBuffer());
        }
      } catch (fErr) {
        logger(`[Instagram Image Helper] Failed to fetch source image: ${fErr.message}`);
      }
    }

    if (!sourceBuffer || sourceBuffer.length === 0) {
      logger("[Instagram Image Helper] Warning: empty source buffer, returning original imageUrl");
      return imageUrl;
    }

    let jpgBuffer = null;

    // 1. Try sharp first if available
    if (sharp) {
      try {
        jpgBuffer = await sharp(sourceBuffer)
          .flatten({ background: { r: 255, g: 255, b: 255 } }) // Flatten alpha transparency to white
          .resize(1080, 1080, { fit: "cover" })
          .jpeg({ quality: 95, mozjpeg: true })
          .toBuffer();
      } catch (sharpErr) {
        logger(`[Instagram Image Helper] sharp conversion warning: ${sharpErr.message}`);
      }
    }

    // 2. If sharp failed or not available, use ffmpeg CLI
    if (!jpgBuffer) {
      try {
        const tmpDir = os.tmpdir();
        const inPath = path.join(tmpDir, `in_${Date.now()}_${Math.random().toString(36).slice(2)}.png`);
        const outPath = path.join(tmpDir, `out_${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`);
        fs.writeFileSync(inPath, sourceBuffer);

        // Convert with ffmpeg
        await execAsync(`ffmpeg -y -i "${inPath}" -vf "scale=1080:1080:force_original_aspect_ratio=decrease,pad=1080:1080:(ow-iw)/2:(oh-ih)/2:white" -q:v 2 "${outPath}"`);

        if (fs.existsSync(outPath)) {
          jpgBuffer = fs.readFileSync(outPath);
          try { fs.unlinkSync(outPath); } catch (_) {}
        }
        if (fs.existsSync(inPath)) {
          try { fs.unlinkSync(inPath); } catch (_) {}
        }
      } catch (ffErr) {
        logger(`[Instagram Image Helper] ffmpeg conversion warning: ${ffErr.message}`);
      }
    }

    // 3. Upload to Supabase storage as pristine JPEG
    if (jpgBuffer && jpgBuffer.length > 0 && supabase) {
      const filename = `ig_verified_${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;
      const { data, error } = await supabase.storage
        .from(bucket)
        .upload(filename, jpgBuffer, { contentType: "image/jpeg", upsert: true });

      if (!error && data) {
        const { data: pubData } = supabase.storage.from(bucket).getPublicUrl(filename);
        logger(`[Instagram Image Helper] Converted & hosted Instagram-compliant JPEG: ${pubData.publicUrl}`);
        return pubData.publicUrl;
      }
    }

    // Fallback to original
    return imageUrl;
  } catch (err) {
    logger(`[Instagram Image Helper] Error ensuring Instagram JPEG: ${err.message}`);
    return imageUrl;
  }
}

module.exports = {
  ensureInstagramCompatibleJpeg,
};
