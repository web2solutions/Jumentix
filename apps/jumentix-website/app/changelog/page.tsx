import { CommercialChangelogPage } from '@/components/commercial/ChangelogPage';

export const dynamic = 'force-dynamic';

const ChangelogPage = async ({ searchParams }: { searchParams?: Promise<{ page?: string }> }) => {
  const { page } = (await searchParams) ?? {};
  return <CommercialChangelogPage page={page} />;
};

export default ChangelogPage;
