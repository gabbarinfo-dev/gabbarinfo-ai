"use client";

import React, { useState } from "react";
import { useSession, signIn, signOut } from "next-auth/react";

export default function ChatPage() {
  const { data: session, status } = useSession();

  if (status === "loading") return <div>Loading...</div>;
  if (!session) {
    return (
      <div style={{ padding: 40 }}>
        <h2>Please sign in</h2>
        <button onClick={() => signIn("google")}>Sign in with Google</button>
      </div>
    );
  }

  return (
    <div style={{ padding: 40 }}>
      <h2>Welcome, {session.user?.name}</h2>
      <p>Chat UI placeholder — you are signed in.</p>
      <button onClick={() => signOut()}>Sign out</button>
    </div>
  );
}
