// pages/_app.js
"use client";

import React from "react";
import { SessionProvider } from "next-auth/react";

/*
  If you have a global CSS import it here, e.g.
  import "../styles/globals.css";
  (If you don't have global css, ignore)
*/

export default function App({ Component, pageProps }) {
  // pageProps.session is injected by NextAuth server-side when present
  return (
    <SessionProvider session={pageProps.session}>
      <Component {...pageProps} />
    </SessionProvider>
  );
}
