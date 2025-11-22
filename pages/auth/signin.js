// pages/auth/signin.js
import { signIn, useSession } from "next-auth/react";
import { useEffect } from "react";
import { useRouter } from "next/router";

export default function SignInPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  useEffect(() => {
    if (status === "authenticated") router.replace("/chat");
  }, [status, router]);

  return (
    <div style={{ padding: 40, fontFamily: "Arial, sans-serif" }}>
      <h1>Sign in to GabbarInfo AI</h1>
      <p>Sign in with Google to access the AI chat.</p>

      <button
        onClick={() => signIn("google", { callbackUrl: "/chat" })}
        style={{
          padding: "12px 18px",
          borderRadius: 8,
          border: "none",
          background: "#0ea5a1",
          color: "white",
          fontSize: 16,
          cursor: "pointer",
        }}
      >
        Continue with Google
      </button>
    </div>
  );
}
