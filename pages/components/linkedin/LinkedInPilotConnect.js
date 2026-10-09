"use client";

import { useEffect, useState } from "react";

const DEFAULT_30_DAY_LINKEDIN_QUEUE = [
  {
    id: 1,
    scheduledDay: 1,
    pillar: "thought_leadership",
    targetService: "Strategic Vision",
    hook: "Most founders spend 80% of their time solving symptoms instead of root causes.",
    topic: "Root-Cause Leadership: Why 80% of B2B Roadblocks Stem from 2 Workflow Gaps",
    status: "next",
  },
  {
    id: 2,
    scheduledDay: 2,
    pillar: "actionable_playbook",
    targetService: "AI Automation",
    hook: "We replaced a 14-hour manual reporting cycle with a 3-step automated pipeline.",
    topic: "Step-by-Step AI Workflow Architecture for Enterprise Teams",
    status: "queued",
  },
  {
    id: 3,
    scheduledDay: 3,
    pillar: "case_study_win",
    targetService: "Client Acquisition",
    hook: "Zero ad spend, 42 qualified B2B inbound leads in 30 days. Here is the exact breakdown.",
    topic: "Organic B2B Inbound Engine: Anatomy of a Zero-Ad Customer Acquisition System",
    status: "queued",
  },
  {
    id: 4,
    scheduledDay: 4,
    pillar: "myth_busting",
    targetService: "Operational Efficiency",
    hook: "Hiring more headcount is often the most expensive way to disguise poor processes.",
    topic: "The Headcount Fallacy: Why High-Growth Teams Automate Before Hiring",
    status: "queued",
  },
  {
    id: 5,
    scheduledDay: 5,
    pillar: "service_spotlight",
    targetService: "Digital Transformation",
    hook: "Legacy software doesn't hold businesses back. Legacy workflows do.",
    topic: "Modernizing Legacy Enterprise Stacks Without Breaking Daily Operations",
    status: "queued",
  },
  {
    id: 6,
    scheduledDay: 6,
    pillar: "community_discussion",
    targetService: "Executive Strategy",
    hook: "Unpopular opinion: Long sales cycles are created by sellers, not buyers.",
    topic: "Shortening Enterprise Sales Velocity by Removing Friction in Discovery Calls",
    status: "queued",
  },
  {
    id: 7,
    scheduledDay: 7,
    pillar: "thought_leadership",
    targetService: "Retention & LTV",
    hook: "Customer retention is not an account management job—it is a product & delivery job.",
    topic: "Engineering 95%+ Net Revenue Retention (NRR) in B2B Services",
    status: "queued",
  },
  {
    id: 8,
    scheduledDay: 8,
    pillar: "actionable_playbook",
    targetService: "Brand Positioning",
    hook: "If you speak to everyone in B2B, nobody listens. The 1-sentence niche positioning matrix.",
    topic: "The 1-Sentence Positioning Framework That Converts Cold Prospects",
    status: "queued",
  },
  {
    id: 9,
    scheduledDay: 9,
    pillar: "case_study_win",
    targetService: "Tech Modernization",
    hook: "How we cut infrastructure costs by 40% while doubling API response throughput.",
    topic: "Cloud Cost Optimization & Scalability: A Technical Post-Mortem",
    status: "queued",
  },
  {
    id: 10,
    scheduledDay: 10,
    pillar: "myth_busting",
    targetService: "Sales & Marketing",
    hook: "MQLs (Marketing Qualified Leads) are vanity. Pipeline generated is the only metric that matters.",
    topic: "Why We Killed Traditional MQL Tracking in Favor of Revenue Pipeline Velocity",
    status: "queued",
  },
  {
    id: 11,
    scheduledDay: 11,
    pillar: "service_spotlight",
    targetService: "AI Integration",
    hook: "AI agents don't replace humans—they eliminate 30 hours of administrative drudgery per week.",
    topic: "Autonomous AI Workflows in Daily Operations: Real-World ROI Metrics",
    status: "queued",
  },
  {
    id: 12,
    scheduledDay: 12,
    pillar: "thought_leadership",
    targetService: "Culture & Execution",
    hook: "Speed of execution is the only sustainable competitive advantage left.",
    topic: "Cultivating High-Velocity Decision Making in Mid-Size Organizations",
    status: "queued",
  },
  {
    id: 13,
    scheduledDay: 13,
    pillar: "actionable_playbook",
    targetService: "Pricing Strategy",
    hook: "Stop billing by the hour. Value-based pricing transformed our client relationships.",
    topic: "Transitioning from Hourly Billing to Value-Based Retainers",
    status: "queued",
  },
  {
    id: 14,
    scheduledDay: 14,
    pillar: "case_study_win",
    targetService: "Workflow Automation",
    hook: "From manual chaos to zero-touch fulfillment: Client onboarding walkthrough.",
    topic: "Zero-Touch Client Onboarding: Designing an Automated Customer Journey",
    status: "queued",
  },
  {
    id: 15,
    scheduledDay: 15,
    pillar: "myth_busting",
    targetService: "Organic Growth",
    hook: "LinkedIn isn't for posting resume updates anymore. It's the #1 B2B media channel.",
    topic: "Treating Your Personal Profile as a Media Platform to Drive High-Ticket Deals",
    status: "queued",
  },
  {
    id: 16,
    scheduledDay: 16,
    pillar: "community_discussion",
    targetService: "Remote Work",
    hook: "Hybrid vs Remote vs In-Office: The real bottleneck isn't location, it's documentation.",
    topic: "Asynchronous Work Systems: How Top Teams Deliver Without Endless Zoom Calls",
    status: "queued",
  },
  {
    id: 17,
    scheduledDay: 17,
    pillar: "service_spotlight",
    targetService: "Security & Governance",
    hook: "Data privacy isn't compliance paperwork—it's your biggest sales enablement asset.",
    topic: "Enterprise Security Compliance as a Trust Accelerator in B2B Deals",
    status: "queued",
  },
  {
    id: 18,
    scheduledDay: 18,
    pillar: "thought_leadership",
    targetService: "Product Strategy",
    hook: "Features don't sell software. The emotional relief of solving a burning problem sells.",
    topic: "Product-Led vs Problem-Led Messaging: What Actually Converts Enterprise Buyers",
    status: "queued",
  },
  {
    id: 19,
    scheduledDay: 19,
    pillar: "actionable_playbook",
    targetService: "Talent & Delegation",
    hook: "How to delegate without losing quality: The 5-level ownership hierarchy.",
    topic: "The Delegation Framework: Handing Off Critical Operations Without Quality Drop",
    status: "queued",
  },
  {
    id: 20,
    scheduledDay: 20,
    pillar: "case_study_win",
    targetService: "Conversion Optimization",
    hook: "A 2-word copy tweak doubled landing page demo requests. Here is the data.",
    topic: "Micro-Copy Optimization: Increasing High-Intent Demo Conversions by 114%",
    status: "queued",
  },
  {
    id: 21,
    scheduledDay: 21,
    pillar: "myth_busting",
    targetService: "Bootstrapping vs VC",
    hook: "Profitability is the new hypergrowth. The shift back to solid unit economics.",
    topic: "Sustainable Unit Economics: Why Bootstrapped Metrics Win in 2026",
    status: "queued",
  },
  {
    id: 22,
    scheduledDay: 22,
    pillar: "service_spotlight",
    targetService: "Custom Integrations",
    hook: "Siloed SaaS tools are killing employee productivity. Connect your data pipelines.",
    topic: "Unified Data Architecture: Eliminating Data Silos Across Sales, Ops, and Support",
    status: "queued",
  },
  {
    id: 23,
    scheduledDay: 23,
    pillar: "community_discussion",
    targetService: "AI Governance",
    hook: "Will AI replace software developers or supercharge them 10x? Here is what our team found.",
    topic: "The Future of Full-Stack Development in an AI-Augmented Era",
    status: "queued",
  },
  {
    id: 24,
    scheduledDay: 24,
    pillar: "thought_leadership",
    targetService: "B2B Marketing",
    hook: "Cold outreach isn't dead, but lazy generic templates certainly are.",
    topic: "High-Relevance Personalization: The New Standard for B2B Account Outreach",
    status: "queued",
  },
  {
    id: 25,
    scheduledDay: 25,
    pillar: "actionable_playbook",
    targetService: "KPI Tracking",
    hook: "The 3 metrics every B2B executive should check on Monday morning before anything else.",
    topic: "The Executive Monday Scorecard: Cutting Through Analytics Noise",
    status: "queued",
  },
  {
    id: 26,
    scheduledDay: 26,
    pillar: "case_study_win",
    targetService: "Scalability",
    hook: "Handling a 10x sudden traffic surge without a single server hiccup: Lessons learned.",
    topic: "Architecting Resilient Infrastructure for High-Traffic Peak Demands",
    status: "queued",
  },
  {
    id: 27,
    scheduledDay: 27,
    pillar: "myth_busting",
    targetService: "Customer Success",
    hook: "Churn doesn't happen at renewal time. It happens in the first 14 days of onboarding.",
    topic: "The First-14-Days Principle: Stopping Customer Churn Before It Starts",
    status: "queued",
  },
  {
    id: 28,
    scheduledDay: 28,
    pillar: "service_spotlight",
    targetService: "Performance Marketing",
    hook: "Why creative testing matters 5x more than audience targeting on modern ad platforms.",
    topic: "Algorithmic Ad Optimization: Why Creative Variety Is the Real Targeting Variable",
    status: "queued",
  },
  {
    id: 29,
    scheduledDay: 29,
    pillar: "community_discussion",
    targetService: "Tech Trends",
    hook: "What technology bet are you making for the next 3 years that most people disagree with?",
    topic: "Contrarian Tech Bets: Where B2B Technology Is Actually Headed by 2028",
    status: "queued",
  },
  {
    id: 30,
    scheduledDay: 30,
    pillar: "thought_leadership",
    targetService: "Continuous Growth",
    hook: "30 days of consistent B2B posting transformed our brand visibility. Here are the 3 big takeaways.",
    topic: "The Compounding Effect of 30-Day B2B Content Consistency on Pipeline",
    status: "queued",
  },
];

export default function LinkedInPilotConnect() {
  const [status, setStatus] = useState("loading"); // loading | idle | connected
  const [connData, setConnData] = useState(null);
  const [disconnecting, setDisconnecting] = useState(false);

  const [postTopic, setPostTopic] = useState("");
  const [commentary, setCommentary] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [postFormat, setPostFormat] = useState("text"); // 'text' | 'image' | 'carousel' | 'video'
  const [videoUrl, setVideoUrl] = useState("");
  const [documentUrl, setDocumentUrl] = useState("");
  const [carouselUrls, setCarouselUrls] = useState([]);
  const [newSlideInput, setNewSlideInput] = useState("");
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const [slideCount, setSlideCount] = useState(3); // 2 to 5 slides
  const [generatingCarousel, setGeneratingCarousel] = useState(false);
  const [selectedAuthorUrn, setSelectedAuthorUrn] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generatingImage, setGeneratingImage] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishSuccess, setPublishSuccess] = useState(null);
  const [publishError, setPublishError] = useState(null);

  // Brand Intelligence & Non-Repeating Topics States
  const [brandWebsite, setBrandWebsite] = useState("");
  const [brandIntel, setBrandIntel] = useState(null);
  const [crawlingBrand, setCrawlingBrand] = useState(false);
  const [topicsFilter, setTopicsFilter] = useState("all"); // 'all' | 'queued' | 'published'
  const [selectedTopicId, setSelectedTopicId] = useState(null);
  const [queueSearch, setQueueSearch] = useState("");
  const [queueViewMode, setQueueViewMode] = useState("cards"); // 'cards' | 'chips'

  // Autopilot States
  const [autopilotConfig, setAutopilotConfig] = useState({
    enabled: false,
    frequency: "daily",
    topics: "B2B Growth, AI Automation, Tech Innovation",
    generateImage: true,
  });
  const [savingAutopilot, setSavingAutopilot] = useState(false);
  const [runningAutopilot, setRunningAutopilot] = useState(false);

  const fetchStatus = async () => {
    try {
      setStatus("loading");
      const res = await fetch("/api/linkedin/status");
      const data = await res.json();
      if (data.ok && data.connected) {
        setStatus("connected");
        setConnData(data);
        if (data.organizations?.length > 0 && !selectedAuthorUrn) {
          setSelectedAuthorUrn(data.organizations[0].urn);
        } else if (data.member?.urn && !selectedAuthorUrn) {
          setSelectedAuthorUrn(data.member.urn);
        }
      } else {
        setStatus("idle");
        setConnData(null);
      }
    } catch (e) {
      console.warn("Failed to check LinkedIn status:", e);
      setStatus("idle");
    }
  };

  const fetchAutopilotConfig = async () => {
    try {
      const res = await fetch("/api/linkedin/autopilot-config");
      const data = await res.json();
      if (data.ok && data.config) {
        setAutopilotConfig(data.config);
      }
    } catch (_) {}
  };

  const fetchBrandIntel = async () => {
    try {
      const res = await fetch("/api/linkedin/brand-intel");
      const data = await res.json();
      if (data.ok && data.intelligence) {
        setBrandIntel(data.intelligence);
        if (data.intelligence.websiteUrl) setBrandWebsite(data.intelligence.websiteUrl);
      }
    } catch (_) {}
  };

  useEffect(() => {
    fetchStatus();
    fetchAutopilotConfig();
    fetchBrandIntel();

    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get("linkedin_connected") === "1") {
        const type = urlParams.get("connected_type") === "page" ? "Company Page" : "Personal Profile";
        setPublishSuccess({
          message: `LinkedIn ${type} successfully connected! You can now compose and broadcast B2B posts.`,
        });
      }
    }
  }, []);

  const handleConnect = (type = "page") => {
    window.location.href = `/api/linkedin/connect?type=${type}`;
  };

  const handleDisconnect = async (target = "all") => {
    const label = target === "member" ? "Personal Profile" : target === "page" ? "Company Page" : "LinkedIn account";
    if (!window.confirm(`Are you sure you want to disconnect your LinkedIn ${label} from GabbarInfo AI?`)) {
      return;
    }
    try {
      setDisconnecting(true);
      const res = await fetch("/api/linkedin/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target }),
      });
      const data = await res.json();
      if (data.ok) {
        await fetchStatus();
        setPublishSuccess({ message: data.message || `LinkedIn ${label} disconnected successfully.` });
      } else {
        alert(data.error || "Failed to disconnect account.");
      }
    } catch (e) {
      alert("Error disconnecting LinkedIn: " + e.message);
    } finally {
      setDisconnecting(false);
    }
  };

  const handleCrawlWebsite = async () => {
    if (!brandWebsite.trim()) {
      alert("Please enter a valid website URL (e.g. https://example.com)");
      return;
    }
    try {
      setCrawlingBrand(true);
      setPublishError(null);
      const res = await fetch("/api/linkedin/crawl-brand", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          websiteUrl: brandWebsite.trim(),
          brandName: activeAuthorName,
        }),
      });
      const data = await res.json();
      if (data.ok && data.intelligence) {
        setBrandIntel(data.intelligence);
        alert(`✅ Deep Crawl Complete! Discovered ${data.intelligence.services?.length || 0} core services and formulated 30 unique non-repeating LinkedIn editorial topics!`);
      } else {
        alert(data.error || "Failed to analyze website.");
      }
    } catch (e) {
      alert("Crawl error: " + e.message);
    } finally {
      setCrawlingBrand(false);
    }
  };

  const handleUseTopic = (topicObj) => {
    setSelectedTopicId(topicObj.id);
    setPostTopic(topicObj.topic);
    if (!commentary.trim() || commentary.startsWith("💡")) {
      setCommentary(`💡 ${topicObj.hook}\n\nWhen scaling ${topicObj.targetService || "your business"}, execution is everything.\n\nHere are the critical lessons:`);
    }
  };

  const handleGenerateAiCreativePackage = async () => {
    if (!postTopic.trim()) {
      alert("Please enter a topic or select one from the 30-Day Queue below.");
      return;
    }
    try {
      setGenerating(true);
      setPublishError(null);
      const activeOrg = orgs.find((o) => o.urn === selectedAuthorUrn);
      const brandName = activeOrg?.name || member?.name || "Business";

      const res = await fetch("/api/linkedin/generate-creative", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: postTopic,
          brandName,
          format: postFormat,
          slideCount,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        if (data.commentary) setCommentary(data.commentary);
        if (data.imageUrl) setImageUrl(data.imageUrl);
        if (data.carouselUrls && data.carouselUrls.length > 0) {
          setCarouselUrls(data.carouselUrls);
          setActiveSlideIndex(0);
        }
        if (data.videoUrl) setVideoUrl(data.videoUrl);
      } else {
        setPublishError(data.error || "Failed to generate AI creative package.");
      }
    } catch (e) {
      setPublishError("AI generation failed: " + e.message);
    } finally {
      setGenerating(false);
    }
  };

  const handleGenerateAiPost = async () => {
    return handleGenerateAiCreativePackage();
  };

  const handleGenerateAiImage = async () => {
    try {
      setGeneratingImage(true);
      setPublishError(null);
      const activeOrg = orgs.find((o) => o.urn === selectedAuthorUrn);
      const brandName = activeOrg?.name || member?.name || "B2B Business";

      const res = await fetch("/api/linkedin/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: postTopic ? `Professional 3D isometric B2B visual about ${postTopic}` : null,
          commentary: commentary.trim() || postTopic,
          brandName,
        }),
      });

      const data = await res.json();
      if (data.ok && data.imageUrl) {
        setImageUrl(data.imageUrl);
      } else {
        setPublishError(data.error || "Failed to generate AI visual.");
      }
    } catch (e) {
      setPublishError("AI Image error: " + e.message);
    } finally {
      setGeneratingImage(false);
    }
  };

  const handleGenerateAiCarousel = async () => {
    try {
      setGeneratingCarousel(true);
      setPublishError(null);
      const activeOrg = orgs.find((o) => o.urn === selectedAuthorUrn);
      const brandName = activeOrg?.name || member?.name || "B2B Brand";

      const prompts = [
        `Slide 1 Title Card: ${postTopic || "Key B2B Insights & Strategies"} - Bold modern infographic title card for ${brandName}`,
        `Slide 2 Core Insights: Actionable Takeaways & Growth Framework for ${postTopic || "Scaling"} - Clean presentation graphic`,
        `Slide 3 Summary: Final Takeaways & Executive Call to Action for ${brandName} - Tech leadership style`,
      ];

      const slideUrls = [];
      for (const p of prompts) {
        const res = await fetch("/api/linkedin/generate-image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: p,
            commentary: commentary.trim() || postTopic,
            brandName,
          }),
        });
        const data = await res.json();
        if (data.ok && data.imageUrl) {
          slideUrls.push(data.imageUrl);
        }
      }

      if (slideUrls.length > 0) {
        setCarouselUrls(slideUrls);
        setPostFormat("carousel");
        setActiveSlideIndex(0);
      } else {
        setPublishError("Failed to generate AI carousel slides.");
      }
    } catch (e) {
      setPublishError("AI Carousel generation error: " + e.message);
    } finally {
      setGeneratingCarousel(false);
    }
  };

  const handlePublishPost = async () => {
    if (!commentary.trim()) {
      alert("Post commentary cannot be empty.");
      return;
    }
    try {
      setPublishing(true);
      setPublishError(null);
      setPublishSuccess(null);

      const targetUrn = selectedAuthorUrn || (orgs[0]?.urn || member?.urn);

      const res = await fetch("/api/linkedin/post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          commentary: commentary.trim(),
          imageUrl: postFormat === "image" ? (imageUrl.trim() || null) : null,
          videoUrl: postFormat === "video" ? (videoUrl.trim() || null) : null,
          carouselUrls: postFormat === "carousel" ? (carouselUrls.length > 0 ? carouselUrls : null) : null,
          documentUrl: postFormat === "carousel" ? (documentUrl.trim() || null) : null,
          targetUrn,
          title: postTopic ? `GabbarInfo AI: ${postTopic}` : "GabbarInfo AI Broadcast",
        }),
      });

      const data = await res.json();
      if (data.ok) {
        setPublishSuccess({
          message: data.message || "Post successfully published to LinkedIn!",
          postUrl: data.postUrl,
          postUrn: data.postUrn,
        });
        setCommentary("");
        setImageUrl("");
        setVideoUrl("");
        setCarouselUrls([]);
        setDocumentUrl("");
        setPostTopic("");
      } else {
        setPublishError(data.error || "Failed to publish post.");
      }
    } catch (e) {
      setPublishError("Publishing error: " + e.message);
    } finally {
      setPublishing(false);
    }
  };

  const handleSaveAutopilot = async () => {
    try {
      setSavingAutopilot(true);
      const res = await fetch("/api/linkedin/autopilot-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...autopilotConfig,
          targetUrn: selectedAuthorUrn || (orgs[0]?.urn || member?.urn),
        }),
      });
      const data = await res.json();
      if (data.ok) {
        alert("✅ LinkedIn Auto-Pilot settings saved successfully!");
      } else {
        alert(data.error || "Failed to save settings.");
      }
    } catch (e) {
      alert("Error: " + e.message);
    } finally {
      setSavingAutopilot(false);
    }
  };

  const handleRunAutopilotCycle = async () => {
    try {
      setRunningAutopilot(true);
      setPublishError(null);
      setPublishSuccess(null);

      const res = await fetch("/api/linkedin/autopilot-run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const data = await res.json();
      if (data.ok) {
        setPublishSuccess({
          message: "⚡ Auto-Pilot cycle completed! New post published autonomously.",
          postUrl: data.postUrl,
          postUrn: data.postUrn,
        });
        if (data.commentary) setCommentary(data.commentary);
        if (data.imageUrl) setImageUrl(data.imageUrl);
        fetchBrandIntel(); // Refresh topic queue status
      } else {
        setPublishError(data.error || "Auto-Pilot run failed.");
      }
    } catch (e) {
      setPublishError("Auto-Pilot error: " + e.message);
    } finally {
      setRunningAutopilot(false);
    }
  };

  const member = connData?.member;
  const orgs = connData?.organizations || [];
  const isMemberConnected = Boolean(connData?.isMemberConnected);
  const isPageConnected = Boolean(connData?.isPageConnected);

  const activeAuthorName = (() => {
    const org = orgs.find((o) => o.urn === selectedAuthorUrn);
    if (org) return org.name;
    if (member?.name) return member.name;
    return "Your Brand / Page";
  })();

  const rawTopics = brandIntel?.topicsQueue?.length > 0
    ? brandIntel.topicsQueue
    : DEFAULT_30_DAY_LINKEDIN_QUEUE;

  const filteredTopics = rawTopics.filter((t) => {
    if (topicsFilter === "queued") return t.status !== "published";
    if (topicsFilter === "published") return t.status === "published";
    if (queueSearch.trim()) {
      const q = queueSearch.toLowerCase();
      const topicText = (t.topic || "").toLowerCase();
      const hookText = (t.hook || "").toLowerCase();
      const srvText = (t.targetService || "").toLowerCase();
      return topicText.includes(q) || hookText.includes(q) || srvText.includes(q);
    }
    return true;
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, width: "100%" }}>
      {/* ── TOP HERO BANNER ── */}
      {/* ── HEADER BANNER ── */}
      <div
        style={{
          padding: "24px 28px",
          borderRadius: 20,
          background: "linear-gradient(135deg, rgba(10, 102, 194, 0.18) 0%, rgba(14, 19, 30, 0.95) 100%)",
          border: "1px solid rgba(10, 102, 194, 0.35)",
          boxShadow: "0 15px 40px rgba(0, 0, 0, 0.4), 0 0 25px rgba(10, 102, 194, 0.1)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 16,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 14,
              background: "#0a66c2",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 26,
              boxShadow: "0 4px 18px rgba(10, 102, 194, 0.4)",
            }}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="#ffffff">
              <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.46 10.9h2.77v8.37H6.46v-8.37M7.84 6.2a1.62 1.62 0 0 0-1.63 1.62c0 .89.73 1.62 1.63 1.62.9 0 1.63-.73 1.63-1.62 0-.9-.73-1.62-1.63-1.62Z" />
            </svg>
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "#ffffff" }}>
                LinkedIn Pilot & Company Page Syndicate
              </h2>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  padding: "3px 8px",
                  borderRadius: 999,
                  background: status === "connected" ? "rgba(34, 197, 94, 0.15)" : "rgba(148, 163, 184, 0.15)",
                  color: status === "connected" ? "#4ade80" : "#94a3b8",
                  border: `1px solid ${status === "connected" ? "rgba(34, 197, 94, 0.3)" : "rgba(148, 163, 184, 0.2)"}`,
                }}
              >
                {status === "loading" ? "CHECKING..." : status === "connected" ? "● LIVE ACTIVE" : "○ DISCONNECTED"}
              </span>
            </div>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "#94a3b8" }}>
              AI website learning, zero-repetition topic rotation, and automated B2B broadcasting via GabbarInfo AI.
            </p>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {status === "connected" && (
            <button
              onClick={() => handleDisconnect("all")}
              disabled={disconnecting}
              style={{
                padding: "9px 16px",
                borderRadius: 10,
                background: "rgba(239, 68, 68, 0.12)",
                border: "1px solid rgba(239, 68, 68, 0.3)",
                color: "#f87171",
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {disconnecting ? "Disconnecting…" : "Disconnect All"}
            </button>
          )}
        </div>
      </div>

      {/* ── DEDICATED LINKEDIN ACCOUNTS & PAGES HUB ── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: 16,
        }}
      >
        {/* Card 1: Personal Profile */}
        <div
          style={{
            padding: "18px 22px",
            borderRadius: 16,
            background: "rgba(14, 19, 30, 0.8)",
            border: `1px solid ${connData?.isMemberConnected ? "rgba(10, 102, 194, 0.45)" : "rgba(255, 255, 255, 0.08)"}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 14,
            boxShadow: connData?.isMemberConnected ? "0 4px 20px rgba(10, 102, 194, 0.15)" : "none",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0 }}>
            {connData?.isMemberConnected && member?.picture ? (
              <img
                src={member.picture}
                alt={member.name || "Profile"}
                style={{
                  width: 50,
                  height: 50,
                  borderRadius: "50%",
                  objectFit: "cover",
                  border: "2px solid #0a66c2",
                  boxShadow: "0 2px 10px rgba(10, 102, 194, 0.35)",
                  flexShrink: 0,
                }}
              />
            ) : (
              <div
                style={{
                  width: 50,
                  height: 50,
                  borderRadius: "50%",
                  background: "linear-gradient(135deg, #0a66c2 0%, #004182 100%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#fff",
                  fontWeight: 800,
                  fontSize: 18,
                  flexShrink: 0,
                }}
              >
                {member?.name ? member.name.charAt(0) : "👤"}
              </div>
            )}
            <div style={{ minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 14.5, fontWeight: 800, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {connData?.isMemberConnected ? (member?.name || "Personal Profile") : "Personal Profile"}
                </span>
                <span
                  style={{
                    fontSize: 9.5,
                    fontWeight: 800,
                    padding: "2px 7px",
                    borderRadius: 999,
                    background: connData?.isMemberConnected ? "rgba(34, 197, 94, 0.15)" : "rgba(148, 163, 184, 0.15)",
                    color: connData?.isMemberConnected ? "#4ade80" : "#94a3b8",
                    border: `1px solid ${connData?.isMemberConnected ? "rgba(34, 197, 94, 0.3)" : "rgba(148, 163, 184, 0.2)"}`,
                  }}
                >
                  {connData?.isMemberConnected ? "● CONNECTED" : "○ NOT LINKED"}
                </span>
              </div>
              <p style={{ margin: "3px 0 0", fontSize: 11.5, color: "#94a3b8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {connData?.isMemberConnected ? (member?.email || "Personal Feed Broadcasting") : "Self-serve direct feed posting"}
              </p>
            </div>
          </div>

          <div>
            {connData?.isMemberConnected ? (
              <button
                onClick={() => handleDisconnect("member")}
                disabled={disconnecting}
                style={{
                  padding: "8px 14px",
                  borderRadius: 10,
                  background: "rgba(239, 68, 68, 0.1)",
                  border: "1px solid rgba(239, 68, 68, 0.35)",
                  color: "#f87171",
                  fontSize: 11.5,
                  fontWeight: 700,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                Disconnect
              </button>
            ) : (
              <button
                onClick={() => handleConnect("member")}
                style={{
                  padding: "9px 15px",
                  borderRadius: 10,
                  background: "#0a66c2",
                  border: "none",
                  color: "#fff",
                  fontSize: 12,
                  fontWeight: 800,
                  cursor: "pointer",
                  boxShadow: "0 4px 12px rgba(10, 102, 194, 0.35)",
                  whiteSpace: "nowrap",
                }}
              >
                Connect Profile ↗
              </button>
            )}
          </div>
        </div>

        {/* Card 2: Company Page Syndicate */}
        <div
          style={{
            padding: "18px 22px",
            borderRadius: 16,
            background: "rgba(14, 19, 30, 0.8)",
            border: `1px solid ${connData?.isPageConnected ? "rgba(56, 189, 248, 0.45)" : "rgba(255, 255, 255, 0.08)"}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 14,
            boxShadow: connData?.isPageConnected ? "0 4px 20px rgba(56, 189, 248, 0.15)" : "none",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0 }}>
            <div
              style={{
                width: 50,
                height: 50,
                borderRadius: 12,
                background: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)",
                border: "1px solid rgba(255, 255, 255, 0.12)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 22,
                flexShrink: 0,
              }}
            >
              🏢
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 14.5, fontWeight: 800, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {connData?.isPageConnected && orgs.length > 0 ? orgs[0].name : "Company Page"}
                </span>
                <span
                  style={{
                    fontSize: 9.5,
                    fontWeight: 800,
                    padding: "2px 7px",
                    borderRadius: 999,
                    background: connData?.isPageConnected ? "rgba(34, 197, 94, 0.15)" : "rgba(148, 163, 184, 0.15)",
                    color: connData?.isPageConnected ? "#4ade80" : "#94a3b8",
                    border: `1px solid ${connData?.isPageConnected ? "rgba(34, 197, 94, 0.3)" : "rgba(148, 163, 184, 0.2)"}`,
                  }}
                >
                  {connData?.isPageConnected ? "● CONNECTED" : "○ NOT LINKED"}
                </span>
              </div>
              <p style={{ margin: "3px 0 0", fontSize: 11.5, color: "#94a3b8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {connData?.isPageConnected ? (orgs.length > 1 ? `${orgs.length} Pages Managed (Admin Access)` : "B2B Brand Page Broadcasting") : "Requires Page Admin Permissions"}
              </p>
            </div>
          </div>

          <div>
            {connData?.isPageConnected ? (
              <button
                onClick={() => handleDisconnect("page")}
                disabled={disconnecting}
                style={{
                  padding: "8px 14px",
                  borderRadius: 10,
                  background: "rgba(239, 68, 68, 0.1)",
                  border: "1px solid rgba(239, 68, 68, 0.35)",
                  color: "#f87171",
                  fontSize: 11.5,
                  fontWeight: 700,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                Disconnect
              </button>
            ) : (
              <button
                onClick={() => handleConnect("page")}
                style={{
                  padding: "9px 15px",
                  borderRadius: 10,
                  background: "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)",
                  border: "none",
                  color: "#fff",
                  fontSize: 12,
                  fontWeight: 800,
                  cursor: "pointer",
                  boxShadow: "0 4px 12px rgba(2, 132, 199, 0.35)",
                  whiteSpace: "nowrap",
                }}
              >
                Connect Page ↗
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── NOTIFICATIONS / ALERTS ── */}
      {publishSuccess && (
        <div
          style={{
            padding: "14px 18px",
            borderRadius: 12,
            background: "rgba(34, 197, 94, 0.12)",
            border: "1px solid rgba(34, 197, 94, 0.35)",
            color: "#4ade80",
            fontSize: 13.5,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 10,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span>✅</span>
            <span>{publishSuccess.message}</span>
          </div>
          {publishSuccess.postUrl && (
            <a
              href={publishSuccess.postUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: "#ffffff",
                background: "#0a66c2",
                padding: "6px 14px",
                borderRadius: 8,
                textDecoration: "none",
                fontWeight: 700,
                fontSize: 12,
              }}
            >
              View on LinkedIn ↗
            </a>
          )}
        </div>
      )}

      {publishError && (
        <div
          style={{
            padding: "14px 18px",
            borderRadius: 12,
            background: "rgba(239, 68, 68, 0.12)",
            border: "1px solid rgba(239, 68, 68, 0.35)",
            color: "#f87171",
            fontSize: 13.5,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span>⚠️</span>
          <span>{publishError}</span>
        </div>
      )}

      {/* ── 1. BRAND INTELLIGENCE & WEBSITE CRAWLER (ZERO REPETITION ENGINE) ── */}
      <div
        id="brand-crawler-section"
        style={{
          padding: "24px 28px",
          borderRadius: 20,
          background: "linear-gradient(180deg, rgba(14, 25, 45, 0.85) 0%, rgba(10, 16, 28, 0.95) 100%)",
          border: "1px solid rgba(56, 189, 248, 0.25)",
          boxShadow: "0 15px 40px rgba(0,0,0,0.4), 0 0 30px rgba(56, 189, 248, 0.05)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18, flexWrap: "wrap", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 42, height: 42, borderRadius: 12, background: "rgba(56, 189, 248, 0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, border: "1px solid rgba(56, 189, 248, 0.35)" }}>
              🧠
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#ffffff" }}>
                  Brand Intelligence & Website Knowledge Crawler
                </h3>
                <span style={{ fontSize: 10, fontWeight: 800, padding: "3px 8px", borderRadius: 999, background: "rgba(56, 189, 248, 0.15)", color: "#38bdf8", border: "1px solid rgba(56, 189, 248, 0.3)" }}>
                  ZERO-REPETITION GUARD ACTIVE
                </span>
              </div>
              <p style={{ margin: "2px 0 0", fontSize: 12.5, color: "#94a3b8" }}>
                Learns your real business services, target B2B buyers, and formulates 30 unique, non-repeating editorial angles.
              </p>
            </div>
          </div>
        </div>

        {/* Crawl URL Input Bar */}
        <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
          <input
            type="text"
            placeholder="Enter your website URL (e.g. https://gabbarinfo.com or https://clientbrand.com)..."
            value={brandWebsite}
            onChange={(e) => setBrandWebsite(e.target.value)}
            style={{
              flex: 1,
              minWidth: 260,
              padding: "12px 16px",
              borderRadius: 12,
              background: "rgba(0,0,0,0.35)",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              color: "#fff",
              fontSize: 13.5,
            }}
          />
          <button
            onClick={handleCrawlWebsite}
            disabled={crawlingBrand}
            style={{
              padding: "12px 22px",
              borderRadius: 12,
              background: "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)",
              border: "none",
              color: "#fff",
              fontSize: 13,
              fontWeight: 800,
              cursor: "pointer",
              boxShadow: "0 4px 16px rgba(2, 132, 199, 0.35)",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span>{crawlingBrand ? "Crawling & Formulating Topics…" : "🔍 Deep Crawl & Learn Brand Services"}</span>
          </button>
        </div>

        {/* Learned Knowledge Highlights */}
        {brandIntel && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14 }}>
              <div style={{ padding: "12px 16px", borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 700, textTransform: "uppercase" }}>Industry & Niche</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: "#38bdf8", marginTop: 4 }}>{brandIntel.industry}</div>
                <div style={{ fontSize: 11.5, color: "#64748b", marginTop: 2 }}>{brandIntel.tagline}</div>
              </div>

              <div style={{ padding: "12px 16px", borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 700, textTransform: "uppercase" }}>Target B2B Audience</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: "#a855f7", marginTop: 4 }}>{brandIntel.targetAudience}</div>
                <div style={{ fontSize: 11.5, color: "#64748b", marginTop: 2 }}>Learned from website structure</div>
              </div>
            </div>

            {/* Extracted Core Services */}
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#cbd5e1", marginBottom: 8 }}>
                💼 Discovered Core Services & Capabilities:
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {(brandIntel.services || []).map((service, sIdx) => (
                  <span
                    key={sIdx}
                    style={{
                      padding: "5px 12px",
                      borderRadius: 999,
                      background: "rgba(59, 130, 246, 0.12)",
                      border: "1px solid rgba(59, 130, 246, 0.3)",
                      color: "#93c5fd",
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    ✓ {service}
                  </span>
                ))}
              </div>
            </div>

            {/* 30-Day Non-Repeating Editorial Queue */}
            <div style={{ marginTop: 8 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 800, color: "#ffffff" }}>
                    📅 30-Day Non-Repeating Editorial Queue ({rawTopics.length} Topics Formulated)
                  </span>
                </div>

                <div style={{ display: "flex", gap: 6 }}>
                  {["all", "queued", "published"].map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setTopicsFilter(tab)}
                      style={{
                        padding: "4px 10px",
                        borderRadius: 6,
                        border: "none",
                        background: topicsFilter === tab ? "#0a66c2" : "rgba(255,255,255,0.06)",
                        color: topicsFilter === tab ? "#fff" : "#94a3b8",
                        fontSize: 11.5,
                        fontWeight: 700,
                        cursor: "pointer",
                        textTransform: "capitalize",
                      }}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
              </div>

              {/* Topics Scroll Strip */}
              <div
                style={{
                  maxHeight: 280,
                  overflowY: "auto",
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                  paddingRight: 6,
                }}
              >
                {filteredTopics.map((item, tIdx) => (
                  <div
                    key={tIdx}
                    style={{
                      padding: "10px 14px",
                      borderRadius: 12,
                      background: item.status === "next" ? "rgba(56, 189, 248, 0.08)" : item.status === "published" ? "rgba(34, 197, 94, 0.06)" : "rgba(255, 255, 255, 0.02)",
                      border: `1px solid ${item.status === "next" ? "rgba(56, 189, 248, 0.3)" : item.status === "published" ? "rgba(34, 197, 94, 0.2)" : "rgba(255, 255, 255, 0.06)"}`,
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 12,
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                        <span style={{ fontSize: 10, fontWeight: 800, padding: "2px 6px", borderRadius: 4, background: "rgba(255,255,255,0.08)", color: "#cbd5e1" }}>
                          Day {item.scheduledDay}
                        </span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: "#38bdf8" }}>
                          {item.targetService}
                        </span>
                        <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, background: item.status === "published" ? "rgba(34,197,94,0.15)" : item.status === "next" ? "rgba(56,189,248,0.2)" : "rgba(148,163,184,0.1)", color: item.status === "published" ? "#4ade80" : item.status === "next" ? "#38bdf8" : "#94a3b8", fontWeight: 800 }}>
                          {item.status === "published" ? "PUBLISHED" : item.status === "next" ? "NEXT IN QUEUE" : "QUEUED"}
                        </span>
                      </div>
                      <div style={{ fontSize: 12.5, fontWeight: 700, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {item.topic}
                      </div>
                      <div style={{ fontSize: 11.5, color: "#94a3b8" }}>
                        Hook: "{item.hook}"
                      </div>
                    </div>

                    <button
                      onClick={() => handleUseTopic(item)}
                      style={{
                        padding: "6px 12px",
                        borderRadius: 8,
                        background: "rgba(56, 189, 248, 0.15)",
                        border: "1px solid rgba(56, 189, 248, 0.3)",
                        color: "#38bdf8",
                        fontSize: 11,
                        fontWeight: 700,
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                      }}
                    >
                      ⚡ Use In Composer
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── BROADCAST STUDIO & LIVE PREVIEW ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 460px), 1fr))", gap: 24 }}>
        {/* Column 1: Post Broadcast Studio */}
        <div
          style={{
            padding: "24px 26px",
            borderRadius: 20,
            background: "rgba(14, 19, 30, 0.85)",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: "#38bdf8", textTransform: "uppercase" }}>
              ✍️ Post Broadcast Studio
            </span>
            <span style={{ fontSize: 11, color: "#64748b" }}>
              {commentary.length} chars
            </span>
          </div>

          {/* Author Target Selector */}
          <div>
            <label style={{ fontSize: 11.5, color: "#94a3b8", fontWeight: 700, display: "block", marginBottom: 6 }}>
              Publish Destination:
            </label>
            <select
              value={selectedAuthorUrn}
              onChange={(e) => setSelectedAuthorUrn(e.target.value)}
              style={{
                width: "100%",
                padding: "10px 14px",
                borderRadius: 10,
                background: "#0b1220",
                border: "1px solid rgba(255, 255, 255, 0.15)",
                color: "#fff",
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              {orgs.map((org, i) => (
                <option key={i} value={org.urn}>
                  🏢 Company Page: {org.name}
                </option>
              ))}
              {member?.urn && (
                <option value={member.urn}>
                  👤 Personal Profile: {member.name}
                </option>
              )}
              {orgs.length === 0 && !member?.urn && (
                <option value="">(Connect Company Page or Profile above)</option>
              )}
            </select>
          </div>

          {/* ── FORMAT SWITCHER TABS ── */}
          <div>
            <label style={{ fontSize: 11.5, color: "#94a3b8", fontWeight: 700, display: "block", marginBottom: 6 }}>
              1. Choose Post Format to Generate:
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6 }}>
              {[
                { id: "text", label: "✍️ Text Only", desc: "Thought post" },
                { id: "image", label: "🖼️ Post + Image", desc: "AI Visual" },
                { id: "carousel", label: "📑 Post + Carousel", desc: `${slideCount}-Slide Deck` },
                { id: "video", label: "🎥 Post + Video", desc: "B2B Reel" },
              ].map((fmt) => (
                <button
                  key={fmt.id}
                  type="button"
                  onClick={() => setPostFormat(fmt.id)}
                  style={{
                    padding: "10px 6px",
                    borderRadius: 10,
                    background: postFormat === fmt.id ? "rgba(10, 102, 194, 0.3)" : "rgba(255, 255, 255, 0.04)",
                    border: `1.5px solid ${postFormat === fmt.id ? "#0a66c2" : "rgba(255, 255, 255, 0.1)"}`,
                    color: postFormat === fmt.id ? "#38bdf8" : "#94a3b8",
                    fontSize: 12,
                    fontWeight: postFormat === fmt.id ? 800 : 600,
                    cursor: "pointer",
                    textAlign: "center",
                    boxShadow: postFormat === fmt.id ? "0 2px 10px rgba(10, 102, 194, 0.25)" : "none",
                  }}
                >
                  <div>{fmt.label}</div>
                  <div style={{ fontSize: 9.5, color: postFormat === fmt.id ? "#93c5fd" : "#64748b", marginTop: 2 }}>{fmt.desc}</div>
                </button>
              ))}
            </div>

            {/* Slide Count Selector when Carousel is chosen */}
            {postFormat === "carousel" && (
              <div style={{ marginTop: 10, padding: "8px 12px", borderRadius: 8, background: "rgba(56, 189, 248, 0.08)", border: "1px solid rgba(56, 189, 248, 0.2)", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                <span style={{ fontSize: 11.5, color: "#38bdf8", fontWeight: 700 }}>
                  Select Carousel Slides to Generate:
                </span>
                <div style={{ display: "flex", gap: 6 }}>
                  {[2, 3, 4, 5].map((cnt) => (
                    <button
                      key={cnt}
                      type="button"
                      onClick={() => setSlideCount(cnt)}
                      style={{
                        padding: "4px 10px",
                        borderRadius: 6,
                        background: slideCount === cnt ? "#0284c7" : "rgba(255, 255, 255, 0.06)",
                        border: `1px solid ${slideCount === cnt ? "#38bdf8" : "rgba(255, 255, 255, 0.15)"}`,
                        color: "#fff",
                        fontSize: 11,
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      {cnt} Slides {cnt === 3 ? "(Popular)" : ""}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* AI Prompt Input & One-Click Generation */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <label style={{ fontSize: 11.5, color: "#94a3b8", fontWeight: 700 }}>
                2. Enter Topic or Select from 30-Day Queue below:
              </label>
              <div style={{ fontSize: 11, color: "#38bdf8", fontWeight: 700 }}>
                {brandIntel?.brandName ? "✨ Crawled Brand Queue Active" : "🌟 30-Day Master Queue Ready"}
              </div>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <input
                type="text"
                placeholder="Enter topic or click any topic from 30-Day Queue below..."
                value={postTopic}
                onChange={(e) => setPostTopic(e.target.value)}
                style={{
                  flex: 1,
                  padding: "11px 14px",
                  borderRadius: 10,
                  background: "rgba(0,0,0,0.3)",
                  border: "1px solid rgba(255, 255, 255, 0.12)",
                  color: "#fff",
                  fontSize: 13,
                }}
              />
              <button
                onClick={handleGenerateAiCreativePackage}
                disabled={generating}
                style={{
                  padding: "11px 20px",
                  borderRadius: 10,
                  background: "linear-gradient(135deg, #0284c7 0%, #0a66c2 100%)",
                  border: "none",
                  color: "#fff",
                  fontSize: 13,
                  fontWeight: 800,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  boxShadow: "0 4px 14px rgba(10, 102, 194, 0.4)",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <span>
                  {generating
                    ? "Generating Package…"
                    : postFormat === "carousel"
                    ? `✨ Generate Post + ${slideCount}-Slide Carousel`
                    : postFormat === "video"
                    ? "✨ Generate Post + Video Reel"
                    : postFormat === "image"
                    ? "✨ Generate Post + Image Creative"
                    : "✨ Generate Post Copy & Hashtags"}
                </span>
              </button>
            </div>

            {/* ── 30-DAY EDITORIAL QUEUE SHELF (DIRECTLY UNDER INPUT) ── */}
            <div
              style={{
                marginTop: 12,
                borderRadius: 14,
                background: "linear-gradient(180deg, rgba(15, 23, 42, 0.8) 0%, rgba(10, 15, 29, 0.95) 100%)",
                border: "1px solid rgba(14, 165, 233, 0.25)",
                padding: "14px 16px",
                boxShadow: "0 8px 24px rgba(0, 0, 0, 0.25)",
              }}
            >
              {/* Header with Title, Source Badge, and Controls */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 12,
                  flexWrap: "wrap",
                  gap: 10,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 12.5, fontWeight: 800, color: "#ffffff", display: "flex", alignItems: "center", gap: 6 }}>
                    📅 30-Day Non-Repeating Editorial Queue
                    <span
                      style={{
                        fontSize: 10.5,
                        fontWeight: 800,
                        padding: "2px 7px",
                        borderRadius: 999,
                        background: "rgba(56, 189, 248, 0.15)",
                        color: "#38bdf8",
                        border: "1px solid rgba(56, 189, 248, 0.3)",
                      }}
                    >
                      {rawTopics.length} Topics
                    </span>
                  </span>

                  <span
                    style={{
                      fontSize: 10.5,
                      fontWeight: 700,
                      padding: "2px 8px",
                      borderRadius: 6,
                      background: brandIntel?.brandName ? "rgba(34, 197, 94, 0.12)" : "rgba(148, 163, 184, 0.12)",
                      color: brandIntel?.brandName ? "#4ade80" : "#94a3b8",
                      border: `1px solid ${brandIntel?.brandName ? "rgba(34, 197, 94, 0.25)" : "rgba(148, 163, 184, 0.2)"}`,
                    }}
                  >
                    {brandIntel?.brandName ? `✓ Crawled for ${brandIntel.brandName}` : "⚡ Master B2B Strategy Queue"}
                  </span>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  {/* Search input */}
                  <input
                    type="text"
                    placeholder="🔍 Filter..."
                    value={queueSearch}
                    onChange={(e) => setQueueSearch(e.target.value)}
                    style={{
                      padding: "4px 8px",
                      borderRadius: 6,
                      background: "rgba(0, 0, 0, 0.35)",
                      border: "1px solid rgba(255, 255, 255, 0.1)",
                      color: "#fff",
                      fontSize: 11,
                      width: 90,
                    }}
                  />

                  {/* Filter tabs */}
                  <div style={{ display: "flex", gap: 4 }}>
                    {["all", "queued", "published"].map((tab) => (
                      <button
                        key={tab}
                        type="button"
                        onClick={() => setTopicsFilter(tab)}
                        style={{
                          padding: "3px 8px",
                          borderRadius: 6,
                          border: "none",
                          background: topicsFilter === tab ? "#0a66c2" : "rgba(255,255,255,0.06)",
                          color: topicsFilter === tab ? "#fff" : "#94a3b8",
                          fontSize: 10.5,
                          fontWeight: 700,
                          cursor: "pointer",
                          textTransform: "capitalize",
                        }}
                      >
                        {tab}
                      </button>
                    ))}
                  </div>

                  {/* View Mode Toggle */}
                  <div style={{ display: "flex", gap: 2, background: "rgba(0,0,0,0.3)", borderRadius: 6, padding: 2 }}>
                    <button
                      type="button"
                      onClick={() => setQueueViewMode("cards")}
                      style={{
                        padding: "3px 7px",
                        borderRadius: 4,
                        border: "none",
                        background: queueViewMode === "cards" ? "rgba(56, 189, 248, 0.2)" : "transparent",
                        color: queueViewMode === "cards" ? "#38bdf8" : "#64748b",
                        fontSize: 10,
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                      title="Detailed Cards"
                    >
                      Cards
                    </button>
                    <button
                      type="button"
                      onClick={() => setQueueViewMode("chips")}
                      style={{
                        padding: "3px 7px",
                        borderRadius: 4,
                        border: "none",
                        background: queueViewMode === "chips" ? "rgba(56, 189, 248, 0.2)" : "transparent",
                        color: queueViewMode === "chips" ? "#38bdf8" : "#64748b",
                        fontSize: 10,
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                      title="Compact Chips"
                    >
                      Chips
                    </button>
                  </div>
                </div>
              </div>

              {/* View Mode: Chips */}
              {queueViewMode === "chips" && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, maxHeight: 180, overflowY: "auto", paddingRight: 4 }}>
                  {filteredTopics.map((item) => {
                    const isSelected = postTopic === item.topic || selectedTopicId === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleUseTopic(item)}
                        style={{
                          padding: "5px 10px",
                          borderRadius: 8,
                          background: isSelected ? "rgba(14, 165, 233, 0.25)" : "rgba(255, 255, 255, 0.04)",
                          border: `1px solid ${isSelected ? "#38bdf8" : "rgba(255, 255, 255, 0.08)"}`,
                          color: isSelected ? "#38bdf8" : "#cbd5e1",
                          fontSize: 11,
                          fontWeight: isSelected ? 800 : 600,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          textAlign: "left",
                          transition: "all 0.15s ease",
                        }}
                      >
                        <span style={{ fontSize: 9.5, opacity: 0.7, padding: "1px 4px", borderRadius: 4, background: "rgba(0,0,0,0.3)" }}>
                          Day {item.scheduledDay}
                        </span>
                        <span>{item.topic}</span>
                        {isSelected && <span style={{ color: "#38bdf8" }}>✓</span>}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* View Mode: Cards */}
              {queueViewMode === "cards" && (
                <div
                  style={{
                    maxHeight: 230,
                    overflowY: "auto",
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                    paddingRight: 4,
                  }}
                >
                  {filteredTopics.map((item) => {
                    const isSelected = postTopic === item.topic || selectedTopicId === item.id;
                    const pillarIcon =
                      item.pillar === "thought_leadership" ? "💡" :
                      item.pillar === "actionable_playbook" ? "🛠️" :
                      item.pillar === "case_study_win" ? "📈" :
                      item.pillar === "myth_busting" ? "⚡" :
                      item.pillar === "service_spotlight" ? "🔍" : "💬";

                    return (
                      <div
                        key={item.id}
                        onClick={() => handleUseTopic(item)}
                        style={{
                          padding: "9px 12px",
                          borderRadius: 10,
                          background: isSelected
                            ? "linear-gradient(135deg, rgba(14, 165, 233, 0.18) 0%, rgba(2, 132, 199, 0.08) 100%)"
                            : item.status === "next"
                            ? "rgba(56, 189, 248, 0.06)"
                            : "rgba(255, 255, 255, 0.02)",
                          border: `1px solid ${
                            isSelected
                              ? "#38bdf8"
                              : item.status === "next"
                              ? "rgba(56, 189, 248, 0.25)"
                              : "rgba(255, 255, 255, 0.06)"
                          }`,
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: 10,
                          cursor: "pointer",
                          transition: "all 0.15s ease",
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3, flexWrap: "wrap" }}>
                            <span
                              style={{
                                fontSize: 9.5,
                                fontWeight: 800,
                                padding: "1px 5px",
                                borderRadius: 4,
                                background: "rgba(255,255,255,0.08)",
                                color: "#e2e8f0",
                              }}
                            >
                              Day {item.scheduledDay}
                            </span>
                            <span style={{ fontSize: 10.5, fontWeight: 700, color: "#38bdf8" }}>
                              {pillarIcon} {item.targetService || "B2B Insight"}
                            </span>
                            <span
                              style={{
                                fontSize: 9,
                                padding: "1px 5px",
                                borderRadius: 4,
                                background:
                                  item.status === "published"
                                    ? "rgba(34,197,94,0.15)"
                                    : item.status === "next"
                                    ? "rgba(56,189,248,0.2)"
                                    : "rgba(148,163,184,0.1)",
                                color:
                                  item.status === "published"
                                    ? "#4ade80"
                                    : item.status === "next"
                                    ? "#38bdf8"
                                    : "#94a3b8",
                                fontWeight: 800,
                              }}
                            >
                              {item.status === "published" ? "PUBLISHED" : item.status === "next" ? "NEXT UP" : "QUEUED"}
                            </span>
                          </div>

                          <div
                            style={{
                              fontSize: 12,
                              fontWeight: 700,
                              color: isSelected ? "#38bdf8" : "#ffffff",
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {item.topic}
                          </div>

                          {item.hook && (
                            <div
                              style={{
                                fontSize: 11,
                                color: "#94a3b8",
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                marginTop: 1,
                              }}
                            >
                              Hook: "{item.hook}"
                            </div>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleUseTopic(item);
                          }}
                          style={{
                            padding: "5px 10px",
                            borderRadius: 6,
                            background: isSelected ? "#0a66c2" : "rgba(56, 189, 248, 0.12)",
                            border: `1px solid ${isSelected ? "#38bdf8" : "rgba(56, 189, 248, 0.25)"}`,
                            color: isSelected ? "#ffffff" : "#38bdf8",
                            fontSize: 10.5,
                            fontWeight: 700,
                            cursor: "pointer",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {isSelected ? "✓ Selected" : "⚡ Use Topic"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Bottom Quick Action Bar */}
              <div
                style={{
                  marginTop: 10,
                  paddingTop: 8,
                  borderTop: "1px solid rgba(255, 255, 255, 0.06)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: 8,
                }}
              >
                <div style={{ fontSize: 10.5, color: "#64748b" }}>
                  💡 Click any topic above to load it directly into the input & commentary draft.
                </div>
                {!brandIntel?.brandName && (
                  <button
                    type="button"
                    onClick={() => {
                      const el = document.getElementById("brand-crawler-section");
                      if (el) el.scrollIntoView({ behavior: "smooth" });
                    }}
                    style={{
                      background: "none",
                      border: "none",
                      color: "#38bdf8",
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: "pointer",
                      padding: 0,
                      textDecoration: "underline",
                    }}
                  >
                    🌐 Want custom topics tailored to your exact website? Crawl brand website ➔
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Commentary Area */}
          <div>
            <label style={{ fontSize: 11.5, color: "#94a3b8", fontWeight: 700, display: "block", marginBottom: 6 }}>
              3. Review Post Copy & Hashtags:
            </label>
            <textarea
              rows={6}
              placeholder="Your generated LinkedIn post commentary, hook, bullet points, and hashtags will appear here..."
              value={commentary}
              onChange={(e) => setCommentary(e.target.value)}
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: "12px 14px",
                borderRadius: 12,
                background: "rgba(0,0,0,0.35)",
                border: "1px solid rgba(255, 255, 255, 0.12)",
                color: "#fff",
                fontSize: 13.5,
                lineHeight: 1.6,
                resize: "vertical",
                fontFamily: "inherit",
              }}
            />
          </div>

          {/* ── FORMAT-SPECIFIC MEDIA ATTACHMENTS ── */}
          {postFormat === "image" && (
            <div
              style={{
                padding: "14px 16px",
                borderRadius: 14,
                background: "rgba(0, 0, 0, 0.25)",
                border: "1px solid rgba(255, 255, 255, 0.08)",
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#cbd5e1" }}>
                  🖼️ Single Image Creative
                </span>
                <button
                  onClick={handleGenerateAiImage}
                  disabled={generatingImage}
                  style={{
                    padding: "7px 14px",
                    borderRadius: 8,
                    background: "linear-gradient(135deg, #a855f7 0%, #6366f1 100%)",
                    border: "none",
                    color: "#fff",
                    fontSize: 11.5,
                    fontWeight: 700,
                    cursor: "pointer",
                    boxShadow: "0 2px 10px rgba(168, 85, 247, 0.3)",
                  }}
                >
                  <span>{generatingImage ? "Generating Visual…" : "✨ AI Generate Visual Creative"}</span>
                </button>
              </div>

              {imageUrl ? (
                <div style={{ display: "flex", alignItems: "center", gap: 12, background: "rgba(255,255,255,0.03)", padding: 8, borderRadius: 10, border: "1px solid rgba(255,255,255,0.08)" }}>
                  <img src={imageUrl} alt="Thumbnail" style={{ width: 44, height: 44, borderRadius: 8, objectFit: "cover" }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, color: "#4ade80", fontWeight: 700 }}>Visual Attached</div>
                    <div style={{ fontSize: 11, color: "#94a3b8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{imageUrl}</div>
                  </div>
                  <button
                    onClick={() => setImageUrl("")}
                    style={{ background: "none", border: "none", color: "#f87171", cursor: "pointer", fontSize: 12, fontWeight: 700 }}
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <input
                  type="text"
                  placeholder="Or paste custom image URL (https://...)..."
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    padding: "9px 12px",
                    borderRadius: 8,
                    background: "rgba(0,0,0,0.3)",
                    border: "1px solid rgba(255, 255, 255, 0.1)",
                    color: "#fff",
                    fontSize: 12,
                  }}
                />
              )}
            </div>
          )}

          {postFormat === "carousel" && (
            <div
              style={{
                padding: "14px 16px",
                borderRadius: 14,
                background: "rgba(0, 0, 0, 0.25)",
                border: "1px solid rgba(56, 189, 248, 0.2)",
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#38bdf8" }}>
                  📑 Multi-Slide Carousel Deck ({carouselUrls.length} slides)
                </span>
                <button
                  onClick={handleGenerateAiCarousel}
                  disabled={generatingCarousel}
                  style={{
                    padding: "7px 14px",
                    borderRadius: 8,
                    background: "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)",
                    border: "none",
                    color: "#fff",
                    fontSize: 11.5,
                    fontWeight: 700,
                    cursor: "pointer",
                    boxShadow: "0 2px 10px rgba(2, 132, 199, 0.3)",
                  }}
                >
                  <span>{generatingCarousel ? "Generating 3-Slide Deck…" : "✨ AI Generate 3-Slide Carousel"}</span>
                </button>
              </div>

              {carouselUrls.length > 0 ? (
                <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 6 }}>
                  {carouselUrls.map((sUrl, sIdx) => (
                    <div key={sIdx} style={{ position: "relative", flexShrink: 0, width: 64, height: 64, borderRadius: 8, overflow: "hidden", border: activeSlideIndex === sIdx ? "2px solid #38bdf8" : "1px solid rgba(255,255,255,0.15)", cursor: "pointer" }} onClick={() => setActiveSlideIndex(sIdx)}>
                      <img src={sUrl} alt={`Slide ${sIdx + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      <div style={{ position: "absolute", bottom: 2, left: 3, fontSize: 9, background: "rgba(0,0,0,0.7)", color: "#fff", padding: "1px 4px", borderRadius: 4 }}>
                        #{sIdx + 1}
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const updated = carouselUrls.filter((_, idx) => idx !== sIdx);
                          setCarouselUrls(updated);
                          if (activeSlideIndex >= updated.length) setActiveSlideIndex(Math.max(0, updated.length - 1));
                        }}
                        style={{ position: "absolute", top: 2, right: 2, background: "rgba(239,68,68,0.85)", border: "none", color: "#fff", borderRadius: "50%", width: 16, height: 16, fontSize: 10, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}

              <div style={{ display: "flex", gap: 8 }}>
                <input
                  type="text"
                  placeholder="Paste slide image URL (https://...)..."
                  value={newSlideInput}
                  onChange={(e) => setNewSlideInput(e.target.value)}
                  style={{
                    flex: 1,
                    padding: "9px 12px",
                    borderRadius: 8,
                    background: "rgba(0,0,0,0.3)",
                    border: "1px solid rgba(255, 255, 255, 0.1)",
                    color: "#fff",
                    fontSize: 12,
                  }}
                />
                <button
                  type="button"
                  onClick={() => {
                    if (newSlideInput.trim()) {
                      setCarouselUrls([...carouselUrls, newSlideInput.trim()]);
                      setNewSlideInput("");
                    }
                  }}
                  style={{ padding: "8px 14px", borderRadius: 8, background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                >
                  + Add Slide
                </button>
              </div>

              <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 8 }}>
                <input
                  type="text"
                  placeholder="Or paste direct multi-page PDF document URL (https://...)..."
                  value={documentUrl}
                  onChange={(e) => setDocumentUrl(e.target.value)}
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    padding: "8px 12px",
                    borderRadius: 8,
                    background: "rgba(0,0,0,0.2)",
                    border: "1px solid rgba(255, 255, 255, 0.08)",
                    color: "#94a3b8",
                    fontSize: 11.5,
                  }}
                />
              </div>
            </div>
          )}

          {postFormat === "video" && (
            <div
              style={{
                padding: "14px 16px",
                borderRadius: 14,
                background: "rgba(0, 0, 0, 0.25)",
                border: "1px solid rgba(168, 85, 247, 0.25)",
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#c084fc" }}>
                  🎥 Native Video Reel (MP4 / MOV)
                </span>
                <span style={{ fontSize: 11, color: "#94a3b8" }}>
                  Autoplays natively in LinkedIn feed
                </span>
              </div>

              {videoUrl ? (
                <div style={{ display: "flex", alignItems: "center", gap: 12, background: "rgba(255,255,255,0.03)", padding: 8, borderRadius: 10, border: "1px solid rgba(255,255,255,0.08)" }}>
                  <div style={{ width: 44, height: 44, borderRadius: 8, background: "#000", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>
                    🎬
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, color: "#c084fc", fontWeight: 700 }}>Video Attached</div>
                    <div style={{ fontSize: 11, color: "#94a3b8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{videoUrl}</div>
                  </div>
                  <button
                    onClick={() => setVideoUrl("")}
                    style={{ background: "none", border: "none", color: "#f87171", cursor: "pointer", fontSize: 12, fontWeight: 700 }}
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <input
                  type="text"
                  placeholder="Paste direct Video Reel MP4 URL (from Reels Studio or CDN)..."
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    padding: "9px 12px",
                    borderRadius: 8,
                    background: "rgba(0,0,0,0.3)",
                    border: "1px solid rgba(255, 255, 255, 0.1)",
                    color: "#fff",
                    fontSize: 12,
                  }}
                />
              )}
            </div>
          )}

          {/* Publish Action Button */}
          <button
            onClick={handlePublishPost}
            disabled={publishing || !commentary.trim()}
            style={{
              width: "100%",
              padding: "13px 20px",
              borderRadius: 12,
              background: commentary.trim() ? "#0a66c2" : "rgba(10, 102, 194, 0.4)",
              border: "none",
              color: "#ffffff",
              fontWeight: 800,
              fontSize: 14,
              cursor: commentary.trim() && !publishing ? "pointer" : "not-allowed",
              boxShadow: commentary.trim() ? "0 4px 18px rgba(10, 102, 194, 0.4)" : "none",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
            }}
          >
            {publishing ? (
              <span>Publishing to LinkedIn…</span>
            ) : (
              <>
                <span>🚀 Publish to LinkedIn Now</span>
                <span>↗</span>
              </>
            )}
          </button>
        </div>

        {/* Column 2: Live LinkedIn Feed Preview */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <span style={{ fontSize: 12, fontWeight: 800, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "1px" }}>
            Feed Simulation Preview
          </span>

          {/* LinkedIn Simulated Post Card */}
          <div
            style={{
              borderRadius: 16,
              background: "#1b2230",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              overflow: "hidden",
              boxShadow: "0 10px 30px rgba(0,0,0,0.4)",
            }}
          >
            {/* Header */}
            <div style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: 12, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: selectedAuthorUrn?.startsWith("urn:li:organization:") ? 8 : "50%",
                  background: "#0a66c2",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#fff",
                  fontWeight: 800,
                  fontSize: 16,
                  overflow: "hidden",
                }}
              >
                {!selectedAuthorUrn?.startsWith("urn:li:organization:") && member?.picture ? (
                  <img src={member.picture} alt={member.name || "Author"} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  selectedAuthorUrn?.startsWith("urn:li:organization:") ? "🏢" : "IN"
                )}
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#ffffff" }}>
                  {activeAuthorName}
                </div>
                <div style={{ fontSize: 11, color: "#94a3b8" }}>
                  {selectedAuthorUrn?.startsWith("urn:li:organization:") ? "Company Page" : "Thought Leader"} • Just now • 🌐 Public
                </div>
              </div>
            </div>

            {/* Body */}
            <div style={{ padding: "16px 18px", fontSize: 13.5, color: "#e2e8f0", lineHeight: 1.6, whiteSpace: "pre-wrap", minHeight: 90 }}>
              {commentary.trim() || (
                <span style={{ color: "#64748b", fontStyle: "italic" }}>
                  Your LinkedIn post content will appear here in real time as you write or generate it with AI...
                </span>
              )}
            </div>

            {/* Media Previews */}
            {postFormat === "image" && imageUrl.trim() && (
              <div style={{ width: "100%", maxHeight: 320, overflow: "hidden", background: "#000", display: "flex", justifyContent: "center" }}>
                <img
                  src={imageUrl.trim()}
                  alt="Creative Preview"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                  style={{ width: "100%", maxHeight: 320, objectFit: "cover" }}
                />
              </div>
            )}

            {postFormat === "video" && videoUrl.trim() && (
              <div style={{ width: "100%", maxHeight: 320, background: "#000" }}>
                <video
                  src={videoUrl.trim()}
                  controls
                  style={{ width: "100%", maxHeight: 320, background: "#000" }}
                />
              </div>
            )}

            {postFormat === "carousel" && carouselUrls.length > 0 && (
              <div style={{ position: "relative", width: "100%", background: "#0f172a", borderTop: "1px solid rgba(255,255,255,0.08)", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: 220, maxHeight: 320, overflow: "hidden" }}>
                  <img
                    src={carouselUrls[activeSlideIndex] || carouselUrls[0]}
                    alt={`Slide ${activeSlideIndex + 1}`}
                    style={{ maxHeight: 320, width: "100%", objectFit: "contain" }}
                  />
                </div>
                {/* Carousel Controls */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 14px", background: "rgba(0,0,0,0.6)" }}>
                  <button
                    type="button"
                    onClick={() => setActiveSlideIndex((prev) => Math.max(0, prev - 1))}
                    disabled={activeSlideIndex === 0}
                    style={{ padding: "4px 10px", borderRadius: 6, background: "rgba(255,255,255,0.15)", border: "none", color: "#fff", fontSize: 11, cursor: activeSlideIndex === 0 ? "not-allowed" : "pointer" }}
                  >
                    ◀ Prev
                  </button>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#38bdf8" }}>
                    Slide {activeSlideIndex + 1} of {carouselUrls.length}
                  </span>
                  <button
                    type="button"
                    onClick={() => setActiveSlideIndex((prev) => Math.min(carouselUrls.length - 1, prev + 1))}
                    disabled={activeSlideIndex === carouselUrls.length - 1}
                    style={{ padding: "4px 10px", borderRadius: 6, background: "rgba(255,255,255,0.15)", border: "none", color: "#fff", fontSize: 11, cursor: activeSlideIndex === carouselUrls.length - 1 ? "not-allowed" : "pointer" }}
                  >
                    Next ▶
                  </button>
                </div>
              </div>
            )}

            {postFormat === "carousel" && carouselUrls.length === 0 && documentUrl.trim() && (
              <div style={{ padding: "16px 20px", background: "rgba(56, 189, 248, 0.08)", borderTop: "1px solid rgba(56, 189, 248, 0.2)", display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 24 }}>📑</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: "#38bdf8" }}>Interactive Document Carousel Deck Attached</div>
                  <div style={{ fontSize: 11, color: "#94a3b8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{documentUrl}</div>
                </div>
              </div>
            )}

            {/* Footer Engagement Bar */}
            <div
              style={{
                padding: "10px 18px",
                display: "flex",
                justifyContent: "space-around",
                borderTop: "1px solid rgba(255, 255, 255, 0.08)",
                fontSize: 12,
                color: "#94a3b8",
                fontWeight: 600,
              }}
            >
              <span>👍 Like</span>
              <span>💬 Comment</span>
              <span>🔁 Repost</span>
              <span>📤 Send</span>
            </div>
          </div>

          {/* Quick Tips */}
          <div
            style={{
              padding: "14px 18px",
              borderRadius: 14,
              background: "rgba(10, 102, 194, 0.08)",
              border: "1px solid rgba(10, 102, 194, 0.2)",
              fontSize: 12,
              color: "#93c5fd",
              lineHeight: 1.6,
            }}
          >
            <strong>💡 Zero Repetition Guarantee:</strong> GabbarInfo AI rotates through 30 unique editorial angles tailored to your crawled services. When all 30 are used, it automatically formulates a fresh seasonal cycle!
          </div>
        </div>
      </div>

      {/* ── AUTONOMOUS LINKEDIN AUTO-PILOT SCHEDULER ── */}
      <div
        style={{
          padding: "26px 28px",
          borderRadius: 20,
          background: "linear-gradient(180deg, rgba(16, 24, 38, 0.85) 0%, rgba(10, 15, 26, 0.95) 100%)",
          border: "1px solid rgba(168, 85, 247, 0.25)",
          boxShadow: "0 20px 50px rgba(0,0,0,0.5), 0 0 25px rgba(168, 85, 247, 0.06)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: "rgba(168, 85, 247, 0.18)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, border: "1px solid rgba(168, 85, 247, 0.35)" }}>
              🤖
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#ffffff" }}>
                Autonomous LinkedIn Auto-Pilot Engine
              </h3>
              <p style={{ margin: "2px 0 0", fontSize: 12.5, color: "#94a3b8" }}>
                Executes non-repeating B2B topics sequentially from your editorial queue, generating AI visual creatives and broadcasting to your selected LinkedIn destination.
              </p>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button
              onClick={handleRunAutopilotCycle}
              disabled={runningAutopilot || !status === "connected"}
              style={{
                padding: "9px 18px",
                borderRadius: 10,
                background: "linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)",
                border: "none",
                color: "#ffffff",
                fontSize: 12.5,
                fontWeight: 700,
                cursor: "pointer",
                boxShadow: "0 4px 14px rgba(168, 85, 247, 0.35)",
              }}
            >
              {runningAutopilot ? "Executing Auto-Pilot Cycle…" : "⚡ Run Auto-Pilot Cycle Now (Test)"}
            </button>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16, marginBottom: 20 }}>
          {/* Autopilot Enabled Switch */}
          <div style={{ padding: "14px 16px", borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 700, textTransform: "uppercase", marginBottom: 6 }}>
              Auto-Pilot Status
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={autopilotConfig.enabled}
                onChange={(e) => setAutopilotConfig({ ...autopilotConfig, enabled: e.target.checked })}
                style={{ width: 18, height: 18, cursor: "pointer", accentColor: "#a855f7" }}
              />
              <span style={{ fontSize: 13, fontWeight: 700, color: autopilotConfig.enabled ? "#4ade80" : "#94a3b8" }}>
                {autopilotConfig.enabled ? "Active Autonomous Publishing" : "Disabled (Manual Only)"}
              </span>
            </label>
          </div>

          {/* Frequency */}
          <div style={{ padding: "14px 16px", borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 700, textTransform: "uppercase", marginBottom: 6 }}>
              Publishing Cadence
            </div>
            <select
              value={autopilotConfig.frequency}
              onChange={(e) => setAutopilotConfig({ ...autopilotConfig, frequency: e.target.value })}
              style={{
                width: "100%",
                padding: "8px 10px",
                borderRadius: 8,
                background: "#0b1220",
                border: "1px solid rgba(255, 255, 255, 0.15)",
                color: "#fff",
                fontSize: 12.5,
              }}
            >
              <option value="daily">Daily Broadcast (1 Post / Day)</option>
              <option value="3_per_week">3 Times a Week (Mon, Wed, Fri)</option>
              <option value="weekly">Weekly Pulse (1 Post / Week)</option>
            </select>
          </div>

          {/* AI Creative Generation Toggle */}
          <div style={{ padding: "14px 16px", borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 700, textTransform: "uppercase", marginBottom: 6 }}>
              Visual Graphic Creation
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={autopilotConfig.generateImage}
                onChange={(e) => setAutopilotConfig({ ...autopilotConfig, generateImage: e.target.checked })}
                style={{ width: 18, height: 18, cursor: "pointer", accentColor: "#a855f7" }}
              />
              <span style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>
                Generate 1:1 AI Graphic with every post
              </span>
            </label>
          </div>
        </div>

        {/* Save button */}
        <button
          onClick={handleSaveAutopilot}
          disabled={savingAutopilot}
          style={{
            padding: "11px 24px",
            borderRadius: 10,
            background: "#2563eb",
            border: "none",
            color: "#ffffff",
            fontSize: 13,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          {savingAutopilot ? "Saving Settings…" : "💾 Save Auto-Pilot Schedule"}
        </button>
      </div>
    </div>
  );
}
