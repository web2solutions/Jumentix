import { UseCaseTemplate } from '../_components/UseCaseTemplate';

export default function RestApiUseCasePage() {
  return (
    <UseCaseTemplate
      title="REST API with Jumentix"
      summary="Deliver enterprise REST APIs with contract-first workflows, framework flexibility, and predictable quality gates."
      bullets={[
        'OpenAPI-driven endpoint lifecycle and request/response contracts',
        'Support for multiple Node.js HTTP adapters',
        'Built-in CI governance and coverage thresholds',
      ]}
    />
  );
}
