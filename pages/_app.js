import Head from "next/head";
import { SessionProvider } from "next-auth/react";
import FluidCursor from "./components/FluidCursor";

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

      {/* Authentic WebGL Fluid Rainbow Cursor with Dissolving Smoke */}
      <FluidCursor />

      {/* Render page */}
      <Component {...rest} />

      {/* Global Luxury Dark Styles & WhizWiser / Linear Design System */}
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

        /* ─── WHIZWISER / LUXURY AI PRIMARY SLIDING BUTTON (TITANIUM WHITE ➔ OBSIDIAN GLOW) ─── */
        .btn-gabbar-gold,
        .btn-gabbar-primary {
          position: relative !important;
          overflow: hidden !important;
          background: #ffffff !important;
          color: #080b11 !important;
          font-family: "Outfit", "Plus Jakarta Sans", sans-serif !important;
          font-weight: 700 !important;
          border: 1px solid rgba(255, 255, 255, 0.95) !important;
          border-radius: 10px !important;
          transition: color 0.35s cubic-bezier(0.16, 1, 0.3, 1), 
                      border-color 0.35s ease, 
                      box-shadow 0.35s ease, 
                      transform 0.25s cubic-bezier(0.16, 1, 0.3, 1) !important;
          z-index: 1 !important;
          cursor: pointer !important;
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
          gap: 8px !important;
          text-decoration: none !important;
          box-shadow: 0 4px 20px rgba(255, 255, 255, 0.15), 0 0 25px rgba(59, 130, 246, 0.12) !important;
        }

        .btn-gabbar-gold::before,
        .btn-gabbar-primary::before {
          content: '' !important;
          position: absolute !important;
          top: 0 !important;
          left: -100% !important;
          width: 100% !important;
          height: 100% !important;
          background: #090d16 !important;
          transition: left 0.35s cubic-bezier(0.16, 1, 0.3, 1) !important;
          z-index: -1 !important;
        }

        .btn-gabbar-gold:hover,
        .btn-gabbar-primary:hover {
          color: #ffffff !important;
          border-color: rgba(255, 255, 255, 0.4) !important;
          box-shadow: 0 0 30px rgba(59, 130, 246, 0.4), 0 0 15px rgba(255, 255, 255, 0.3) !important;
          transform: translateY(-2px) !important;
        }

        .btn-gabbar-gold:hover::before,
        .btn-gabbar-primary:hover::before {
          left: 0 !important;
        }

        /* ─── SECONDARY SLIDING BUTTON (OBSIDIAN ➔ TITANIUM WHITE) ─── */
        .btn-gabbar-dark,
        .btn-gabbar-secondary {
          position: relative !important;
          overflow: hidden !important;
          background: rgba(18, 24, 38, 0.85) !important;
          color: #f1f5f9 !important;
          font-family: "Outfit", "Plus Jakarta Sans", sans-serif !important;
          font-weight: 700 !important;
          border: 1px solid rgba(255, 255, 255, 0.14) !important;
          border-radius: 10px !important;
          backdrop-filter: blur(12px) !important;
          -webkit-backdrop-filter: blur(12px) !important;
          transition: color 0.35s cubic-bezier(0.16, 1, 0.3, 1), 
                      border-color 0.35s ease, 
                      box-shadow 0.35s ease, 
                      transform 0.25s cubic-bezier(0.16, 1, 0.3, 1) !important;
          z-index: 1 !important;
          cursor: pointer !important;
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
          gap: 8px !important;
          text-decoration: none !important;
        }

        .btn-gabbar-dark::before,
        .btn-gabbar-secondary::before {
          content: '' !important;
          position: absolute !important;
          top: 0 !important;
          left: -100% !important;
          width: 100% !important;
          height: 100% !important;
          background: #ffffff !important;
          transition: left 0.35s cubic-bezier(0.16, 1, 0.3, 1) !important;
          z-index: -1 !important;
        }

        .btn-gabbar-dark:hover,
        .btn-gabbar-secondary:hover {
          color: #080b11 !important;
          border-color: #ffffff !important;
          box-shadow: 0 0 25px rgba(255, 255, 255, 0.35) !important;
          transform: translateY(-2px) !important;
        }

        .btn-gabbar-dark:hover::before,
        .btn-gabbar-secondary:hover::before {
          left: 0 !important;
        }

        /* ─── LIVE PULSING ANIMATIONS & KEYFRAMES ─── */
        @keyframes radarPulse {
          0% {
            transform: scale(0.95);
            box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7);
          }
          70% {
            transform: scale(1);
            box-shadow: 0 0 0 8px rgba(16, 185, 129, 0);
          }
          100% {
            transform: scale(0.95);
            box-shadow: 0 0 0 0 rgba(16, 185, 129, 0);
          }
        }

        @keyframes ambientGlowPulse {
          0%, 100% {
            opacity: 0.45;
            transform: scale(1);
          }
          50% {
            opacity: 0.75;
            transform: scale(1.05);
          }
        }

        @keyframes dataFlowPulse {
          0% {
            stroke-dashoffset: 24;
          }
          100% {
            stroke-dashoffset: 0;
          }
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
          background: #3b82f6;
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
