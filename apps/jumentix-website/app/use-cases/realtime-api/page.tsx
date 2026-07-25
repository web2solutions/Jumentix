import { UseCaseTemplate } from '../_components/UseCaseTemplate';

export default function RealtimeApiUseCasePage() {
  return (
    <UseCaseTemplate
      title="Realtime API with Jumentix"
      summary="Implement bidirectional service communication with WebSocket or gRPC while keeping REST fallback available."
      bullets={[
        'AsyncAPI-oriented realtime contracts',
        'Protocol handlers aligned with domain/controller boundaries',
        'Resilience patterns for multi-instance socket environments',
      ]}
    />
  );
}
