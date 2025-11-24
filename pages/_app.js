// pages/_app.js
"use client"; // ensures the App is treated as a client component

import React from "react";
import { SessionProvider } from "next-auth/react";

export default function MyApp({ Component, pageProps }) {
  // pageProps may include session when NextAuth passes it
  return (
    <SessionProvider session={pageProps.session}>
      <Component {...pageProps} />
    </SessionProvider>
  );
}
