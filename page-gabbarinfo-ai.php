<?php
/**
 * Template Name: GabbarInfo AI Landing Page
 * Description: Dedicated showcase page for GabbarInfo AI Autonomous Digital Marketing Operating System.
 * 
 * NOTE: This is a standalone WordPress template designed for the GabbarInfo theme.
 * All styling and interactive canvas scripts are completely self-contained.
 */

get_header();
?>

<!-- ── GABBARINFO AI LANDING PAGE STYLES (NAMESPACED) ── -->
<style>
/* Reset & Scope Isolation */
.gabbar-ai-landing {
  background-color: #080b11;
  color: #f8fafc;
  font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  line-height: 1.6;
  overflow-x: hidden;
  position: relative;
  margin: 0;
  padding: 0;
  -webkit-font-smoothing: antialiased;
}

.gabbar-ai-landing * {
  box-sizing: border-box;
}

.gabbar-ai-container {
  max-width: 1240px;
  margin: 0 auto;
  padding: 0 24px;
  position: relative;
  z-index: 2;
}

/* ── HERO SECTION & CANVAS (AIRY, SUBTLE CYBERNETIC MATRIX) ── */
.gabbar-ai-hero {
  position: relative;
  min-height: 94vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 135px 20px 85px;
  text-align: center;
  overflow: hidden;
  /* Ambient Light Beam Glow from Sign-In Page */
  background: radial-gradient(ellipse 70% 60% at 50% 0%, rgba(59, 130, 246, 0.16) 0%, rgba(16, 185, 129, 0.05) 45%, #080b11 80%);
}

#gabbarAiCanvas {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 1;
  pointer-events: none;
  opacity: 0.72;
}

.gabbar-ai-hero-content {
  position: relative;
  z-index: 3;
  max-width: 960px;
  margin: 0 auto;
}

.hero-pill-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 18px;
  border-radius: 999px;
  background: rgba(16, 185, 129, 0.12);
  border: 1px solid rgba(16, 185, 129, 0.35);
  color: #34d399;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  margin-bottom: 24px;
  box-shadow: 0 0 20px rgba(16, 185, 129, 0.2);
}

.radar-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #10b981;
  box-shadow: 0 0 10px #10b981;
  animation: radarPulse 2s infinite ease-in-out;
}

@keyframes radarPulse {
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.4); opacity: 0.5; }
}

.gabbar-ai-hero h1 {
  font-size: clamp(34px, 5.2vw, 58px);
  font-weight: 900;
  line-height: 1.16;
  letter-spacing: -0.03em;
  color: #ffffff;
  margin: 0 0 22px 0;
}

.gabbar-ai-hero h1 span.gradient-text {
  background: linear-gradient(135deg, #ffffff 0%, #38bdf8 45%, #34d399 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.gabbar-ai-hero p.hero-sub {
  font-size: clamp(15px, 1.7vw, 17.5px);
  color: #e2e8f0;
  max-width: 860px;
  margin: 0 auto 40px;
  line-height: 1.72;
  background: linear-gradient(180deg, rgba(16, 22, 34, 0.72) 0%, rgba(8, 11, 17, 0.84) 100%);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 20px;
  padding: 24px 34px;
  box-shadow: 0 25px 70px rgba(0, 0, 0, 0.85), 0 0 45px rgba(59, 130, 246, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.18);
  position: relative;
  z-index: 2;
  text-align: center;
}

.hero-cta-group {
  display: flex;
  gap: 16px;
  justify-content: center;
  align-items: center;
  flex-wrap: wrap;
  margin-bottom: 44px;
}

.btn-primary-ai {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 16px 36px;
  border-radius: 12px;
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: #042416;
  font-size: 16px;
  font-weight: 800;
  text-decoration: none;
  box-shadow: 0 0 35px rgba(16, 185, 129, 0.45), 0 4px 15px rgba(0,0,0,0.5);
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.btn-primary-ai:hover {
  transform: translateY(-2px);
  box-shadow: 0 0 50px rgba(16, 185, 129, 0.65), 0 8px 25px rgba(0,0,0,0.6);
  color: #042416;
}

.btn-secondary-ai {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 16px 32px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.05);
  color: #f1f5f9;
  font-size: 16px;
  font-weight: 700;
  text-decoration: none;
  border: 1px solid rgba(255, 255, 255, 0.15);
  backdrop-filter: blur(10px);
  transition: all 0.2s ease;
}

.btn-secondary-ai:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.3);
  color: #ffffff;
}

/* 4 Core Pillars Hero Bar */
.hero-pillars-bar {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
  gap: 14px;
  max-width: 960px;
  margin: 0 auto;
  text-align: left;
}

.hero-pillar-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 18px;
  border-radius: 14px;
  background: rgba(16, 22, 34, 0.68);
  border: 1px solid rgba(255, 255, 255, 0.09);
  backdrop-filter: blur(14px);
  font-size: 13px;
  font-weight: 700;
  color: #e2e8f0;
  transition: all 0.2s ease;
}

.hero-pillar-item:hover {
  background: rgba(16, 22, 34, 0.85);
  border-color: rgba(56, 189, 248, 0.3);
  transform: translateY(-1px);
}

.hero-pillar-item span.pillar-icon {
  font-size: 18px;
  flex-shrink: 0;
}

/* ── SECTION COMMON ── */
.ai-section {
  padding: 100px 0;
  position: relative;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.section-header {
  text-align: center;
  max-width: 820px;
  margin: 0 auto 60px;
}

.section-badge {
  display: inline-block;
  font-size: 11px;
  font-weight: 800;
  color: #38bdf8;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  margin-bottom: 12px;
  padding: 4px 12px;
  border-radius: 6px;
  background: rgba(56, 189, 248, 0.1);
  border: 1px solid rgba(56, 189, 248, 0.25);
}

.section-header h2 {
  font-size: clamp(28px, 3.8vw, 44px);
  font-weight: 800;
  color: #ffffff;
  letter-spacing: -0.02em;
  margin: 0 0 16px 0;
  line-height: 1.25;
}

.section-header p {
  font-size: 16px;
  color: #94a3b8;
  margin: 0;
  line-height: 1.6;
}

/* ── COMPARISON SECTION (PROBLEM VS ADVANTAGE) ── */
.comparison-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 28px;
}

.comparison-card {
  border-radius: 18px;
  padding: 36px 32px;
  position: relative;
}

.card-problem {
  background: rgba(239, 68, 68, 0.03);
  border: 1px solid rgba(239, 68, 68, 0.18);
}

.card-solution {
  background: rgba(16, 185, 129, 0.04);
  border: 1.5px solid rgba(16, 185, 129, 0.35);
  box-shadow: 0 0 40px rgba(16, 185, 129, 0.08);
}

.comparison-card h3 {
  font-size: 20px;
  font-weight: 800;
  margin: 0 0 24px 0;
  display: flex;
  align-items: center;
  gap: 10px;
}

.card-problem h3 { color: #f87171; }
.card-solution h3 { color: #34d399; }

.comparison-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.comparison-list li {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  font-size: 14px;
  color: #cbd5e1;
  line-height: 1.55;
}

.comparison-list li strong {
  color: #ffffff;
  display: block;
  font-size: 15px;
  margin-bottom: 3px;
}

/* ── 4 AUTONOMOUS SUITES (PILLARS) GRID ── */
.pillars-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 28px;
}

.pillar-card {
  background: rgba(16, 22, 34, 0.75);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 20px;
  padding: 38px 34px;
  position: relative;
  overflow: hidden;
  transition: all 0.3s ease;
  backdrop-filter: blur(14px);
}

.pillar-card:hover {
  transform: translateY(-4px);
  border-color: rgba(56, 189, 248, 0.4);
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5), 0 0 30px rgba(56, 189, 248, 0.12);
}

.pillar-badge {
  display: inline-block;
  font-size: 11px;
  font-weight: 800;
  padding: 3px 10px;
  border-radius: 6px;
  margin-bottom: 16px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.badge-orange { background: rgba(249, 115, 22, 0.15); color: #fb923c; border: 1px solid rgba(249, 115, 22, 0.3); }
.badge-blue { background: rgba(56, 189, 248, 0.15); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.3); }
.badge-purple { background: rgba(168, 85, 247, 0.15); color: #c084fc; border: 1px solid rgba(168, 85, 247, 0.3); }
.badge-green { background: rgba(16, 185, 129, 0.15); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.3); }

.pillar-card h3 {
  font-size: 22px;
  font-weight: 800;
  color: #ffffff;
  margin: 0 0 14px 0;
  line-height: 1.3;
}

.pillar-card p.pillar-desc {
  color: #94a3b8;
  font-size: 15px;
  margin: 0 0 22px 0;
  line-height: 1.6;
}

.pillar-feature-points {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 11px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  padding-top: 18px;
}

.pillar-feature-points li {
  font-size: 13.5px;
  color: #cbd5e1;
  display: flex;
  align-items: center;
  gap: 9px;
}

.pillar-feature-points li::before {
  content: "✦";
  color: #38bdf8;
  font-size: 11px;
}

/* ── TALK TO US WHATSAPP BUTTON (SLIDER COLOR EFFECT) ── */
.pillar-cta-wrap {
  margin-top: 50px;
  text-align: center;
  display: flex;
  justify-content: center;
  align-items: center;
  position: relative;
  z-index: 5;
}

.btn-whatsapp-slider {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 16px 42px;
  border-radius: 50px;
  font-size: 17px;
  font-weight: 800;
  color: #ffffff;
  text-decoration: none;
  background: rgba(16, 24, 39, 0.85);
  border: 1.5px solid rgba(37, 211, 102, 0.55);
  overflow: hidden;
  cursor: pointer;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5), 0 0 25px rgba(37, 211, 102, 0.15);
  transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
  backdrop-filter: blur(10px);
}

/* The Sliding Color Layer */
.btn-whatsapp-slider::before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, #25D366 0%, #128C7E 100%);
  transform: translateX(-101%);
  transition: transform 0.45s cubic-bezier(0.25, 1, 0.5, 1);
  z-index: 1;
  border-radius: 50px;
}

/* Hover States with Color Slider Sweep */
.btn-whatsapp-slider:hover {
  transform: translateY(-3px) scale(1.02);
  border-color: #25D366;
  color: #042416;
  box-shadow: 0 16px 45px rgba(37, 211, 102, 0.45), 0 0 35px rgba(37, 211, 102, 0.3);
}

.btn-whatsapp-slider:hover::before {
  transform: translateX(0);
}

.btn-whatsapp-slider svg {
  width: 22px;
  height: 22px;
  fill: #25D366;
  transition: all 0.35s ease;
  position: relative;
  z-index: 2;
  flex-shrink: 0;
}

.btn-whatsapp-slider:hover svg {
  fill: #042416;
  transform: rotate(8deg) scale(1.1);
}

.btn-whatsapp-slider span {
  position: relative;
  z-index: 2;
  transition: color 0.35s ease;
}

.btn-whatsapp-slider .btn-arrow {
  font-size: 18px;
  font-weight: 700;
  transition: transform 0.3s ease;
}

.btn-whatsapp-slider:hover .btn-arrow {
  transform: translate(3px, -3px);
}

/* ── 3-STEP WORKFLOW ── */
.steps-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 24px;
}

.step-card {
  background: rgba(16, 22, 34, 0.7);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 16px;
  padding: 34px 28px;
  position: relative;
}

.step-number {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  background: rgba(16, 185, 129, 0.15);
  border: 1.5px solid #10b981;
  color: #34d399;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  font-weight: 900;
  margin-bottom: 20px;
}

.step-card h3 {
  font-size: 18px;
  font-weight: 800;
  color: #ffffff;
  margin: 0 0 10px 0;
}

.step-card p {
  font-size: 14px;
  color: #94a3b8;
  margin: 0;
  line-height: 1.6;
}

/* ── FAQ ACCORDION ── */
.faq-container {
  max-width: 840px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.faq-item {
  background: rgba(16, 22, 34, 0.7);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 14px;
  overflow: hidden;
  transition: all 0.2s ease;
}

.faq-item.active {
  border-color: rgba(56, 189, 248, 0.4);
  background: rgba(16, 22, 34, 0.9);
}

.faq-question {
  padding: 22px 26px;
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 16px;
  font-weight: 700;
  color: #ffffff;
  user-select: none;
}

.faq-chevron {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.06);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: #38bdf8;
  transition: transform 0.3s ease;
}

.faq-item.active .faq-chevron {
  transform: rotate(180deg);
}

.faq-answer {
  max-height: 0;
  overflow: hidden;
  transition: max-height 0.3s cubic-bezier(0, 1, 0, 1);
  padding: 0 26px;
  color: #94a3b8;
  font-size: 14px;
  line-height: 1.65;
}

.faq-item.active .faq-answer {
  max-height: 400px;
  padding-bottom: 22px;
  transition: max-height 0.4s ease-in-out;
}

/* ── BOTTOM CTA BANNER ── */
.ai-cta-banner {
  margin: 60px 0 100px;
  border-radius: 24px;
  padding: 70px 40px;
  text-align: center;
  position: relative;
  overflow: hidden;
  background: linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(14, 165, 161, 0.1) 50%, rgba(8, 11, 17, 0.9) 100%);
  border: 1.5px solid rgba(16, 185, 129, 0.35);
  box-shadow: 0 0 60px rgba(16, 185, 129, 0.15);
}

.ai-cta-banner h2 {
  font-size: clamp(28px, 4vw, 46px);
  font-weight: 900;
  color: #ffffff;
  margin: 0 0 16px 0;
  letter-spacing: -0.02em;
}

.ai-cta-banner p {
  font-size: 17px;
  color: #94a3b8;
  max-width: 680px;
  margin: 0 auto 36px;
  line-height: 1.6;
}

/* ── RESPONSIVE DESIGN ── */
@media (max-width: 900px) {
  .comparison-grid, .pillars-grid, .steps-grid, .hero-pillars-bar {
    grid-template-columns: 1fr;
  }
  .gabbar-ai-hero {
    padding: 110px 16px 60px;
  }
  .gabbar-ai-hero p.hero-sub {
    padding: 18px 20px;
    font-size: 14.5px;
    border-radius: 16px;
  }
}
</style>

<!-- ── GABBARINFO AI LANDING PAGE STRUCTURE ── -->
<div class="gabbar-ai-landing">

  <!-- ── 1. HERO SECTION WITH AIRY CYBER MATRIX CANVAS ── -->
  <section class="gabbar-ai-hero">
    <!-- Live Interactive HTML5 Canvas (Exact light, airy, subtle sign-in animation) -->
    <canvas id="gabbarAiCanvas"></canvas>

    <div class="gabbar-ai-hero-content">
      <div class="hero-pill-badge">
        <span class="radar-dot"></span>
        <span>ALL-IN-ONE AUTONOMOUS MARKETING OPERATING SYSTEM</span>
      </div>

      <h1>
        Self-Driving Digital Marketing Strategist.<br>
        <span class="gradient-text">Google Ads, Meta Ads, Social Media & SEO</span> on Autopilot
      </h1>

      <p class="hero-sub">
        Replace bloated agencies and fragmented software. GabbarInfo AI runs high-converting Google Search & PMax campaigns, launches Meta ads, designs and publishes daily social media posts, and authors comprehensive dual-visual WordPress SEO articles — completely hands-free 24/7.
      </p>

      <div class="hero-cta-group">
        <a href="https://ai.gabbarinfo.com" target="_blank" rel="noopener" class="btn-primary-ai">
          <span>🚀 Launch GabbarInfo AI Command Center</span>
          <span>↗</span>
        </a>
        <a href="#how-it-works" class="btn-secondary-ai">
          <span>Explore All 4 Engines</span>
          <span>↓</span>
        </a>
      </div>

      <!-- 4 Core Pillars Hero Bar -->
      <div class="hero-pillars-bar">
        <div class="hero-pillar-item">
          <span class="pillar-icon">🎯</span>
          <span>Autonomous Google Ads & PMax</span>
        </div>
        <div class="hero-pillar-item">
          <span class="pillar-icon">📘</span>
          <span>Meta Ads & Creative Copy Studio</span>
        </div>
        <div class="hero-pillar-item">
          <span class="pillar-icon">📱</span>
          <span>Social Media Posts & Graphics</span>
        </div>
        <div class="hero-pillar-item">
          <span class="pillar-icon">🌐</span>
          <span>WordPress SEO & Dual-Visual Articles</span>
        </div>
      </div>
    </div>
  </section>

  <!-- ── 2. THE PROBLEM VS. GABBARINFO AI ── -->
  <section class="ai-section" id="comparison">
    <div class="gabbar-ai-container">
      <div class="section-header">
        <div class="section-badge">THE DIGITAL MARKETING PARADOX</div>
        <h2>Why Fragmented Tools & Expensive Agency Retainers Drain Your Budget</h2>
        <p>Hiring separate media buyers, copywriters, graphic designers, and SEO consultants burns thousands of dollars every month with disjointed results. Here is how an all-in-one autonomous system unifies your entire growth pipeline.</p>
      </div>

      <div class="comparison-grid">
        <!-- Problem Card -->
        <div class="comparison-card card-problem">
          <h3>❌ The Fragmented Agency & Tool Maze</h3>
          <ul class="comparison-list">
            <li>
              <span>⚠️</span>
              <div>
                <strong>Overpriced Agency Retainers ($3,000–$6,000/mo)</strong>
                You pay separate agencies for Google Ads management, Meta paid media, social graphics, and SEO content writing.
              </div>
            </li>
            <li>
              <span>⚠️</span>
              <div>
                <strong>Exhausting 5-Tool Workflow Chaos</strong>
                Switching between Google Ads Manager, Meta Business Suite, Canva, ChatGPT, and WordPress eats up hours of manual work every single day.
              </div>
            </li>
            <li>
              <span>⚠️</span>
              <div>
                <strong>Generic AI Prompts With No Execution</strong>
                Raw chatbots generate surface-level text or raw ad copy, but cannot connect to your ad accounts, generate visual assets, or publish live to your site.
              </div>
            </li>
            <li>
              <span>⚠️</span>
              <div>
                <strong>Inconsistent Ads & Posting Cadence</strong>
                Ad campaigns fatigue, keywords go unmonitored, and social feeds go dormant because manual execution is too slow to maintain.
              </div>
            </li>
          </ul>
        </div>

        <!-- Solution Card -->
        <div class="comparison-card card-solution">
          <h3>⚡ The GabbarInfo AI Autonomous Engine</h3>
          <ul class="comparison-list">
            <li>
              <span>✓</span>
              <div>
                <strong>Autonomous Google Ads Search & PMax</strong>
                Builds high-QS keyword clusters, writes responsive headlines/descriptions, sets negative keyword shields, and pushes campaigns directly to Google.
              </div>
            </li>
            <li>
              <span>✓</span>
              <div>
                <strong>Meta Ads & Automated Creative Studio</strong>
                Engineers audience targeting angles, persuasive ad copy, and high-CTR creatives for Facebook & Instagram sponsored campaigns.
              </div>
            </li>
            <li>
              <span>✓</span>
              <div>
                <strong>Social Media Post Generation & Auto-Publishing</strong>
                Automatically designs stunning visual image cards, crafts engaging captions and ranking hashtags, and publishes directly to social feeds.
              </div>
            </li>
            <li>
              <span>✓</span>
              <div>
                <strong>WordPress SEO & Dual-Visual Pillar Articles</strong>
                Researches high-intent keywords, authors 1,500+ word anti-duplicated posts, generates featured + infographic visuals, and publishes live.
              </div>
            </li>
          </ul>
        </div>
      </div>
    </div>
  </section>

  <!-- ── 3. THE 4 AUTONOMOUS CORE ENGINES ── -->
  <section class="ai-section" id="suites">
    <div class="gabbar-ai-container">
      <div class="section-header">
        <div class="section-badge">FULL-STACK MARKETING AUTOMATION</div>
        <h2>Four Powerful Engines Orchestrating Your Growth</h2>
        <p>From high-intent paid traffic to long-term organic search dominance and daily social media branding — completely managed by AI.</p>
      </div>

      <div class="pillars-grid">
        <!-- Engine 1: Google Ads -->
        <div class="pillar-card">
          <span class="pillar-badge badge-orange">PAID SEARCH ENGINE</span>
          <h3>Autonomous Google Ads & Search Architect</h3>
          <p class="pillar-desc">
            Instantly build and deploy structured Google Search & Performance Max campaigns with tightly themed keyword clusters, negative keyword shields, and high Quality Score ad copy.
          </p>
          <ul class="pillar-feature-points">
            <li>High-intent commercial search query discovery & clustering</li>
            <li>Real-time headline & description generation tailored for high CTR</li>
            <li>1-click direct campaign deployment to your Google Ads account</li>
            <li>Automated negative keyword shielding to protect ad spend</li>
          </ul>
        </div>

        <!-- Engine 2: Meta Ads -->
        <div class="pillar-card">
          <span class="pillar-badge badge-purple">PAID SOCIAL ADS</span>
          <h3>Meta Ads Studio & Conversion Copywriter</h3>
          <p class="pillar-desc">
            Launch high-converting Facebook and Instagram ad campaigns with data-backed audience targeting, persuasive benefit-driven ad copy, and compelling creative angles.
          </p>
          <ul class="pillar-feature-points">
            <li>Target audience persona segmentation & psychological hooks</li>
            <li>Multi-format conversion copy (Storytelling, Problem-Solution, Direct Offer)</li>
            <li>Automated visual ad creative asset generation</li>
            <li>Direct synchronization with Meta Business Manager</li>
          </ul>
        </div>

        <!-- Engine 3: Social Media Post Publishing -->
        <div class="pillar-card">
          <span class="pillar-badge badge-blue">SOCIAL MEDIA MANAGEMENT</span>
          <h3>Social Media Post Creation & Auto-Syndication</h3>
          <p class="pillar-desc">
            Never let your brand profiles go quiet. Automatically design scroll-stopping visual image posts with AI-crafted captions, trending hashtags, and instant multi-channel dispatch.
          </p>
          <ul class="pillar-feature-points">
            <li>Auto-shares interactive link preview cards to your Facebook Business Page</li>
            <li>Publishes visual image cards with tailored captions & hashtags to Instagram</li>
            <li>Syndicates newly published blog articles instantly across your social channels</li>
            <li>Builds continuous audience engagement and social trust signals</li>
          </ul>
        </div>

        <!-- Engine 4: WordPress SEO Content -->
        <div class="pillar-card">
          <span class="pillar-badge badge-green">ORGANIC SEARCH DOMINANCE</span>
          <h3>Autonomous WordPress SEO & Editorial Engine</h3>
          <p class="pillar-desc">
            Dominate organic Google rankings with comprehensive, anti-duplicated 1,500+ word articles, dual visual generation, and automated live publishing directly to your domain.
          </p>
          <ul class="pillar-feature-points">
            <li>Universal keyword research for local cities or worldwide markets</li>
            <li>Dual-visual graphic synthesis: Branded 16:9 featured cover + body infographic</li>
            <li>Automated internal/external linking and semantic entity clustering</li>
            <li>Structured JSON-LD Article, FAQPage, and Breadcrumb schema markup</li>
          </ul>
        </div>
      </div>

      <!-- ── TALK TO US WHATSAPP SLIDER BUTTON ── -->
      <div class="pillar-cta-wrap">
        <a href="https://wa.me/919723927645?text=Hi%20GabbarInfo%20AI%20Team%2C%20I%20want%20to%20know%20more%20about%20GabbarInfo%20AI" target="_blank" rel="noopener noreferrer" class="btn-whatsapp-slider">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
            <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/>
          </svg>
          <span>Talk To Us</span>
          <span class="btn-arrow">↗</span>
        </a>
      </div>
    </div>
  </section>

  <!-- ── 4. HOW IT WORKS ── -->
  <section class="ai-section" id="how-it-works">
    <div class="gabbar-ai-container">
      <div class="section-header">
        <div class="section-badge">60-SECOND ONBOARDING</div>
        <h2>How GabbarInfo AI Runs Your Marketing 24/7</h2>
        <p>Three simple steps to transition from manual marketing chaos to automated, consistent business growth.</p>
      </div>

      <div class="steps-grid">
        <div class="step-card">
          <div class="step-number">1</div>
          <h3>Connect Your Channels</h3>
          <p>Pair your WordPress site via our secure API handshake in 60 seconds. Connect your Google Ads account, Facebook Page, or Instagram profile with 1-click authorization.</p>
        </div>

        <div class="step-card">
          <div class="step-number">2</div>
          <h3>Set Your Growth Cadence</h3>
          <p>Choose your autonomous publishing routine: Daily High-Growth, Weekly Sprint, or a Custom schedule. Set your target market (local city, national, or global) and ad goals.</p>
        </div>

        <div class="step-card">
          <div class="step-number">3</div>
          <h3>Scale on Pure Autopilot</h3>
          <p>GabbarInfo AI automatically deploys search ad campaigns, publishes branded social media posts, writes ranked SEO articles, and monitors performance around the clock.</p>
        </div>
      </div>
    </div>
  </section>

  <!-- ── 5. FREQUENTLY ASKED QUESTIONS ── -->
  <section class="ai-section" id="faq">
    <div class="gabbar-ai-container">
      <div class="section-header">
        <div class="section-badge">EVERYTHING YOU NEED TO KNOW</div>
        <h2>Frequently Asked Questions</h2>
        <p>Clear answers on how GabbarInfo AI orchestrates your entire digital marketing stack.</p>
      </div>

      <div class="faq-container">
        <div class="faq-item active">
          <div class="faq-question">
            <span>Can GabbarInfo AI handle Google Ads and Meta Ads as well as SEO?</span>
            <span class="faq-chevron">▼</span>
          </div>
          <div class="faq-answer">
            Yes! GabbarInfo AI is a complete full-stack marketing operating system. It conducts keyword clustering and writes high-converting ad copy for Google Search & PMax campaigns, creates persuasive ad copy and visuals for Meta (Facebook & Instagram) ads, generates daily social media posts, and writes in-depth WordPress SEO articles.
          </div>
        </div>

        <div class="faq-item">
          <div class="faq-question">
            <span>How does social media management and Instagram/Facebook posting work?</span>
            <span class="faq-chevron">▼</span>
          </div>
          <div class="faq-answer">
            GabbarInfo AI generates branded visual post graphics, writes engaging captions, and includes relevant hashtags. It can automatically syndicate newly published blog posts as rich link cards on your Facebook Page and as visual image cards on your Instagram business account the moment they go live.
          </div>
        </div>

        <div class="faq-item">
          <div class="faq-question">
            <span>Does GabbarInfo AI require installing heavy WordPress plugins?</span>
            <span class="faq-chevron">▼</span>
          </div>
          <div class="faq-answer">
            No heavy or bloated plugins are needed. GabbarInfo AI connects seamlessly to your WordPress or WooCommerce site using standard authenticated REST credentials or application passwords. Setup takes under 60 seconds.
          </div>
        </div>

        <div class="faq-item">
          <div class="faq-question">
            <span>Is the SEO content high-quality, or will it be flagged by Google?</span>
            <span class="faq-chevron">▼</span>
          </div>
          <div class="faq-answer">
            Every article is authored to exceed Google's Helpful Content Guidelines. Articles are 1,500+ words, deeply structured with H2/H3 subheadings, enriched with dual visuals (featured cover + custom infographic), injected with schema markup, and rigorously validated against duplication and keyword stuffing.
          </div>
        </div>

        <div class="faq-item">
          <div class="faq-question">
            <span>Can I review and edit drafts before anything is published live?</span>
            <span class="faq-chevron">▼</span>
          </div>
          <div class="faq-answer">
            Yes! You can operate in full Autonomous Autopilot Mode or switch to Manual Mode. In Manual Mode, you have an interactive editorial studio where you can review Google Ads copy, edit blog text in visual or HTML mode, inspect Google Search Console SERP previews, and approve assets before publishing.
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- ── 6. FINAL CALL TO ACTION BANNER ── -->
  <section class="gabbar-ai-container">
    <div class="ai-cta-banner">
      <h2>Transform Your Business with Autonomous AI Marketing</h2>
      <p>
        Experience the power of a complete digital marketing department running 24/7. Deploy Google Ads, Meta campaigns, social media posts, and SEO rankings with zero agency retainers.
      </p>
      <a href="https://ai.gabbarinfo.com" target="_blank" rel="noopener" class="btn-primary-ai">
        <span>🚀 Access GabbarInfo AI Command Center</span>
        <span>↗</span>
      </a>
    </div>
  </section>

</div>

<!-- ── LIVE SUBTLE CYBER MATRIX & 3D WIREFRAMES CANVAS SCRIPT ── -->
<script>
(function() {
  const canvas = document.getElementById("gabbarAiCanvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  let animationFrameId;
  let width = (canvas.width = window.innerWidth);
  let height = (canvas.height = canvas.parentElement.offsetHeight || window.innerHeight);

  const handleResize = () => {
    width = canvas.width = window.innerWidth;
    height = canvas.height = canvas.parentElement.offsetHeight || window.innerHeight;
    initColumns();
    polyhedra = createPolyhedra(width);
  };
  window.addEventListener("resize", handleResize);

  // Matrix Falling Code Characters (Clean Japanese Katakana, digits, symbols)
  const chars = "010101アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲンABCDEF<>{}/*=+~#$";
  const fontSize = 14;
  let columns = Math.floor(width / fontSize);
  let drops = [];

  function initColumns() {
    columns = Math.floor(width / fontSize);
    drops = [];
    for (let i = 0; i < columns; i++) {
      drops[i] = {
        y: Math.random() * (height + 200) - 100,
        speed: 0.8 + Math.random() * 1.5,
        brightness: 0.5 + Math.random() * 0.5,
      };
    }
  }
  initColumns();

  // 3D Rotating Geometric Wireframe Structures
  class GeometricPolyhedron {
    constructor(x, y, z, size, type = "icosahedron") {
      this.x = x;
      this.y = y;
      this.z = z;
      this.size = size;
      this.type = type;
      this.rotX = Math.random() * Math.PI;
      this.rotY = Math.random() * Math.PI;
      this.rotZ = Math.random() * Math.PI;
      this.speedX = 0.003 + Math.random() * 0.005;
      this.speedY = 0.004 + Math.random() * 0.005;
      this.speedZ = 0.002 + Math.random() * 0.004;

      if (type === "icosahedron") {
        const phi = (1 + Math.sqrt(5)) / 2;
        this.vertices = [
          [-1, phi, 0], [1, phi, 0], [-1, -phi, 0], [1, -phi, 0],
          [0, -1, phi], [0, 1, phi], [0, -1, -phi], [0, 1, -phi],
          [phi, 0, -1], [phi, 0, 1], [-phi, 0, -1], [-phi, 0, 1]
        ];
        this.edges = [
          [0,11],[0,5],[0,1],[0,7],[0,10],[1,5],[1,9],[1,8],[1,7],
          [2,11],[2,10],[2,6],[2,3],[2,4],[3,9],[3,4],[3,8],[3,6],
          [4,5],[4,9],[4,11],[5,9],[5,11],[6,7],[6,8],[6,10],
          [7,8],[7,10],[8,9],[10,11]
        ];
      } else {
        this.vertices = [
          [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]
        ];
        this.edges = [
          [0, 2], [2, 1], [1, 3], [3, 0], [0, 4], [2, 4], [1, 4], [3, 4],
          [0, 5], [2, 5], [1, 5], [3, 5]
        ];
      }
    }

    update() {
      this.rotX += this.speedX;
      this.rotY += this.speedY;
      this.rotZ += this.speedZ;
    }

    draw(ctx) {
      const cosX = Math.cos(this.rotX), sinX = Math.sin(this.rotX);
      const cosY = Math.cos(this.rotY), sinY = Math.sin(this.rotY);
      const cosZ = Math.cos(this.rotZ), sinZ = Math.sin(this.rotZ);

      const projected = this.vertices.map((v) => {
        let x = v[0] * this.size;
        let y = v[1] * this.size;
        let z = v[2] * this.size;

        let y1 = y * cosX - z * sinX;
        let z1 = y * sinX + z * cosX;
        let x2 = x * cosY + z1 * sinY;
        let z2 = -x * sinY + z1 * cosY;
        let x3 = x2 * cosZ - y1 * sinZ;
        let y3 = x2 * sinZ + y1 * cosZ;

        const fov = 400;
        const scale = fov / (fov + z2 + this.z);
        return {
          x: x3 * scale + this.x,
          y: y3 * scale + this.y,
          depth: z2,
        };
      });

      ctx.beginPath();
      ctx.strokeStyle = "rgba(16, 185, 129, 0.20)";
      ctx.lineWidth = 1;

      for (const edge of this.edges) {
        const p1 = projected[edge[0]];
        const p2 = projected[edge[1]];
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
      }
      ctx.stroke();

      for (const p of projected) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(56, 189, 248, 0.35)";
        ctx.fill();
      }
    }
  }

  function createPolyhedra(w) {
    const isMobile = w < 768;
    if (isMobile) {
      return [
        new GeometricPolyhedron(w * 0.5, height * 0.45, 120, 50, "octahedron"),
      ];
    }
    return [
      new GeometricPolyhedron(w * 0.16, height * 0.38, 100, 75, "icosahedron"),
      new GeometricPolyhedron(w * 0.84, height * 0.45, 120, 85, "octahedron"),
      new GeometricPolyhedron(w * 0.5, height * 0.82, 180, 60, "icosahedron"),
    ];
  }

  let polyhedra = createPolyhedra(width);

  // Render Loop - Soft, Airy, Subtle Matrix Streams (matching Sign-In page elegance)
  function render() {
    // Deep space clear with ghosting persistence
    ctx.fillStyle = "rgba(8, 11, 17, 0.25)";
    ctx.fillRect(0, 0, width, height);

    // Render Matrix Code Streams on alternate columns for clean, breathable spacing
    ctx.font = fontSize + "px monospace";
    for (let i = 0; i < drops.length; i += 2) {
      const drop = drops[i];
      const x = i * fontSize;
      const char = chars[Math.floor(Math.random() * chars.length)];

      // Soft glowing white/cyan head
      ctx.fillStyle = "rgba(220, 240, 255, 0.55)";
      ctx.fillText(char, x, drop.y);

      // Subtle cyan/emerald translucent fading stream (5 characters)
      for (let j = 1; j < 6; j++) {
        const trailY = drop.y - j * fontSize;
        if (trailY > 0 && trailY < height + 40) {
          const alpha = (1 - j / 6) * 0.18 * drop.brightness;
          ctx.fillStyle = "rgba(56, 189, 248, " + alpha + ")";
          const trailChar = chars[Math.floor(Math.random() * chars.length)];
          ctx.fillText(trailChar, x, trailY);
        }
      }

      drop.y += fontSize * drop.speed;
      if (drop.y > height + 60) {
        drop.y = Math.random() * -60;
        drop.speed = 0.8 + Math.random() * 1.5;
      }
    }

    // Render 3D Rotating Polyhedra
    for (const poly of polyhedra) {
      poly.update();
      poly.draw(ctx);
    }

    animationFrameId = requestAnimationFrame(render);
  }
  render();

  // FAQ Accordion Interaction
  const faqItems = document.querySelectorAll(".faq-item");
  faqItems.forEach((item) => {
    const question = item.querySelector(".faq-question");
    question.addEventListener("click", () => {
      const isActive = item.classList.contains("active");
      faqItems.forEach((other) => other.classList.remove("active"));
      if (!isActive) {
        item.classList.add("active");
      }
    });
  });
})();
</script>

<?php
get_footer();
