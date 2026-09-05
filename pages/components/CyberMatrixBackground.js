"use client";

import { useEffect, useRef } from "react";

export default function CyberMatrixBackground({ showGeometric = true }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
      initColumns();
      polyhedra = createPolyhedra(width);
    };
    window.addEventListener("resize", handleResize);

    // Matrix Falling Code Streams
    const chars = "010101アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲンABCDEF<>{}/*=+~#$";
    const fontSize = 14;
    let columns = Math.floor(width / fontSize);
    let drops = [];

    function initColumns() {
      columns = Math.floor(width / fontSize);
      drops = [];
      for (let i = 0; i < columns; i++) {
        drops[i] = {
          y: Math.random() * -100,
          speed: 0.8 + Math.random() * 1.6,
          length: 12 + Math.floor(Math.random() * 18),
          brightness: 0.3 + Math.random() * 0.7,
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

        this.vertices = [];
        this.edges = [];
        this.initGeometry();
      }

      initGeometry() {
        if (this.type === "octahedron") {
          this.vertices = [
            [1, 0, 0], [-1, 0, 0], [0, 1, 0],
            [0, -1, 0], [0, 0, 1], [0, 0, -1]
          ];
          this.edges = [
            [0, 2], [2, 1], [1, 3], [3, 0],
            [0, 4], [2, 4], [1, 4], [3, 4],
            [0, 5], [2, 5], [1, 5], [3, 5]
          ];
        } else if (this.type === "cube") {
          this.vertices = [
            [-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1],
            [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]
          ];
          this.edges = [
            [0, 1], [1, 2], [2, 3], [3, 0],
            [4, 5], [5, 6], [6, 7], [7, 4],
            [0, 4], [1, 5], [2, 6], [3, 7]
          ];
        } else {
          // Icosahedron approximation
          const t = (1.0 + Math.sqrt(5.0)) / 2.0;
          this.vertices = [
            [-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0],
            [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t],
            [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]
          ];
          this.edges = [
            [0, 11], [0, 5], [0, 1], [0, 7], [0, 10],
            [1, 5], [5, 11], [11, 10], [10, 7], [7, 1],
            [3, 9], [3, 4], [3, 2], [3, 6], [3, 8],
            [4, 9], [2, 4], [6, 2], [8, 6], [9, 8],
            [4, 5], [9, 1], [8, 7], [6, 10], [2, 11]
          ];
        }
      }

      update() {
        this.rotX += this.speedX;
        this.rotY += this.speedY;
        this.rotZ += this.speedZ;
      }

      draw(ctx, width, height) {
        const cx = width * this.x;
        const cy = height * this.y;
        const fov = 400;

        const rotated = this.vertices.map(([vx, vy, vz]) => {
          // Rotate around X
          let y1 = vy * Math.cos(this.rotX) - vz * Math.sin(this.rotX);
          let z1 = vy * Math.sin(this.rotX) + vz * Math.cos(this.rotX);
          // Rotate around Y
          let x2 = vx * Math.cos(this.rotY) + z1 * Math.sin(this.rotY);
          let z2 = -vx * Math.sin(this.rotY) + z1 * Math.cos(this.rotY);
          // Rotate around Z
          let x3 = x2 * Math.cos(this.rotZ) - y1 * Math.sin(this.rotZ);
          let y3 = x2 * Math.sin(this.rotZ) + y1 * Math.cos(this.rotZ);

          const scale = (fov / (fov + z2 + this.z)) * this.size;
          return {
            x: cx + x3 * scale,
            y: cy + y3 * scale,
            scale,
          };
        });

        // Draw edges with glowing gradient (slightly darker)
        ctx.strokeStyle = "rgba(56, 189, 248, 0.16)";
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        for (const [i1, i2] of this.edges) {
          if (rotated[i1] && rotated[i2]) {
            ctx.moveTo(rotated[i1].x, rotated[i1].y);
            ctx.lineTo(rotated[i2].x, rotated[i2].y);
          }
        }
        ctx.stroke();

        // Draw glowing nodes (slightly darker)
        for (const node of rotated) {
          ctx.fillStyle = "rgba(16, 185, 129, 0.32)";
          ctx.beginPath();
          ctx.arc(node.x, node.y, 2.2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    function createPolyhedra(w) {
      const isMobile = w < 768;
      if (isMobile) {
        return [
          new GeometricPolyhedron(0.12, 0.10, 100, 48, "icosahedron"),
          new GeometricPolyhedron(0.86, 0.10, 80, 52, "cube"),
          new GeometricPolyhedron(0.14, 0.90, 120, 46, "octahedron"),
          new GeometricPolyhedron(0.86, 0.90, 90, 48, "icosahedron"),
        ];
      }
      return [
        new GeometricPolyhedron(0.18, 0.35, 100, 75, "icosahedron"),
        new GeometricPolyhedron(0.82, 0.28, 80, 85, "cube"),
        new GeometricPolyhedron(0.85, 0.72, 120, 65, "octahedron"),
        new GeometricPolyhedron(0.14, 0.78, 90, 70, "icosahedron"),
      ];
    }

    let polyhedra = createPolyhedra(width);

    let frame = 0;
    const render = () => {
      frame++;
      // Deep space clear with translucent trails
      ctx.fillStyle = "rgba(8, 11, 17, 0.25)";
      ctx.fillRect(0, 0, width, height);

      // Render Matrix Falling Code Stream (softer, darker tones)
      ctx.font = `${fontSize}px monospace`;
      for (let i = 0; i < drops.length; i += 2) {
        // Draw every 2nd column for clean density
        const drop = drops[i];
        const x = i * fontSize;
        const char = chars[Math.floor(Math.random() * chars.length)];

        // Glowing white/cyan head (softened from 0.85 to 0.55)
        ctx.fillStyle = "rgba(220, 240, 255, 0.55)";
        ctx.fillText(char, x, drop.y);

        // Fading green/cyan body trail (softened from 0.28 to 0.18)
        for (let j = 1; j < 6; j++) {
          const trailY = drop.y - j * fontSize;
          if (trailY > 0) {
            const alpha = (1 - j / 6) * 0.18 * drop.brightness;
            ctx.fillStyle = `rgba(56, 189, 248, ${alpha})`;
            const trailChar = chars[Math.floor(Math.random() * chars.length)];
            ctx.fillText(trailChar, x, trailY);
          }
        }

        drop.y += fontSize * drop.speed;
        if (drop.y > height + 50) {
          drop.y = Math.random() * -60;
          drop.speed = 0.8 + Math.random() * 1.6;
        }
      }

      // Render 3D Rotating Geometric Wireframes
      if (showGeometric) {
        for (const poly of polyhedra) {
          poly.update();
          poly.draw(ctx, width, height);
        }
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", handleResize);
    };
  }, [showGeometric]);

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        pointerEvents: "none",
        zIndex: 0,
      }}
    >
      {/* High-Performance Canvas Animation */}
      <canvas
        ref={canvasRef}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          display: "block",
          opacity: 0.75,
        }}
      />

      {/* Cybernetic Ambient Light Beams & Vignette Overlays */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: "50%",
          transform: "translateX(-50%)",
          width: "100%",
          maxWidth: 1100,
          height: 600,
          background: "radial-gradient(ellipse 70% 60% at 50% 0%, rgba(59, 130, 246, 0.18) 0%, rgba(16, 185, 129, 0.06) 40%, transparent 75%)",
          pointerEvents: "none",
        }}
      />

      {/* Central Card Contrast Mask - Softened so animations are visible through cards */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "radial-gradient(ellipse at 50% 50%, rgba(8, 11, 17, 0.20) 0%, rgba(8, 11, 17, 0.82) 85%)",
          pointerEvents: "none",
        }}
      />
    </div>
  );
}
