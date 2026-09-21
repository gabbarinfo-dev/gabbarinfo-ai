// lib/shopify/token-service.js

export async function getValidShopifyAccessToken(connection, email, supabase) {
  if (!connection) return null;

  // Custom App tokens or non-refreshable tokens
  if (!connection.refresh_token) {
    return connection.access_token;
  }

  // If token is expiring soon (within 5 minutes) or already expired
  const isExpiringSoon = connection.expires_at && (Date.now() + 5 * 60 * 1000 > connection.expires_at);
  if (!isExpiringSoon && connection.access_token) {
    return connection.access_token;
  }

  // Refresh expiring offline token
  const clientId = process.env.SHOPIFY_CLIENT_ID;
  const clientSecret = process.env.SHOPIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) return connection.access_token;

  try {
    const refreshRes = await fetch(`https://${connection.shop}/admin/oauth/access_token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "refresh_token",
        refresh_token: connection.refresh_token,
      }),
    });

    if (refreshRes.ok) {
      const data = await refreshRes.json();
      const updatedConnection = {
        ...connection,
        access_token: data.access_token,
        refresh_token: data.refresh_token || connection.refresh_token,
        expires_at: Date.now() + ((data.expires_in || 3600) * 1000),
        updated_at: new Date().toISOString(),
      };

      if (supabase && email) {
        if (connection.shop) {
          const normShop = connection.shop.toLowerCase().trim().replace(/[^a-z0-9]/g, "_");
          await supabase.from("agent_memory").upsert(
            {
              email,
              memory_type: `shopify_conn_${normShop}`,
              content: JSON.stringify(updatedConnection),
              updated_at: new Date().toISOString(),
            },
            { onConflict: "email,memory_type" }
          );
        }
        await supabase.from("agent_memory").upsert(
          {
            email,
            memory_type: "shopify_connection",
            content: JSON.stringify(updatedConnection),
            updated_at: new Date().toISOString(),
          },
          { onConflict: "email,memory_type" }
        );
      }

      return updatedConnection.access_token;
    } else {
      const errTxt = await refreshRes.text();
      console.error("Shopify token refresh failed:", errTxt);
    }
  } catch (e) {
    console.error("Exception refreshing Shopify token:", e);
  }

  return connection.access_token;
}
