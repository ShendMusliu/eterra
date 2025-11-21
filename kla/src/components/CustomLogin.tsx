import React, { useState } from "react";
import { signInWithRedirect, getCurrentUser } from "aws-amplify/auth";
import { Button } from "@/components/ui/button"; // shadcn/ui

export default function CustomLogin() {
  const [loading, setLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      await signInWithRedirect({ provider: "Google" });
      // After redirect, Amplify will handle the session.
    } catch (err) {
      alert("Login failed!");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <h1 className="text-3xl font-bold mb-4" i18n-key="login.title">
        Sign in to KLA Platform
      </h1>
      <Button
        className="w-60"
        onClick={handleGoogleSignIn}
        disabled={loading}
      >
        {loading ? "Redirecting..." : "Sign in with Google"}
      </Button>
      {/* Optionally add SSO or password fields here */}
    </div>
  );
}
