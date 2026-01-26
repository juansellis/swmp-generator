import Link from "next/link";

export default async function VerifiedPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; message?: string }>;
}) {
  const sp = await searchParams;
  const status = sp.status ?? "success";
  const message = sp.message ?? "";

  const ok = status === "success";

  return (
    <main className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-xl border bg-white p-6">
        <h1 className="text-xl font-semibold">
          {ok ? "Email verified" : "Verification failed"}
        </h1>

        <p className="mt-2 text-sm text-muted-foreground">
          {ok
            ? "Thanks — your email address has been confirmed. You can now log in."
            : message || "We couldn’t verify your email. Please request a new verification email and try again."}
        </p>

        <div className="mt-5 flex gap-3">
          <Link
            href="/login"
            className="inline-flex items-center justify-center rounded-md border bg-black px-4 py-2 text-sm font-medium text-white hover:bg-black/90"
          >
            Back to login
          </Link>

          {!ok && (
            <Link
              href="/login"
              className="inline-flex items-center justify-center rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted"
            >
              Try again
            </Link>
          )}
        </div>
      </div>
    </main>
  );
}
