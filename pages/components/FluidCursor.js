"use client";

import { useEffect } from "react";

export default function FluidCursor() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Check if script is already added
    let script = document.getElementById("fluid-cursor-script");
    if (!script) {
      script = document.createElement("script");
      script.id = "fluid-cursor-script";
      script.src = "/fluid-cursor.js";
      script.async = true;
      script.onload = () => {
        if (typeof window.initFluidSimulation === "function") {
          window.initFluidSimulation();
        }
      };
      document.body.appendChild(script);
    } else {
      if (typeof window.initFluidSimulation === "function") {
        window.initFluidSimulation();
      }
    }
  }, []);

  return null;
}
