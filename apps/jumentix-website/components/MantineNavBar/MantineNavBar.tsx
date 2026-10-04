'use client';

import { Fragment } from 'react';

import { IconBrandGithub, IconLanguage } from '@tabler/icons-react';
import { usePathname } from 'next/navigation';
import { Navbar } from 'nextra-theme-docs';

import { ColorSchemeControl } from '../ColorSchemeControl/ColorSchemeControl';
import { BrandMark, StatusBadge } from '../design-system';
import classes from './MantineNavBar.module.css';
import { MantineNextraThemeObserver } from '../MantineNextraThemeObserver/MantineNextraThemeObserver';

const localizedDocsPath = (pathname: string, portuguese: boolean) => {
  if (portuguese) {
    return pathname.replace(/^\/docs\/pt-BR(?=\/|$)/, '/docs') || '/docs/jumentix';
  }
  return pathname.replace(/^\/docs(?=\/|$)/, '/docs/pt-BR');
};

// eslint-disable-next-line import-x/prefer-default-export -- single named export consumed via named imports/barrels; converting to default would change the module API
export const MantineNavBar = () => {
  const pathname = usePathname();
  const portuguese = pathname.startsWith('/docs/pt-BR');
  const basePath = portuguese ? '/docs/pt-BR/jumentix' : '/docs/jumentix';

  const links = [
    [portuguese ? 'Conceitos' : 'Concepts', `${basePath}/concepts`],
    [portuguese ? 'Guias' : 'Guides', `${basePath}/guides`],
    [portuguese ? 'Adaptadores' : 'Adapters', `${basePath}/adapters`],
    [portuguese ? 'Pacotes' : 'Packages', `${basePath}/packages`]
  ];

  return (
    <Fragment>
      <MantineNextraThemeObserver />
      <Navbar
        logo={<BrandMark asLink={false} />}
        projectLink="https://github.com/web2solutions/Jumentix"
        projectIcon={
          <Fragment>
            <span className="sr-only">GitHub repository</span>
            <IconBrandGithub aria-hidden="true" focusable="false" size={20} />
          </Fragment>
        }
      >
        <nav
          aria-label={portuguese ? 'Seções da documentação' : 'Documentation sections'}
          className={classes.docsNav}
        >
          {links.map(([label, href]) => (
            <a key={href} aria-current={pathname.startsWith(href) ? 'page' : undefined} href={href}>
              {label}
            </a>
          ))}
        </nav>
        <div className={classes.actions}>
          <StatusBadge>v0.0.2</StatusBadge>
          <a
            className={classes.locale}
            href={localizedDocsPath(pathname, portuguese)}
            aria-label={
              portuguese ? 'Read documentation in English' : 'Leia a documentação em português'
            }
          >
            <IconLanguage size={17} />
            {portuguese ? 'EN' : 'PT-BR'}
          </a>
          <ColorSchemeControl />
        </div>
      </Navbar>
    </Fragment>
  );
};
