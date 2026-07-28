import { CommercialChangelogPage } from '@/components/commercial/ChangelogPage';

export const dynamic = 'force-dynamic';

export default async function ChangelogPage({
  searchParams,
}: {
  searchParams?: Promise<{ page?: string }>;
}) {
  const { page } = (await searchParams) ?? {};
  return <CommercialChangelogPage page={page} />;
}
