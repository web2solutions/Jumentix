import type { ISecurityAuditEvent, ISecurityAuditRepository } from './ISecurityAuditRepository';

let securityAuditRepository: ISecurityAuditRepository | undefined;

class InMemorySecurityAuditRepository implements ISecurityAuditRepository {
  private readonly events: ISecurityAuditEvent[] = [];

  public async record(event: ISecurityAuditEvent): Promise<void> {
    this.events.push(event);
  }

  public async getAll(): Promise<ISecurityAuditEvent[]> {
    return [...this.events];
  }

  public async clear(): Promise<void> {
    this.events.length = 0;
  }

  public static compile(): ISecurityAuditRepository {
    securityAuditRepository ??= new InMemorySecurityAuditRepository();
    return securityAuditRepository;
  }
}

export default InMemorySecurityAuditRepository;
