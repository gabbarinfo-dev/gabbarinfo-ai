// pages/_app.js
import Head from "next/head";
import { SessionProvider } from "next-auth/react";

export default function MyApp({ Component, pageProps }) {
  const { session, ...rest } = pageProps || {};

  return (
    <SessionProvider session={session}>
      <Head>
        <title>GabbarInfo AI · Autonomous Digital Marketing Strategist</title>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1"
        />
        <meta name="theme-color" content="#080b11" />
        {/* Google Fonts: Plus Jakarta Sans & Outfit */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Outfit:wght@500;600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </Head>

      {/* Render page */}
      <Component {...rest} />

      {/* Global Luxury Dark Styles & Typography */}
      <style jsx global>{`
        *, *::before, *::after {
          box-sizing: border-box;
        }

        html,
        body,
        #__next {
          min-height: 100%;
          margin: 0;
          padding: 0;
          background: #080b11;
          color: #f8fafc;
        }

        body {
          font-family: "Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          background: #080b11;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
          overflow-x: hidden;
        }

        h1, h2, h3, h4, h5, h6 {
          font-family: "Outfit", "Plus Jakarta Sans", sans-serif;
          letter-spacing: -0.02em;
        }

        /* Smooth Custom Dark Scrollbar */
        ::-webkit-scrollbar {
          width: 7px;
          height: 7px;
        }
        ::-webkit-scrollbar-track {
          background: #080b11;
        }
        ::-webkit-scrollbar-thumb {
          background: #1e293b;
          border-radius: 999px;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: #334155;
        }

        /* Selection Highlights */
        ::selection {
          background: rgba(59, 130, 246, 0.4);
          color: #ffffff;
        }

        /* Stop iOS from zooming when focusing inputs */
        input,
        textarea,
        select {
          font-family: inherit;
        }

        button {
          font-family: inherit;
          cursor: pointer;
        }

        /* Utility animations */
        @keyframes pulseGlow {
          0%, 100% {
            opacity: 0.6;
            transform: scale(1);
          }
          50% {
            opacity: 1;
            transform: scale(1.05);
          }
        }
      `}</style>
    </SessionProvider>
  );
}
