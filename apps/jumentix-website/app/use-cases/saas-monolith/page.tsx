import { UseCaseTemplate } from '../_components/UseCaseTemplate';

export default function SaasMonolithUseCasePage() {
  return (
    <UseCaseTemplate
      title="SaaS Monolith with Jumentix"
      summary="Build modular monoliths with clear domain boundaries and evolve toward microservices only when needed."
      bullets={[
        'Fastest path to production with lower operational complexity',
        'Bounded contexts and ports/adapters from day one',
        'Controlled migration path for future service extraction',
      ]}
    />
  );
}
