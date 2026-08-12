import { render, screen } from '@/test-utils';
import { axe, toHaveNoViolations } from 'jest-axe';
import {
  CommercialPage,
  CommercialUseCasePage,
} from '../commercial/CommercialPages';

expect.extend(toHaveNoViolations);

const axeConfig = {
  rules: {
    'heading-order': { enabled: false },
  },
};

describe('Commercial pages a11y', () => {
  const testA11y = async (component: React.ReactElement) => {
    const { container } = render(component);
    const results = await axe(container, axeConfig);
    expect(results).toHaveNoViolations();
  };

  const pages: Array<Parameters<typeof CommercialPage>[0]['page']> = [
    'home',
    'product',
    'use-cases',
    'integrations',
    'architecture',
    'security',
    'engagement',
    'contact',
    'community',
    'roadmap',
  ];

  describe.each(pages)('%s page', (page) => {
    it(`has no a11y violations (EN)`, async () => {
      await testA11y(<CommercialPage locale="en" page={page} />);
    });

    it(`has no a11y violations (PT-BR)`, async () => {
      await testA11y(<CommercialPage locale="pt-BR" page={page} />);
    });
  });

  describe('CommercialUseCasePage', () => {
    const useCases: Array<Parameters<typeof CommercialUseCasePage>[0]['name']> = [
      'rest-api',
      'realtime-api',
      'saas-monolith',
      'saas-microservices',
      'spa-pwa',
    ];

    describe.each(useCases)('%s', (name) => {
      it(`has no a11y violations (EN)`, async () => {
        await testA11y(<CommercialUseCasePage locale="en" name={name} />);
      });

      it(`has no a11y violations (PT-BR)`, async () => {
        await testA11y(<CommercialUseCasePage locale="pt-BR" name={name} />);
      });
    });
  });
});