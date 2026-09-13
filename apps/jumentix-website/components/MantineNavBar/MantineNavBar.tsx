'use client';

import { Navbar } from 'nextra-theme-docs';
import { usePathname } from 'next/navigation';
import { IconBrandGithub, IconLanguage } from '@tabler/icons-react';
import {
  BrandMark,
  StatusBadge,
} from '../design-system';
import { ColorSchemeControl } from '../ColorSchemeControl/ColorSchemeControl';
import { MantineNextraThemeObserver } from '../MantineNextraThemeObserver/MantineNextraThemeObserver';
import classes from './MantineNavBar.module.css';

const localizedDocsPath = (pathname: string, portuguese: boolean) => {
  if (portuguese) {
    return pathname.replace(/^\/docs\/pt-BR(?=\/|$)/, '/docs') || '/docs/jumentix';
  }
  return pathname.replace(/^\/docs(?=\/|$)/, '/docs/pt-BR');
};

export const MantineNavBar = () => {
  const pathname = usePathname();
  const portuguese = pathname.startsWith('/docs/pt-BR');
  const basePath = portuguese ? '/docs/pt-BR/jumentix' : '/docs/jumentix';

  const links = [
    [portuguese ? 'Conceitos' : 'Concepts', `${basePath}/concepts`],
    [portuguese ? 'Guias' : 'Guides', `${basePath}/guides`],
    [portuguese ? 'Adaptadores' : 'Adapters', `${basePath}/adapters`],
    [portuguese ? 'Pacotes' : 'Packages', `${basePath}/packages`],
  ];

  return (
    <>
      <MantineNextraThemeObserver />
      <Navbar
        logo={<BrandMark asLink={false} />}
        projectIcon={
          <>
            <span className="sr-only">GitHub repository</span>
            <IconBrandGithub size={20} aria-hidden="true" focusable="false" />
          </>
        }
        projectLink="https://github.com/web2solutions/Jumentix"
      >
        <nav className={classes.docsNav} aria-label={portuguese ? 'Seções da documentação' : 'Documentation sections'}>
          {links.map(([label, href]) => (
            <a href={href} key={href} aria-current={pathname.startsWith(href) ? 'page' : undefined}>
              {label}
            </a>
          ))}
        </nav>
        <div className={classes.actions}>
          <StatusBadge>v0.0.2</StatusBadge>
          <a
            className={classes.locale}
            href={localizedDocsPath(pathname, portuguese)}
            aria-label={portuguese ? 'Read documentation in English' : 'Leia a documentação em português'}
          >
            <IconLanguage size={17} />
            {portuguese ? 'EN' : 'PT-BR'}
          </a>
          <ColorSchemeControl />
        </div>
      </Navbar>
    </>
  );
};
