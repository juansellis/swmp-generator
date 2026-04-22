"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { AppShell } from "@/components/app-shell";
import { ProjectsDashboardNav } from "@/components/projects-dashboard-nav";
import { SectionCard } from "@/components/ui/section-card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CreditCard, Sparkles, Package } from "lucide-react";
import { toast } from "sonner";
import { stripePromise } from "@/lib/stripe/stripePromise";

type CreditsResponse = { site_credits_balance: number; free_site_used: boolean };
type TransactionRow = {
  id: string;
  type: string;
  quantity: number;
  source: string | null;
  stripe_session_id: string | null;
  notes: string | null;
  created_at: string;
};

function BillingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<{ id: string; email?: string | null } | null>(null);
  const [credits, setCredits] = useState<CreditsResponse | null>(null);
  const [transactions, setTransactions] = useState<TransactionRow[]>([]);
  const [checkoutLoading, setCheckoutLoading] = useState<"single" | "bundle" | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  useEffect(() => {
    const canceled = searchParams.get("canceled");
    if (canceled === "1") {
      toast.info("Checkout canceled.");
      window.history.replaceState({}, "", "/billing");
    }
  }, [searchParams]);

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
          if (typeof body?.isSuperAdmin === "boolean") setIsSuperAdmin(body.isSuperAdmin);
        })
        .catch(() => {});

      try {
        const [creditsRes, txRes] = await Promise.all([
          fetch("/api/billing/credits", { credentials: "include" }),
          fetch("/api/billing/transactions", { credentials: "include" }),
        ]);
        if (cancelled) return;
        if (creditsRes.ok) {
          const data = await creditsRes.json();
          setCredits({
            site_credits_balance: data.site_credits_balance ?? 0,
            free_site_used: data.free_site_used ?? false,
          });
        }
        if (txRes.ok) {
          const data = await txRes.json();
          setTransactions(Array.isArray(data.transactions) ? data.transactions : []);
        }
      } catch {
        // ignore
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function startCheckout(packageType: "single" | "bundle") {
    if (!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY) {
      toast.error("Stripe checkout is not configured");
      return;
    }

    setCheckoutLoading(packageType);
    try {
      const res = await fetch("/api/billing/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ package: packageType, accountId: user?.id }),
      });
      const json = await res.json();
      if (!res.ok) {
        if (res.status === 503) toast.error("Billing is not configured.");
        else toast.error(json?.error ?? "Checkout failed");
        return;
      }
      const sessionId = (json as { sessionId?: string }).sessionId;
      if (!sessionId) {
        toast.error("Checkout session missing");
        return;
      }

      const stripe = await stripePromise;
      if (!stripe) {
        toast.error("Stripe checkout is not configured");
        return;
      }

      const { error } = await stripe.redirectToCheckout({ sessionId });
      if (error) toast.error(error.message);
    } finally {
      setCheckoutLoading(null);
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  const creditsDisplay =
    credits != null
      ? { siteCreditsBalance: credits.site_credits_balance, freeSiteUsed: credits.free_site_used }
      : null;

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
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-64 w-full rounded-xl" />
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
          <Link href="/projects" className="hover:text-foreground">
            Projects
          </Link>
          <span>/</span>
          <span className="text-foreground">Billing</span>
        </div>

        {/* Balance summary */}
        <section className="space-y-4" aria-labelledby="billing-balance-heading">
          <h2
            id="billing-balance-heading"
            className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
          >
            Your balance
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-border/20 bg-card shadow-[var(--shadow-card)] p-6">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-primary/10 p-2.5 text-primary">
                  <Sparkles className="size-5" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Free site</p>
                  <p className="text-2xl font-semibold tabular-nums">
                    {credits?.free_site_used ? "Used" : "Available"}
                  </p>
                </div>
              </div>
            </div>
            <div className="rounded-xl border border-border/20 bg-card shadow-[var(--shadow-card)] p-6">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-primary/10 p-2.5 text-primary">
                  <CreditCard className="size-5" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Paid credits</p>
                  <p className="text-2xl font-semibold tabular-nums">
                    {credits?.site_credits_balance ?? 0}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Quick purchase */}
        <section className="space-y-4" aria-labelledby="billing-purchase-heading">
          <h2
            id="billing-purchase-heading"
            className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
          >
            Purchase credits
          </h2>
          <p className="text-sm text-muted-foreground">
            Your first site is free. After that, each new site uses 1 credit.
          </p>
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="rounded-xl border border-border/20 bg-card shadow-[var(--shadow-card)] overflow-hidden p-6">
              <div className="flex flex-col items-start gap-4">
                <div className="rounded-lg bg-primary/10 p-3 text-primary">
                  <CreditCard className="size-6" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-lg font-semibold text-foreground">1 site credit</h3>
                  <p className="text-sm text-muted-foreground">
                    One-time purchase. Use it when you create your next plan.
                  </p>
                </div>
                <Button
                  variant="primary"
                  size="default"
                  className="w-full sm:w-auto"
                  onClick={() => startCheckout("single")}
                  disabled={!!checkoutLoading}
                >
                  {checkoutLoading === "single" ? "Redirecting…" : "Buy 1 site credit"}
                </Button>
              </div>
            </div>
            <div className="rounded-xl border border-border/20 bg-card shadow-[var(--shadow-card)] overflow-hidden p-6">
              <div className="flex flex-col items-start gap-4">
                <div className="rounded-lg bg-emerald-500/20 p-3 text-emerald-600 dark:text-emerald-400">
                  <Package className="size-6" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-lg font-semibold text-foreground">5 site credits</h3>
                  <p className="text-sm text-muted-foreground">
                    Bundle and save 20%. Best value for multiple plans.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="default"
                  className="w-full sm:w-auto"
                  onClick={() => startCheckout("bundle")}
                  disabled={!!checkoutLoading}
                >
                  {checkoutLoading === "bundle" ? "Redirecting…" : "Buy 5 site credits and save 20%"}
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Transaction history */}
        <SectionCard
          title="Transaction history"
          description="Recent credit purchases and usage."
        >
          {transactions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No transactions yet.</p>
          ) : (
            <div className="overflow-x-auto -mx-6 -mb-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/20 text-left text-muted-foreground">
                    <th className="pb-3 pr-4 pl-6 font-medium">Date</th>
                    <th className="pb-3 pr-4 font-medium">Type</th>
                    <th className="pb-3 pr-4 font-medium">Quantity</th>
                    <th className="pb-3 pr-6 font-medium">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((tx) => (
                    <tr key={tx.id} className="border-b border-border/20 last:border-0">
                      <td className="py-3 pr-4 pl-6 text-muted-foreground">
                        {new Date(tx.created_at).toLocaleString()}
                      </td>
                      <td className="py-3 pr-4 capitalize">{tx.type.replace(/_/g, " ")}</td>
                      <td className="py-3 pr-4 tabular-nums">{tx.quantity}</td>
                      <td className="py-3 pr-6">{tx.notes ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      </div>
    </AppShell>
  );
}

export default function BillingPage() {
  return (
    <Suspense
      fallback={
        <AppShell topNav={<div className="flex w-full" />}>
          <div className="space-y-6">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-32 w-full rounded-xl" />
            <Skeleton className="h-64 w-full rounded-xl" />
          </div>
        </AppShell>
      }
    >
      <BillingContent />
    </Suspense>
  );
}
