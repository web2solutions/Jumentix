'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { SiteFooter, SiteHeader } from '@/components/design-system';

export function CommercialChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isDocumentation = pathname.startsWith('/docs');
  const locale = pathname === '/pt-BR' || pathname.startsWith('/pt-BR/') ? 'pt-BR' : 'en';

  if (isDocumentation) return children;

  return (
    <>
      <SiteHeader locale={locale} currentPath={pathname} />
      {children}
      <SiteFooter locale={locale} />
    </>
  );
}
