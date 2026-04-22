"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { AppShell } from "@/components/app-shell";
import { ProjectsDashboardNav } from "@/components/projects-dashboard-nav";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle2, CreditCard } from "lucide-react";

type CreditsResponse = { site_credits_balance: number; free_site_used: boolean };

function BillingSuccessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = useMemo(() => searchParams.get("session_id") ?? "", [searchParams]);

  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<{ id: string; email?: string | null } | null>(null);
  const [credits, setCredits] = useState<CreditsResponse | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        router.replace("/login");
        return;
      }
      setUser(session.user);

      fetch("/api/auth/check-admin", { credentials: "include" })
        .then((r) => r.json())
        .then((body) => {
          if (!cancelled && typeof body?.isSuperAdmin === "boolean") setIsSuperAdmin(body.isSuperAdmin);
        })
        .catch(() => {});

      // Poll credits briefly in case webhook is still processing.
      const startedAt = Date.now();
      const maxMs = 15_000;
      while (!cancelled) {
        try {
          const res = await fetch("/api/billing/credits", { credentials: "include" });
          if (res.ok) {
            const data = await res.json();
            setCredits({
              site_credits_balance: data.site_credits_balance ?? 0,
              free_site_used: data.free_site_used ?? false,
            });
          }
        } catch {
          // ignore
        }
        if (Date.now() - startedAt > maxMs) break;
        await new Promise((r) => setTimeout(r, 1200));
      }

      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const creditsDisplay =
    credits != null
      ? { siteCreditsBalance: credits.site_credits_balance, freeSiteUsed: credits.free_site_used }
      : null;

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  if (loading) {
    return (
      <AppShell
        topNav={
          <div className="flex w-full items-center justify-between">
            <Skeleton className="h-6 w-24" />
            <Skeleton className="h-9 w-28" />
          </div>
        }
      >
        <div className="space-y-6">
          <Skeleton className="h-40 w-full rounded-xl" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      topNav={
        <ProjectsDashboardNav
          title="Billing"
          userEmail={user?.email ?? null}
          isSuperAdmin={isSuperAdmin}
          creditsDisplay={creditsDisplay}
          onNewProject={() => router.push("/projects")}
          onSignOut={handleSignOut}
        />
      }
    >
      <div className="space-y-8">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link href="/billing" className="hover:text-foreground">
            Billing
          </Link>
          <span>/</span>
          <span className="text-foreground">Success</span>
        </div>

        <div className="rounded-xl border border-border/20 bg-card shadow-[var(--shadow-card)] p-6">
          <div className="flex items-start gap-4">
            <div className="rounded-lg bg-emerald-500/20 p-3 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="size-6" />
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <h2 className="text-lg font-semibold text-foreground">Payment received</h2>
              <p className="text-sm text-muted-foreground">
                Thanks — your site credits will be available once the payment is confirmed. If you don’t see them right away, this page will update for a short time.
              </p>
              {sessionId ? (
                <p className="text-xs text-muted-foreground truncate">
                  Session: <span className="font-mono">{sessionId}</span>
                </p>
              ) : null}
            </div>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border bg-muted/30 p-4">
              <p className="text-sm font-medium text-muted-foreground">Paid credits balance</p>
              <p className="text-2xl font-semibold tabular-nums">{credits?.site_credits_balance ?? 0}</p>
            </div>
            <div className="rounded-lg border bg-muted/30 p-4">
              <p className="text-sm font-medium text-muted-foreground">Free site</p>
              <p className="text-2xl font-semibold tabular-nums">{credits?.free_site_used ? "Used" : "Available"}</p>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            <Button variant="primary" onClick={() => router.push("/projects")}>
              Create a new plan
            </Button>
            <Button variant="outline" asChild>
              <Link href="/billing" className="gap-2">
                <CreditCard className="size-4" />
                View billing
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

export default function BillingSuccessPage() {
  return (
    <Suspense
      fallback={
        <AppShell topNav={<div className="flex w-full" />}>
          <div className="space-y-6">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-40 w-full rounded-xl" />
          </div>
        </AppShell>
      }
    >
      <BillingSuccessContent />
    </Suspense>
  );
}

