'use client';

import { usePathname } from 'next/navigation';

import { SiteFooter } from '../design-system';

// eslint-disable-next-line import-x/prefer-default-export -- single named export consumed via named imports/barrels; converting to default would change the module API
export const MantineFooter = () => {
  const pathname = usePathname();
  return <SiteFooter locale={pathname.startsWith('/docs/pt-BR') ? 'pt-BR' : 'en'} />;
};
