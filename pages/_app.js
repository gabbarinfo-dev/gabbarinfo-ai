import Head from "next/head";
import { SessionProvider } from "next-auth/react";
import CursorAura from "./components/CursorAura";

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

      {/* Global Interactive Rainbow Aurora Cursor */}
      <CursorAura />

      {/* Render page */}
      <Component {...rest} />

      {/* Global Luxury Dark Styles & Signature GabbarInfo Button Systems */}
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

        /* ─── SIGNATURE GABBARINFO SLIDING BUTTON (YELLOW ➔ BLACK) ─── */
        /* Exact signature animation from www.gabbarinfo.com */
        .btn-gabbar-gold {
          position: relative !important;
          overflow: hidden !important;
          background: #F5B716 !important;
          color: #000000 !important;
          font-family: "Outfit", "Plus Jakarta Sans", sans-serif !important;
          font-weight: 700 !important;
          border: 1.5px solid #F5B716 !important;
          border-radius: 8px !important;
          transition: color 0.35s cubic-bezier(0.4, 0, 0.2, 1), 
                      border-color 0.35s ease, 
                      box-shadow 0.35s ease, 
                      transform 0.2s ease !important;
          z-index: 1 !important;
          cursor: pointer !important;
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
          gap: 8px !important;
          text-decoration: none !important;
        }

        .btn-gabbar-gold::before {
          content: '' !important;
          position: absolute !important;
          top: 0 !important;
          left: -100% !important;
          width: 100% !important;
          height: 100% !important;
          background: #080b11 !important;
          transition: left 0.35s cubic-bezier(0.4, 0, 0.2, 1) !important;
          z-index: -1 !important;
        }

        .btn-gabbar-gold:hover {
          color: #F5B716 !important;
          border-color: #F5B716 !important;
          box-shadow: 0 0 24px rgba(245, 183, 22, 0.5) !important;
          transform: translateY(-2px) !important;
        }

        .btn-gabbar-gold:hover::before {
          left: 0 !important;
        }

        /* ─── SECONDARY GABBARINFO SLIDING BUTTON (DARK ➔ GOLD) ─── */
        .btn-gabbar-dark {
          position: relative !important;
          overflow: hidden !important;
          background: rgba(15, 23, 42, 0.8) !important;
          color: #f8fafc !important;
          font-family: "Outfit", "Plus Jakarta Sans", sans-serif !important;
          font-weight: 700 !important;
          border: 1.5px solid rgba(245, 183, 22, 0.35) !important;
          border-radius: 8px !important;
          transition: color 0.35s cubic-bezier(0.4, 0, 0.2, 1), 
                      border-color 0.35s ease, 
                      box-shadow 0.35s ease, 
                      transform 0.2s ease !important;
          z-index: 1 !important;
          cursor: pointer !important;
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
          gap: 8px !important;
          text-decoration: none !important;
        }

        .btn-gabbar-dark::before {
          content: '' !important;
          position: absolute !important;
          top: 0 !important;
          left: -100% !important;
          width: 100% !important;
          height: 100% !important;
          background: #F5B716 !important;
          transition: left 0.35s cubic-bezier(0.4, 0, 0.2, 1) !important;
          z-index: -1 !important;
        }

        .btn-gabbar-dark:hover {
          color: #000000 !important;
          border-color: #F5B716 !important;
          box-shadow: 0 0 24px rgba(245, 183, 22, 0.4) !important;
          transform: translateY(-2px) !important;
        }

        .btn-gabbar-dark:hover::before {
          left: 0 !important;
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
          background: #F5B716;
        }

        /* Selection Highlights */
        ::selection {
          background: rgba(245, 183, 22, 0.35);
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
