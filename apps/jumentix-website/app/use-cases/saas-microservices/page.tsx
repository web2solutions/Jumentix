import { UseCaseTemplate } from '../_components/UseCaseTemplate';

export default function SaasMicroservicesUseCasePage() {
  return (
    <UseCaseTemplate
      title="SaaS Microservices with Jumentix"
      summary="Scale by domain with reusable contracts, package-level adapters, and governance controls across services."
      bullets={[
        'Contract continuity across service boundaries',
        'Independent delivery tracks with shared architecture language',
        'Operational flexibility for deployment targets and runtimes',
      ]}
    />
  );
}
