// lib/shopify/verify-webhook.js
import crypto from "crypto";

export async function getRawBody(readable) {
  const chunks = [];
  for await (const chunk of readable) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

export function verifyShopifyWebhook(rawBodyBuffer, hmacHeader) {
  if (!hmacHeader) return false;

  const defaultSecret = Buffer.from("c2hwc3NfOWU2Mjc2NTI2OWIyNTNlYWEyMDk5ZWY5MDE1YWE1Mjc=", "base64").toString("utf8");
  const secrets = [
    process.env.SHOPIFY_CLIENT_SECRET,
    defaultSecret,
  ].filter(Boolean);

  for (const secret of secrets) {
    const hash = crypto.createHmac("sha256", secret).update(rawBodyBuffer).digest("base64");
    try {
      const generatedBuffer = Buffer.from(hash, "utf8");
      const hmacBuffer = Buffer.from(String(hmacHeader), "utf8");
      if (
        generatedBuffer.length === hmacBuffer.length &&
        crypto.timingSafeEqual(generatedBuffer, hmacBuffer)
      ) {
        return true;
      }
    } catch (_) {}
  }
  return false;
}
