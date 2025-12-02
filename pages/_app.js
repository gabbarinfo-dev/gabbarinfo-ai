// pages/_app.js
import Head from "next/head";
import { SessionProvider } from "next-auth/react";

export default function MyApp({ Component, pageProps }) {
  const { session, ...rest } = pageProps || {};

  return (
    <SessionProvider session={session}>
      <Head>
        <title>GabbarInfo AI</title>
        {/* Critical for mobile layout + preventing weird zoom */}
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1"
        />
      </Head>

      {/* Render page */}
      <Component {...rest} />

      {/* Global styles – no separate CSS file needed */}
      <style jsx global>{`
        html,
        body,
        #__next {
          height: 100%;
          margin: 0;
          padding: 0;
        }

        body {
          font-family: -apple-system, BlinkMacSystemFont, "Inter", system-ui,
            sans-serif;
          background: #fafafa;
        }

        /* Stop iOS from zooming when focusing inputs */
        input,
        textarea,
        select {
          font-size: 16px !important;
        }

        button {
          cursor: pointer;
        }
      `}</style>
    </SessionProvider>
  );
}
