// pages/components/CursorAura.js
"use client";

import { useEffect, useState, useRef } from "react";

export default function CursorAura() {
  const [visible, setVisible] = useState(false);
  const orbRef = useRef(null);
  const pos = useRef({ x: -200, y: -200 });
  const target = useRef({ x: -200, y: -200 });
  const animationFrame = useRef(null);

  useEffect(() => {
    // Only run on desktop/pointer devices
    if (typeof window === "undefined" || window.matchMedia("(pointer: coarse)").matches) {
      return;
    }

    const handleMouseMove = (e) => {
      target.current = { x: e.clientX, y: e.clientY };
      if (!visible) setVisible(true);
    };

    const handleMouseLeave = () => {
      setVisible(false);
    };

    const handleMouseEnter = () => {
      setVisible(true);
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    document.addEventListener("mouseleave", handleMouseLeave);
    document.addEventListener("mouseenter", handleMouseEnter);

    // Smooth Lerp loop for fluid physics
    const loop = () => {
      pos.current.x += (target.current.x - pos.current.x) * 0.12;
      pos.current.y += (target.current.y - pos.current.y) * 0.12;

      if (orbRef.current) {
        orbRef.current.style.transform = `translate3d(${pos.current.x - 175}px, ${pos.current.y - 175}px, 0)`;
      }
      animationFrame.current = requestAnimationFrame(loop);
    };
    animationFrame.current = requestAnimationFrame(loop);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseleave", handleMouseLeave);
      document.removeEventListener("mouseenter", handleMouseEnter);
      if (animationFrame.current) cancelAnimationFrame(animationFrame.current);
    };
  }, [visible]);

  return (
    <div
      ref={orbRef}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: 350,
        height: 350,
        borderRadius: "50%",
        pointerEvents: "none",
        zIndex: 9999,
        opacity: visible ? 0.75 : 0,
        transition: "opacity 0.4s ease",
        mixBlendMode: "screen",
        background: `radial-gradient(circle at 35% 35%, 
          rgba(245, 183, 22, 0.45) 0%, 
          rgba(16, 185, 129, 0.35) 28%, 
          rgba(6, 182, 212, 0.25) 55%, 
          rgba(139, 92, 246, 0.15) 72%, 
          transparent 80%)`,
        filter: "blur(42px)",
        willChange: "transform",
      }}
    />
  );
}
