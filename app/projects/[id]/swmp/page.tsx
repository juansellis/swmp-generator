"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type SwmpRow = {
  id: string;
  version: number;
  content_html: string | null;
  created_at: string;
};

export default function SwmpPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const projectId = params?.id;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [swmp, setSwmp] = useState<SwmpRow | null>(null);

  useEffect(() => {
    let mounted = true;

    (async () => {
      setLoading(true);
      setError(null);

      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        router.replace("/login");
        return;
      }

      if (!projectId) {
        setError("Missing project id.");
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("swmps")
        .select("id, version, content_html, created_at")
        .eq("project_id", projectId)
        .order("version", { ascending: false })
        .limit(1)
        .single();

      if (!mounted) return;

      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }

      setSwmp(data as any);
      setLoading(false);
    })();

    return () => {
      mounted = false;
    };
  }, [router, projectId]);

  if (loading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center py-24">
          <p className="text-sm text-muted-foreground">Loading…</p>
        </div>
      </AppShell>
    );
  }

  if (error) {
    return (
      <AppShell>
        <div className="space-y-6">
          <PageHeader
            title="Generated SWMP"
            actions={
              <Button variant="outline" size="default" onClick={() => router.push(`/projects/${projectId}/inputs`)} className="transition-colors hover:bg-muted/80">
                ← Back to inputs
              </Button>
            }
          />
          <Alert variant="destructive">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader
          title="Generated SWMP"
          subtitle={
            <span>
              Version {swmp?.version} • Generated{" "}
              {swmp ? new Date(swmp.created_at).toLocaleString() : ""}
            </span>
          }
          actions={
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => router.push(`/projects/${projectId}/inputs`)}
              >
                ← Back to inputs
              </Button>
              <Button variant="outline" onClick={() => router.push("/projects")}>
                Projects
              </Button>
            </div>
          }
        />

        <Card className="overflow-hidden">
          <CardContent className="p-6">
            <div
              className="prose prose-sm max-w-none dark:prose-invert"
              dangerouslySetInnerHTML={{ __html: swmp?.content_html ?? "<p>No HTML saved.</p>" }}
            />
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
