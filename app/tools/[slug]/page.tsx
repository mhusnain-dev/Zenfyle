import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageContainer } from "@/components/layout/PageContainer";
import { ToolPageClient } from "@/components/tools/ToolPageClient";
import { RelatedTools } from "@/components/tools/RelatedTools";
import { getTool, TOOLS } from "@/lib/registry";

/*
 * Shared tool page (Section 4.2 / 11.4), reads everything from the registry.
 * Server component: resolves the tool, renders title + one-line description,
 * the client interface (ToolPageClient), and the related-tools row. Unknown or
 * not-yet-built (comingSoon/disabled) slugs 404 rather than showing a dead UI.
 */

export function generateStaticParams() {
  return TOOLS.map((tool) => ({ slug: tool.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const tool = getTool(slug);
  if (!tool) return {};
  // Section 11.11: unique title + meta description from the registry's fields.
  return {
    title: tool.name,
    description: tool.description,
    alternates: { canonical: `/tools/${tool.slug}` },
    openGraph: {
      title: `${tool.name} — Zenfyle`,
      description: tool.description,
      url: `/tools/${tool.slug}`,
    },
  };
}

export default async function ToolPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const tool = getTool(slug);
  if (!tool || tool.status !== "active") notFound();

  return (
    <PageContainer>
      <div className="mx-auto max-w-2xl py-12 md:py-16">
        <header className="text-center">
          <h1 className="font-display text-3xl font-bold leading-tight text-text md:text-4xl">
            {tool.name}
          </h1>
          <p className="mt-3 font-body text-base leading-6 text-text-secondary">
            {tool.description}
          </p>
        </header>

        <div className="mt-10">
          <ToolPageClient tool={tool} />
        </div>

        <RelatedTools slug={tool.slug} />
      </div>
    </PageContainer>
  );
}
