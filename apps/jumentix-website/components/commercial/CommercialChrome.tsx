'use client';

import { Fragment } from 'react';

import { usePathname } from 'next/navigation';

import { SiteFooter, SiteHeader } from '@/components/design-system';

import type { ReactNode } from 'react';

// eslint-disable-next-line import-x/prefer-default-export -- single named export consumed via named imports/barrels; converting to default would change the module API
export const CommercialChrome = ({ children }: { children: ReactNode }) => {
  const pathname = usePathname();
  const isDocumentation = pathname.startsWith('/docs');
  const locale = pathname === '/pt-BR' || pathname.startsWith('/pt-BR/') ? 'pt-BR' : 'en';

  if (isDocumentation) return children;

  return (
    <Fragment>
      <SiteHeader currentPath={pathname} locale={locale} />
      {children}
      <SiteFooter locale={locale} />
    </Fragment>
  );
};
