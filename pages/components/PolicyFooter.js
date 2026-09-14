// pages/components/PolicyFooter.js
/**
 * PolicyFooter
 * 
 * Minimal dark footer shown on all pages of ai.gabbarinfo.com.
 * Links to the authoritative policy pages on gabbarinfo.com.
 * Required for Razorpay merchant verification & DPDP Act compliance.
 */

export default function PolicyFooter() {
  return (
    <>
      <footer style={{
        width: "100%",
        background: "rgba(8,11,17,0.97)",
        borderTop: "1px solid rgba(255,255,255,0.07)",
        padding: "14px 24px",
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "10px",
        zIndex: 50,
        position: "relative",
      }}>
        {/* Brand */}
        <span style={{
          fontFamily: "'Outfit', sans-serif",
          fontSize: "12px",
          color: "rgba(255,255,255,0.38)",
          letterSpacing: "0.02em",
        }}>
          © {new Date().getFullYear()} GabbarInfo Digital Solutions · AI Platform
        </span>

        {/* Policy Links */}
        <nav style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "18px",
          alignItems: "center",
        }}>
          {[
            { label: "Terms & Conditions", href: "https://www.gabbarinfo.com/terms-and-conditions/" },
            { label: "Privacy Policy", href: "https://www.gabbarinfo.com/privacy-policy/" },
            { label: "Refund & Cancellation", href: "https://www.gabbarinfo.com/cancellation-refund-policy/" },
            { label: "Contact Us", href: "https://www.gabbarinfo.com/contact-us/" },
          ].map((link) => (
            <a
              key={link.href}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                fontSize: "11.5px",
                color: "rgba(255,255,255,0.42)",
                textDecoration: "none",
                letterSpacing: "0.01em",
                transition: "color 0.2s ease",
              }}
              onMouseEnter={e => e.currentTarget.style.color = "rgba(255,255,255,0.9)"}
              onMouseLeave={e => e.currentTarget.style.color = "rgba(255,255,255,0.42)"}
            >
              {link.label}
            </a>
          ))}

          {/* Razorpay secure badge */}
          <span style={{
            display: "flex",
            alignItems: "center",
            gap: "5px",
            fontSize: "11px",
            color: "rgba(255,255,255,0.28)",
            fontFamily: "'Plus Jakarta Sans', sans-serif",
          }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" style={{ opacity: 0.5 }}>
              <path d="M12 2L4 5v6c0 5.5 3.5 10.7 8 12 4.5-1.3 8-6.5 8-12V5l-8-3z" fill="rgba(59,130,246,0.7)" />
              <path d="M9 12l2 2 4-4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Secured by Razorpay
          </span>
        </nav>
      </footer>
    </>
  );
}
