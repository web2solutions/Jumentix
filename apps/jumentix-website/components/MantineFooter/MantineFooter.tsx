'use client';

import { usePathname } from 'next/navigation';
import { SiteFooter } from '../design-system';

export const MantineFooter = () => {
  const pathname = usePathname();
  return <SiteFooter locale={pathname.startsWith('/docs/pt-BR') ? 'pt-BR' : 'en'} />;
};
