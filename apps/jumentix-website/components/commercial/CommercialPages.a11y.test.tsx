import { render } from '@/test-utils';
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

// jest-axe refuses overlapping runs; under load the 5s default timeout leaves a
// previous axe call active and every following case fails with
// "Axe is already running" (JUM-917 push flake).
let axeGate: Promise<void> = Promise.resolve();

describe('Commercial pages a11y', () => {
  const testA11y = async (component: React.ReactElement) => {
    const run = axeGate.then(async () => {
      const { container } = render(component);
      const results = await axe(container, axeConfig);
      expect(results).toHaveNoViolations();
    });
    axeGate = run.then(
      () => undefined,
      () => undefined
    );
    await run;
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
      expect.hasAssertions();
      await testA11y(<CommercialPage locale="en" page={page} />);
    }, 15000);

    it(`has no a11y violations (PT-BR)`, async () => {
      expect.hasAssertions();
      await testA11y(<CommercialPage locale="pt-BR" page={page} />);
    }, 15000);
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
        expect.hasAssertions();
        await testA11y(<CommercialUseCasePage locale="en" name={name} />);
      }, 15000);

      it(`has no a11y violations (PT-BR)`, async () => {
        expect.hasAssertions();
        await testA11y(<CommercialUseCasePage locale="pt-BR" name={name} />);
      }, 15000);
    });
  });
});
