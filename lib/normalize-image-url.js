import fetch from 'node-fetch';

/**
 * Normalizes Google Drive links to direct public image links and validates them.
 * @param {string} url - The URL to normalize.
 * @returns {Promise<string>} - The normalized URL.
 * @throws {Error} - InvalidInstagramImageURL if validation fails.
 */
export async function normalizeImageUrl(url) {
    if (!url) return url;

    let directUrl = url;
    let isGoogleDrive = false;

    // 1. Detect and REJECT Google Drive URLs (Strict Rule)
    if (url.includes("drive.google.com") || url.includes("drive.googleusercontent.com")) {
        throw new Error(
            "Google Drive links are not directly usable. Open the image in a new tab and copy the image URL (lh3.googleusercontent.com)."
        );
    }

    // 2. Accept Google CDN Links (lh3.googleusercontent.com)
    // These are direct, public, and work with Instagram.
    if (url.includes("lh3.googleusercontent.com")) {
        return url; // SAFE
    }

    // 3. Validate Other Public URLs (Path A - Unchanged)
    // We do NOT blindly trust other links. They must be public and valid images.
    let response;
    try {
        response = await fetch(directUrl, { method: 'HEAD', timeout: 5000 });
        if (response.ok) {
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.startsWith('image/')) {
                return directUrl;
            }
        }
    } catch (e) { }

    try {
        response = await fetch(directUrl, {
            method: 'GET',
            headers: { 'Range': 'bytes=0-1024' },
            timeout: 8000
        });

        if (response.ok) {
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.startsWith('image/')) {
                return directUrl;
            }
        }
    } catch (e) { }

    throw new Error(`InvalidInstagramImageURL: Unable to validate image at ${directUrl}`);
}
