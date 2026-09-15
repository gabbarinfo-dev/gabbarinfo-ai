// pages/contact.js
// GabbarInfo AI — Contact Us
// Hosted at: ai.gabbarinfo.com/contact

import Head from "next/head";
import Link from "next/link";
import { useState } from "react";

export default function Contact() {
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" });
  const [sent, setSent] = useState(false);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = (e) => {
    e.preventDefault();
    const mailto = `mailto:contactus@gabbarinfo.com?subject=${encodeURIComponent(form.subject || "GabbarInfo AI Support")}&body=${encodeURIComponent(`Name: ${form.name}\nEmail: ${form.email}\n\n${form.message}`)}`;
    window.location.href = mailto;
    setSent(true);
  };

  return (
    <>
      <Head>
        <title>Contact Us — GabbarInfo AI</title>
        <meta name="description" content="Contact GabbarInfo AI support. Reach us via email, phone, or WhatsApp for subscription, billing, or technical queries." />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href="https://ai.gabbarinfo.com/contact" />
      </Head>

      <div style={styles.page}>
        {/* NAV */}
        <nav style={styles.nav}>
          <Link href="/" style={styles.logo}><span>⚡</span> GabbarInfo AI</Link>
          <div style={styles.navLinks}>
            <Link href="/privacy-policy" style={styles.navLink}>Privacy Policy</Link>
            <Link href="/terms" style={styles.navLink}>Terms</Link>
            <Link href="/refund-policy" style={styles.navLink}>Refund Policy</Link>
            <Link href="/plans" style={styles.navLinkBtn}>View Plans →</Link>
          </div>
        </nav>

        <main style={styles.main}>
          <div style={styles.container}>

            {/* HEADER */}
            <div style={styles.header}>
              <div style={styles.badge}>Support · Contact Us</div>
              <h1 style={styles.h1}>Contact Us</h1>
              <p style={styles.metaSub}>
                Questions about your subscription, billing, or platform? We&apos;re here to help.
              </p>
            </div>

            <div style={styles.grid}>

              {/* LEFT — CONTACT DETAILS */}
              <div style={styles.leftCol}>

                <div style={styles.infoBlock}>
                  <div style={styles.infoBlockTitle}>🏢 Business Details</div>
                  <div style={styles.infoRow}>
                    <span style={styles.infoLabel}>Operator</span>
                    <span style={styles.infoValue}>Aniket Dobariya</span>
                  </div>
                  <div style={styles.infoRow}>
                    <span style={styles.infoLabel}>Trading As</span>
                    <span style={styles.infoValue}>Gabbarinfo Digital Solutions</span>
                  </div>
                  <div style={styles.infoRow}>
                    <span style={styles.infoLabel}>Type</span>
                    <span style={styles.infoValue}>Individual / Sole Proprietor</span>
                  </div>
                  <div style={styles.infoRow}>
                    <span style={styles.infoLabel}>Platform</span>
                    <a href="https://ai.gabbarinfo.com" style={styles.link}>ai.gabbarinfo.com</a>
                  </div>
                </div>

                <div style={styles.contactCards}>

                  {/* Email */}
                  <a href="mailto:contactus@gabbarinfo.com" style={styles.contactCard}>
                    <div style={styles.contactIcon}>📧</div>
                    <div>
                      <div style={styles.contactCardLabel}>Email</div>
                      <div style={styles.contactCardValue}>contactus@gabbarinfo.com</div>
                      <div style={styles.contactCardSub}>Typical reply within 24 hours</div>
                    </div>
                  </a>

                  {/* WhatsApp */}
                  <a href="https://wa.me/919723927645?text=Hi%20GabbarInfo%20AI%20Support%2C%20I%20need%20help%20with..." target="_blank" rel="noopener noreferrer" style={{ ...styles.contactCard, borderColor: "rgba(37,211,102,0.35)", background: "rgba(37,211,102,0.05)" }}>
                    <div style={styles.contactIcon}>
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="#25D366">
                        <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/>
                      </svg>
                    </div>
                    <div>
                      <div style={styles.contactCardLabel}>WhatsApp</div>
                      <div style={{ ...styles.contactCardValue, color: "#25D366" }}>+91 97239 27645</div>
                      <div style={styles.contactCardSub}>Fastest response channel</div>
                    </div>
                  </a>

                  {/* Phone */}
                  <a href="tel:+919723927645" style={styles.contactCard}>
                    <div style={styles.contactIcon}>📞</div>
                    <div>
                      <div style={styles.contactCardLabel}>Phone</div>
                      <div style={styles.contactCardValue}>+91 97239 27645</div>
                      <div style={styles.contactCardSub}>Mon–Sat, 10 AM – 7 PM IST</div>
                    </div>
                  </a>

                  {/* Address */}
                  <div style={{ ...styles.contactCard, cursor: "default" }}>
                    <div style={styles.contactIcon}>📍</div>
                    <div>
                      <div style={styles.contactCardLabel}>Address</div>
                      <div style={styles.contactCardValue}>New SG Road, Jagatpur</div>
                      <div style={styles.contactCardValue}>Ahmedabad, Gujarat 382470</div>
                      <div style={styles.contactCardValue}>India</div>
                    </div>
                  </div>

                </div>

                {/* Response SLA */}
                <div style={styles.slaBox}>
                  <div style={{ fontWeight: 700, color: "#38bdf8", marginBottom: 10, fontSize: 13 }}>⏱ Response Timelines</div>
                  {[
                    ["Billing / Refund queries", "Within 2 business days"],
                    ["Technical support", "Within 24 hours"],
                    ["Privacy / Data requests", "Within 30 days (GDPR) / DPDP timelines"],
                    ["General enquiries", "Within 48 hours"],
                  ].map(([q, t]) => (
                    <div key={q} style={styles.slaRow}>
                      <span style={{ color: "#94a3b8", fontSize: 13 }}>{q}</span>
                      <span style={{ color: "#34d399", fontSize: 13, fontWeight: 700 }}>{t}</span>
                    </div>
                  ))}
                </div>

              </div>

              {/* RIGHT — CONTACT FORM */}
              <div style={styles.rightCol}>
                <div style={styles.formCard}>
                  <h2 style={styles.formTitle}>Send Us a Message</h2>
                  <p style={styles.formSub}>Fill the form below and we&apos;ll get back to you promptly.</p>

                  {sent ? (
                    <div style={styles.successBox}>
                      <div style={{ fontSize: 36, marginBottom: 12 }}>✅</div>
                      <div style={{ fontWeight: 800, color: "#34d399", fontSize: 18, marginBottom: 8 }}>Message Ready!</div>
                      <p style={{ color: "#94a3b8", fontSize: 14 }}>Your email client has opened with the pre-filled message. Send it to complete your query.</p>
                      <button onClick={() => setSent(false)} style={styles.resetBtn}>Send Another</button>
                    </div>
                  ) : (
                    <form onSubmit={handleSubmit} style={styles.form}>
                      <div style={styles.formRow}>
                        <div style={styles.formGroup}>
                          <label style={styles.label}>Full Name *</label>
                          <input
                            name="name" required
                            value={form.name} onChange={handleChange}
                            placeholder="Your name"
                            style={styles.input}
                          />
                        </div>
                        <div style={styles.formGroup}>
                          <label style={styles.label}>Email Address *</label>
                          <input
                            name="email" type="email" required
                            value={form.email} onChange={handleChange}
                            placeholder="your@email.com"
                            style={styles.input}
                          />
                        </div>
                      </div>

                      <div style={styles.formGroup}>
                        <label style={styles.label}>Subject *</label>
                        <select
                          name="subject" required
                          value={form.subject} onChange={handleChange}
                          style={styles.select}
                        >
                          <option value="">Select a topic</option>
                          <option>Billing & Subscription Query</option>
                          <option>Refund Request</option>
                          <option>Technical Support</option>
                          <option>Account Issue</option>
                          <option>Privacy / Data Deletion Request</option>
                          <option>Feature Request</option>
                          <option>Other</option>
                        </select>
                      </div>

                      <div style={styles.formGroup}>
                        <label style={styles.label}>Message *</label>
                        <textarea
                          name="message" required rows={6}
                          value={form.message} onChange={handleChange}
                          placeholder="Describe your query in detail..."
                          style={styles.textarea}
                        />
                      </div>

                      <button type="submit" style={styles.submitBtn}>
                        Send Message →
                      </button>

                      <p style={{ fontSize: 12, color: "#475569", marginTop: 12, textAlign: "center" }}>
                        Clicking &ldquo;Send Message&rdquo; opens your email client with the pre-filled message.
                      </p>
                    </form>
                  )}
                </div>

                {/* Quick links */}
                <div style={styles.quickLinks}>
                  <div style={{ fontSize: 13, color: "#64748b", marginBottom: 10, fontWeight: 700 }}>Quick Links</div>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    {[
                      { label: "View Plans", href: "/plans" },
                      { label: "Privacy Policy", href: "/privacy-policy" },
                      { label: "Terms & Conditions", href: "/terms" },
                      { label: "Refund Policy", href: "/refund-policy" },
                    ].map(({ label, href }) => (
                      <Link key={href} href={href} style={styles.quickLink}>{label}</Link>
                    ))}
                  </div>
                </div>
              </div>

            </div>
          </div>
        </main>

        <footer style={styles.footer}>
          <p style={styles.footerText}>© {new Date().getFullYear()} Gabbarinfo Digital Solutions · Aniket Dobariya · All rights reserved.</p>
          <div style={styles.footerLinks}>
            <Link href="/privacy-policy" style={styles.footerLink}>Privacy Policy</Link>
            <Link href="/terms" style={styles.footerLink}>Terms &amp; Conditions</Link>
            <Link href="/refund-policy" style={styles.footerLink}>Refund Policy</Link>
            <Link href="/plans" style={styles.footerLink}>Plans &amp; Pricing</Link>
          </div>
        </footer>
      </div>
    </>
  );
}

const styles = {
  page: { background: "#080b11", minHeight: "100vh", color: "#e2e8f0", fontFamily: "'Plus Jakarta Sans', sans-serif" },
  nav: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 32px", borderBottom: "1px solid rgba(255,255,255,0.07)", position: "sticky", top: 0, background: "rgba(8,11,17,0.95)", backdropFilter: "blur(12px)", zIndex: 100, flexWrap: "wrap", gap: 12 },
  logo: { display: "flex", alignItems: "center", gap: 8, fontWeight: 800, fontSize: 18, color: "#f8fafc", textDecoration: "none" },
  navLinks: { display: "flex", alignItems: "center", gap: 20 },
  navLink: { color: "#94a3b8", textDecoration: "none", fontSize: 14, fontWeight: 600 },
  navLinkBtn: { background: "rgba(56,189,248,0.12)", border: "1px solid rgba(56,189,248,0.3)", borderRadius: 8, padding: "7px 16px", color: "#38bdf8", textDecoration: "none", fontSize: 14, fontWeight: 700 },
  main: { padding: "60px 24px 80px" },
  container: { maxWidth: 1100, margin: "0 auto" },
  header: { textAlign: "center", marginBottom: 52, paddingBottom: 40, borderBottom: "1px solid rgba(255,255,255,0.07)" },
  badge: { display: "inline-block", background: "rgba(56,189,248,0.1)", border: "1px solid rgba(56,189,248,0.25)", borderRadius: 100, padding: "5px 16px", fontSize: 11, fontWeight: 800, color: "#38bdf8", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 16 },
  h1: { fontSize: "clamp(2rem, 4vw, 2.8rem)", fontWeight: 800, color: "#ffffff", margin: "0 0 14px", letterSpacing: "-0.02em" },
  metaSub: { fontSize: 15, color: "#94a3b8", margin: 0 },
  grid: { display: "grid", gridTemplateColumns: "1fr 1.4fr", gap: 40, alignItems: "start" },
  leftCol: { display: "flex", flexDirection: "column", gap: 20 },
  rightCol: { display: "flex", flexDirection: "column", gap: 20 },
  infoBlock: { background: "rgba(15,23,42,0.7)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: "20px 24px" },
  infoBlockTitle: { fontWeight: 800, color: "#38bdf8", fontSize: 14, marginBottom: 16 },
  infoRow: { display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 10, marginBottom: 10, borderBottom: "1px solid rgba(255,255,255,0.04)", gap: 12 },
  infoLabel: { fontSize: 12, color: "#64748b", fontWeight: 600, flexShrink: 0 },
  infoValue: { fontSize: 13, color: "#f1f5f9", fontWeight: 600, textAlign: "right" },
  contactCards: { display: "flex", flexDirection: "column", gap: 12 },
  contactCard: { display: "flex", alignItems: "flex-start", gap: 14, background: "rgba(15,23,42,0.7)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: "16px 18px", textDecoration: "none", transition: "border-color 0.2s" },
  contactIcon: { fontSize: 22, flexShrink: 0, marginTop: 2 },
  contactCardLabel: { fontSize: 11, color: "#64748b", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 },
  contactCardValue: { fontSize: 14, color: "#f1f5f9", fontWeight: 700 },
  contactCardSub: { fontSize: 12, color: "#475569", marginTop: 3 },
  slaBox: { background: "linear-gradient(135deg, rgba(56,189,248,0.06), rgba(8,11,17,0.9))", border: "1px solid rgba(56,189,248,0.2)", borderRadius: 12, padding: "18px 20px" },
  slaRow: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, paddingBottom: 10, borderBottom: "1px solid rgba(255,255,255,0.04)", gap: 12, flexWrap: "wrap" },
  formCard: { background: "rgba(15,23,42,0.7)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: "32px 30px" },
  formTitle: { fontSize: "1.3rem", fontWeight: 800, color: "#ffffff", margin: "0 0 6px" },
  formSub: { fontSize: 13, color: "#64748b", margin: "0 0 24px" },
  form: { display: "flex", flexDirection: "column", gap: 18 },
  formRow: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 },
  formGroup: { display: "flex", flexDirection: "column", gap: 7 },
  label: { fontSize: 12, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em" },
  input: { background: "rgba(30,41,59,0.8)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "11px 14px", color: "#f1f5f9", fontSize: 14, outline: "none", fontFamily: "'Plus Jakarta Sans', sans-serif" },
  select: { background: "rgba(30,41,59,0.8)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "11px 14px", color: "#f1f5f9", fontSize: 14, outline: "none", fontFamily: "'Plus Jakarta Sans', sans-serif" },
  textarea: { background: "rgba(30,41,59,0.8)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "11px 14px", color: "#f1f5f9", fontSize: 14, outline: "none", resize: "vertical", fontFamily: "'Plus Jakarta Sans', sans-serif" },
  submitBtn: { background: "linear-gradient(135deg, #0ea5e9, #38bdf8)", border: "none", borderRadius: 10, padding: "13px 28px", color: "#000", fontWeight: 800, fontSize: 15, cursor: "pointer", fontFamily: "'Plus Jakarta Sans', sans-serif", letterSpacing: "0.01em" },
  successBox: { textAlign: "center", padding: "32px 16px" },
  resetBtn: { marginTop: 16, background: "rgba(56,189,248,0.1)", border: "1px solid rgba(56,189,248,0.3)", borderRadius: 8, padding: "10px 24px", color: "#38bdf8", fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "'Plus Jakarta Sans', sans-serif" },
  quickLinks: { background: "rgba(15,23,42,0.5)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: "16px 18px" },
  quickLink: { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 6, padding: "6px 14px", color: "#94a3b8", fontSize: 13, textDecoration: "none", fontWeight: 600 },
  link: { color: "#38bdf8", textDecoration: "underline", textUnderlineOffset: 3, fontSize: 13 },
  footer: { borderTop: "1px solid rgba(255,255,255,0.07)", padding: "24px 32px", textAlign: "center" },
  footerText: { fontSize: 13, color: "#475569", marginBottom: 10 },
  footerLinks: { display: "flex", justifyContent: "center", gap: 24, flexWrap: "wrap" },
  footerLink: { fontSize: 13, color: "#64748b", textDecoration: "none" },
};
