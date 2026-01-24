"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // If already logged in, redirect to /projects
  useEffect(() => {
    let isMounted = true;

    (async () => {
      const { data, error } = await supabase.auth.getSession();
      if (!isMounted) return;

      if (error) {
        // If session fetch fails, we don't block login; just show a message.
        setMessage("Session check failed. Please sign in.");
        return;
      }

      if (data.session) {
        router.replace("/projects");
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      if (!email || !password) {
        setError("Please enter both email and password.");
        return;
      }

      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
        });

        if (error) {
          setError(error.message);
          return;
        }

        // Depending on your Supabase email confirmation settings,
        // the user may need to confirm via email before sign-in works.
        setMessage(
          "Account created. If email confirmation is enabled, check your inbox to confirm before signing in."
        );
        setMode("signin");
        setPassword("");
        return;
      }

      // Sign in
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setError(error.message);
        return;
      }

      router.replace("/projects");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ maxWidth: 520, margin: "48px auto", padding: 16 }}>
      <h1 style={{ fontSize: 28, marginBottom: 8 }}>SWMP Generator</h1>
      <p style={{ marginTop: 0, marginBottom: 24, color: "#444" }}>
        Sign in to generate NZ-first Site Waste Management Plans.
      </p>

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <button
          type="button"
          onClick={() => {
            setMode("signin");
            setError(null);
            setMessage(null);
          }}
          disabled={loading}
          style={{
            padding: "10px 12px",
            border: "1px solid #ccc",
            background: mode === "signin" ? "#eee" : "#fff",
            cursor: "pointer",
          }}
        >
          Sign in
        </button>
        <button
          type="button"
          onClick={() => {
            setMode("signup");
            setError(null);
            setMessage(null);
          }}
          disabled={loading}
          style={{
            padding: "10px 12px",
            border: "1px solid #ccc",
            background: mode === "signup" ? "#eee" : "#fff",
            cursor: "pointer",
          }}
        >
          Create account
        </button>
      </div>

      <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12 }}>
        <label style={{ display: "grid", gap: 6 }}>
          <span>Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.co.nz"
            autoComplete="email"
            disabled={loading}
            style={{ padding: 10, border: "1px solid #ccc", borderRadius: 6 }}
          />
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <span>Password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete={
              mode === "signup" ? "new-password" : "current-password"
            }
            disabled={loading}
            style={{ padding: 10, border: "1px solid #ccc", borderRadius: 6 }}
          />
        </label>

        <button
          type="submit"
          disabled={loading}
          style={{
            padding: "10px 12px",
            border: "1px solid #111",
            background: "#111",
            color: "white",
            borderRadius: 6,
            cursor: "pointer",
          }}
        >
          {loading
            ? "Please wait…"
            : mode === "signup"
            ? "Create account"
            : "Sign in"}
        </button>

        {error && (
          <div
            style={{
              padding: 12,
              border: "1px solid #f5c2c7",
              background: "#f8d7da",
              color: "#842029",
              borderRadius: 6,
            }}
          >
            {error}
          </div>
        )}

        {message && (
          <div
            style={{
              padding: 12,
              border: "1px solid #badbcc",
              background: "#d1e7dd",
              color: "#0f5132",
              borderRadius: 6,
            }}
          >
            {message}
          </div>
        )}
      </form>

      <p style={{ marginTop: 18, color: "#666", fontSize: 13 }}>
        If you can’t sign in after creating an account, check whether Supabase
        email confirmation is enabled and confirm your email first.
      </p>
    </main>
  );
}
