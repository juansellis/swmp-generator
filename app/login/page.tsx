"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { Logo } from "@/components/brand/logo";
import { FormSection } from "@/components/form-section";
import { PageHeader } from "@/components/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
    <AppShell hideHeader>
      <div className="space-y-6 max-w-md mx-auto">
        <div className="flex justify-center py-4">
          <Logo height={96} className="h-24 w-auto sm:h-28 md:h-32" />
        </div>

        <PageHeader
          title="SWMP Generator"
          subtitle="Sign in to generate NZ-first Site Waste Management Plans."
        />

        <div className="flex gap-2">
          <Button
            type="button"
            variant={mode === "signin" ? "default" : "outline"}
            size="default"
            onClick={() => {
              setMode("signin");
              setError(null);
              setMessage(null);
            }}
            disabled={loading}
            className="flex-1 transition-colors hover:opacity-90"
          >
            Sign in
          </Button>
          <Button
            type="button"
            variant={mode === "signup" ? "default" : "outline"}
            size="default"
            onClick={() => {
              setMode("signup");
              setError(null);
              setMessage(null);
            }}
            disabled={loading}
            className="flex-1 transition-colors hover:opacity-90"
          >
            Create account
          </Button>
        </div>

        <FormSection
          title={mode === "signup" ? "Create Account" : "Sign In"}
          description={
            mode === "signup"
              ? "Create a new account to get started."
              : "Enter your credentials to access your projects."
          }
        >
          <form onSubmit={handleSubmit} className="grid gap-4">
            <div className="grid gap-2">
              <Label className="font-medium">Email</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.co.nz"
                autoComplete="email"
                disabled={loading}
                className="w-full"
              />
            </div>

            <div className="grid gap-2">
              <Label className="font-medium">Password</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                disabled={loading}
                className="w-full"
              />
            </div>

            <Button type="submit" variant="default" size="default" disabled={loading} className="w-full transition-colors hover:opacity-90">
              {loading
                ? "Please wait…"
                : mode === "signup"
                ? "Create account"
                : "Sign in"}
            </Button>

            {error ? (
              <Alert variant="destructive">
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}

            {message ? (
              <Alert>
                <AlertTitle>Success</AlertTitle>
                <AlertDescription>{message}</AlertDescription>
              </Alert>
            ) : null}
          </form>
        </FormSection>

        <p className="text-sm text-muted-foreground text-center">
        If you can’t sign in after creating an account, check whether Supabase
        email confirmation is enabled and confirm your email first.
      </p>
      </div>
    </AppShell>
  );
}
