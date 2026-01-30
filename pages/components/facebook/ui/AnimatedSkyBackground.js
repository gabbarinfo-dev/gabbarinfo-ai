  import { useEffect } from "react";
export default function AnimatedSkyBackground({ children }) {
useEffect(() => {
  const flash = document.createElement("div");
  flash.className = "lightning-flash";
  document.body.appendChild(flash);

  setTimeout(() => flash.remove(), 300);
}, []);

  return (
    <div className="sky-root">
      {/* Dawn gradient */}
      <div className="sky-gradient" />

      {/* Sun glow */}

      {/* Snow / particles */}
      <div className="snow slow" />
      <div className="snow medium" />
      <div className="snow fast" />

      {/* Content */}
    <div className="snow-layer" />
<style jsx global>{`
  .snow-layer {
    position: absolute;
    inset: 0;
    background-image:
      radial-gradient(2px 2px at 20% 30%, rgba(255,255,255,.8) 50%, transparent 51%),
      radial-gradient(1.5px 1.5px at 60% 10%, rgba(255,255,255,.6) 50%, transparent 51%),
      radial-gradient(1px 1px at 80% 50%, rgba(255,255,255,.5) 50%, transparent 51%);
    background-size: 300px 300px;
    animation: snowDrift 60s linear infinite;
    pointer-events: none;
  }

  @keyframes snowDrift {
    from {
      transform: translateY(-100px);
    }
    to {
      transform: translateY(100px);
    }
  }
`}</style>

      <div className="sky-content">
  <div className="ai-glow">
    {children}
  </div>
</div>

      <style jsx>{`
        .sky-root {
          position: relative;
          min-height: 100vh;
          overflow: hidden;
          background: #0b1026;
        }

        /* 🌈 Magical Dawn Gradient */
        .sky-gradient {
          position: absolute;
          inset: 0;
        background: linear-gradient(
    to bottom,
    #030617 0%,     /* deep night */
    #070c26 35%,    /* dark indigo */
    #101a3f 60%,    /* calm blue */
    #2a244a 80%,    /* subtle dawn violet */
    #3a2a2a 100%    /* faint warm horizon */
  );
          animation: hueShift 30s ease-in-out infinite alternate;
        }

        @keyframes hueShift {
          from {
            filter: hue-rotate(0deg);
          }
          to {
            filter: hue-rotate(8deg);
          }
        }

        /* ☀️ Dreamy Sun Glow */
        .sun-glow {
          position: absolute;
          top: -25%;
          right: -15%;
          width: 700px;
          height: 700px;
          background: radial-gradient(
            circle,
            rgba(255, 214, 170, 0.35),
            rgba(255, 214, 170, 0.15),
            transparent 70%
          );
          filter: blur(10px);
        }

        /* ❄️ Snow Particles */
        .snow {
          position: absolute;
          inset: 0;
          background-repeat: repeat;
          pointer-events: none;
        }

        .snow.slow {
          background-image: radial-gradient(2px 2px at 20px 30px, white, transparent),
            radial-gradient(2px 2px at 200px 150px, white, transparent),
            radial-gradient(1px 1px at 400px 80px, white, transparent);
          animation: snowDrift 60s linear infinite;
          opacity: 0.15;
        }

        .snow.medium {
          background-image: radial-gradient(2px 2px at 50px 100px, white, transparent),
            radial-gradient(1px 1px at 300px 200px, white, transparent),
            radial-gradient(2px 2px at 500px 50px, white, transparent);
          animation: snowDrift 40s linear infinite;
          opacity: 0.25;
        }

        .snow.fast {
          background-image: radial-gradient(1px 1px at 100px 50px, white, transparent),
            radial-gradient(2px 2px at 350px 120px, white, transparent),
            radial-gradient(1px 1px at 600px 200px, white, transparent);
          animation: snowDrift 25s linear infinite;
          opacity: 0.35;
        }

        @keyframes snowDrift {
          from {
            transform: translateY(-100px);
          }
          to {
            transform: translateY(100vh);
          }
        }

        /* Content layer */
        .sky-content {
          position: relative;
          z-index: 5;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
        }

        /* Accessibility */
        @media (prefers-reduced-motion: reduce) {
          .snow,
          .sky-gradient {
            animation: none;
          }
        }
      `}</style>
  background: `
  radial-gradient(
    1200px 600px at 50% 80%,
    rgba(255, 200, 150, 0.25),
    transparent 60%
  ),
  linear-gradient(
    180deg,
    #0b163f 0%,
    #2b2d6b 40%,
    #6b4e71 70%,
    #f2c49b 100%
  )
`,
animation: "dawnShift 40s ease-in-out infinite alternate",
    <style jsx global>{`
  @keyframes dawnShift {
    0% {
      filter: hue-rotate(0deg) brightness(1);
    }
    100% {
      filter: hue-rotate(8deg) brightness(1.05);
    }
  }
`}</style>
<style jsx global>{`
  .ai-glow {
    animation: glowPulse 6s ease-in-out infinite;
  }

  @keyframes glowPulse {
    0%, 100% {
      filter: drop-shadow(0 0 6px rgba(255,255,255,0.15));
    }
    50% {
      filter: drop-shadow(0 0 14px rgba(255,255,255,0.3));
    }
  }
`}</style>
<style jsx global>{`
  .lightning-flash {
  position: fixed;
  inset: 0;
  background: rgba(255, 255, 255, 0.12);
  animation: flashFade 0.3s ease-out;
  pointer-events: none;
  z-index: 9999;
}

@keyframes flashFade {
  from { opacity: 1; }
  to { opacity: 0; }
}

`}</style>

    </div>
  );
}
