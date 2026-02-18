import { redirect } from "next/navigation";

/**
 * Alias for Report page. Keeps /swmp as canonical route; /report redirects for clarity.
 */
export default async function ReportAliasPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/projects/${id}/swmp`);
}
