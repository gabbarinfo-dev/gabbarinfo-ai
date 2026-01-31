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
    {/* Moon */}
<div className="moon" />


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

/* 🌙 Half Moon */
/* 🌙 Half Moon */
.moon {
  position: absolute;
  top: 60px;
  right: 80px;
  width: 90px;
  height: 90px;
  border-radius: 50%;
  background: radial-gradient(
    circle at 30% 30%,
    #ffffff,
    #d9e2ff 60%,
    #b8c6ff 100%
  );
  box-shadow:
    0 0 18px rgba(180,200,255,0.35),
    0 0 40px rgba(120,160,255,0.25);
  z-index: 2;

  /* 👇 THIS IS THE KEY */
  transform: rotate(-45deg);
}

/* Moon shadow */
.moon::after {
  content: "";
  position: absolute;
  top: 0;
  left: 28px; /* moved slightly more */
  width: 90px;
  height: 90px;
  background: #060b1f;
  border-radius: 50%;
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
  background-image:
    radial-gradient(2px 2px at 20px 30px, white, transparent),
    radial-gradient(2px 2px at 120px 80px, white, transparent),
    radial-gradient(1.5px 1.5px at 240px 160px, white, transparent),
    radial-gradient(1px 1px at 360px 40px, white, transparent),
    radial-gradient(2px 2px at 480px 200px, white, transparent),
    radial-gradient(1px 1px at 600px 120px, white, transparent);
  animation: snowDrift 60s linear infinite;
  opacity: 0.18;
}


        .snow.medium {
  background-image:
    radial-gradient(2px 2px at 40px 100px, white, transparent),
    radial-gradient(1.5px 1.5px at 180px 60px, white, transparent),
    radial-gradient(2px 2px at 300px 180px, white, transparent),
    radial-gradient(1px 1px at 420px 20px, white, transparent),
    radial-gradient(1.5px 1.5px at 540px 140px, white, transparent),
    radial-gradient(2px 2px at 660px 90px, white, transparent);
  animation: snowDrift 40s linear infinite;
  opacity: 0.28;
}

        .snow.fast {
  background-image:
    radial-gradient(1px 1px at 60px 40px, white, transparent),
    radial-gradient(1.5px 1.5px at 160px 120px, white, transparent),
    radial-gradient(2px 2px at 260px 70px, white, transparent),
    radial-gradient(1px 1px at 360px 180px, white, transparent),
    radial-gradient(1.5px 1.5px at 460px 30px, white, transparent),
    radial-gradient(2px 2px at 560px 150px, white, transparent);
  animation: snowDrift 25s linear infinite;
  opacity: 0.38;
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
