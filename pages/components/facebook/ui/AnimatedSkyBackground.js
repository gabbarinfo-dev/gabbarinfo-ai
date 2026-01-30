export default function AnimatedSkyBackground({ children }) {
  return (
    <div className="sky-root">
      {/* Dawn gradient */}
      <div className="sky-gradient" />

      {/* Sun glow */}
      <div className="sun-glow" />

      {/* Snow / particles */}
      <div className="snow slow" />
      <div className="snow medium" />
      <div className="snow fast" />

      {/* Content */}
      <div className="sky-content">{children}</div>

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
            180deg,
            #0b1026 0%,
            #1b2a4e 35%,
            #4b3f72 60%,
            #ffcf9f 100%
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

    </div>
  );
}
