import { describe, expect, it } from 'bun:test';

import { genericWidgetsForModule } from '@/components/dashboard/genericWidgets';
import { metricsSpecForListOperation } from '@/contracts/metricsSchema';
import { usersCrudConfig } from '@/features/users/usersCrudConfig';
import { organizationsCrudConfig } from '@/features/organizations/organizationsCrudConfig';
import { usersModule } from '@/modules/users';

describe('generic dashboard widgets (JUM-812)', () => {
  it('derives count, groupBy, series and fan-out widgets from the bundled OAS', () => {
    expect.hasAssertions();
    const widgets = genericWidgetsForModule(usersModule);
    const ids = widgets.map((widget) => widget.id);
    expect(ids).toContain('generic:users:count');
    expect(ids).toContain('generic:organizations:count');
    expect(ids).toContain('generic:users:groupBy:roles');
    expect(ids).toContain('generic:users:groupBy:organization');
    expect(ids).toContain('generic:users:series:createdAt');
    expect(ids).toContain('generic:organizations:series:createdAt');
    expect(ids).toContain('generic:organizations:fan-out:users');
    expect(ids).not.toContain('generic:organizations:groupBy:name');
  });

  it('binds User and Organization metrics operations from the contract', () => {
    expect.hasAssertions();
    expect(metricsSpecForListOperation(usersCrudConfig.operations.list)).toMatchObject({
      operationId: 'getUsersMetrics',
      capabilities: { groupable: ['roles', 'organization'], series: ['createdAt', 'updatedAt'] }
    });
    expect(metricsSpecForListOperation(organizationsCrudConfig.operations.list)).toMatchObject({
      operationId: 'getOrganizationsMetrics',
      capabilities: { groupable: [], series: ['createdAt', 'updatedAt'] }
    });
  });
});
