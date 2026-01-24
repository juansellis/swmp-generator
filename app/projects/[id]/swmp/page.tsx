"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

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
      <main style={{ maxWidth: 1100, margin: "48px auto", padding: 16 }}>
        <p>Loading…</p>
      </main>
    );
  }

  if (error) {
    return (
      <main style={{ maxWidth: 1100, margin: "48px auto", padding: 16 }}>
        <button
          onClick={() => router.push(`/projects/${projectId}/inputs`)}
          style={{
            padding: "8px 10px",
            border: "1px solid #ccc",
            background: "#fff",
            borderRadius: 6,
            cursor: "pointer",
            marginBottom: 16,
          }}
        >
          ← Back to inputs
        </button>
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
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 1100, margin: "48px auto", padding: 16 }}>
      <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
        <button
          onClick={() => router.push(`/projects/${projectId}/inputs`)}
          style={{
            padding: "8px 10px",
            border: "1px solid #ccc",
            background: "#fff",
            borderRadius: 6,
            cursor: "pointer",
          }}
        >
          ← Back to inputs
        </button>

        <button
          onClick={() => router.push("/projects")}
          style={{
            padding: "8px 10px",
            border: "1px solid #ccc",
            background: "#fff",
            borderRadius: 6,
            cursor: "pointer",
          }}
        >
          Projects
        </button>
      </div>

      <h1 style={{ margin: "0 0 6px" }}>Generated SWMP</h1>
      <p style={{ marginTop: 0, color: "#444" }}>
        Version {swmp?.version} • Generated {swmp ? new Date(swmp.created_at).toLocaleString() : ""}
      </p>

      <section
        style={{
          border: "1px solid #ddd",
          borderRadius: 10,
          overflow: "hidden",
          background: "#fff",
        }}
      >
        <div
          style={{ padding: 16 }}
          dangerouslySetInnerHTML={{ __html: swmp?.content_html ?? "<p>No HTML saved.</p>" }}
        />
      </section>
    </main>
  );
}
