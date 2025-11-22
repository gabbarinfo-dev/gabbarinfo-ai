// pages/index.js
import { useSession } from "next-auth/react";
import { useEffect } from "react";
import { useRouter } from "next/router";

export default function Home() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    // If logged in, go to chat. If not, go to sign-in.
    if (status === "authenticated") {
      router.replace("/chat");
    } else if (status === "unauthenticated") {
      router.replace("/auth/signin");
    }
  }, [status, router]);

  return (
    <div style={{ padding: 40, fontFamily: "Arial, sans-serif" }}>
      <h2>Loading...</h2>
      <p>If you are not redirected automatically, refresh the page.</p>
    </div>
  );
}
