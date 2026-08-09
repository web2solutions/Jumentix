/* eslint-disable @typescript-eslint/no-explicit-any */

import fs from 'fs';
import os from 'os';
import path from 'path';
import type {
  IRealtimeAPIFactory
} from '@src/interface/Async/RealtimeAPIBase';
import {
  RealtimeAPIBase
} from '@src/interface/Async/RealtimeAPIBase';
import { InMemoryDbClient } from '@src/infra/persistence/InMemoryDatabase/InMemoryDbClient';
// eslint-disable-next-line import/no-unresolved
import { InMemoryMessageMediatorAdapter } from '@jumentix/message-mediator';

/**
 * Unit suite for the Catalogs wiring inside RealtimeAPIBase (JUM-491),
 * mirroring the existing `RealtimeAPIBase` suite's patterns exactly: the
 * protected compose method is exercised for build + memoization, and the
 * OAS-driven operation registration is driven from a temp spec dir with the
 * controller-module spy, asserting the catalogs branch passes the composed
 * use cases to the controller factory.
 */

class TestRealtimeAPI extends RealtimeAPIBase {
  public constructor(config: IRealtimeAPIFactory, autoBuild = false) {
    super(config, autoBuild);
  }
}

const databaseClient = InMemoryDbClient;

describe('realtimeAPIBase catalogs composition wiring', () => {
  it('composes catalogs module once and reuses the memoized composition', () => {
    expect.hasAssertions();
    const api = new TestRealtimeAPI({
      databaseClient,
      messageMediator: new InMemoryMessageMediatorAdapter()
    });

    const composedOne = (api as any).composeCatalogsModule();
    const composedTwo = (api as any).composeCatalogsModule();
    expect(composedTwo).toBe(composedOne);
    expect(composedOne.catalogUseCases).toBeDefined();
    expect(composedOne.catalogService).toBeDefined();
    expect(composedOne.dataRepository).toBeDefined();
  });

  it('composes catalogs module without a mediator (event bus fallback)', () => {
    expect.hasAssertions();
    const api = new TestRealtimeAPI({ databaseClient });
    const composed = (api as any).composeCatalogsModule();
    expect(composed.catalogUseCases).toBeDefined();
  });

  it('registers catalogs operations from the OAS spec with the composed use cases', () => {
    expect.hasAssertions();
    const specDir = fs.mkdtempSync(path.join(os.tmpdir(), 'realtime-catalogs-oas-'));
    const filePath = path.join(specDir, '1.0.0.yml');
    fs.writeFileSync(filePath, `
openapi: 3.1.0
info:
  version: 1.0.0
  title: test
paths:
  /catalogs:
    get:
      operationId: getAllCatalogs
`, 'utf8');

    const mockControllerFactory = jest.fn().mockImplementation(() => ({
      getAll: jest.fn().mockResolvedValue({ result: [] })
    }));
    const getControllerModuleSpy = jest
      .spyOn(RealtimeAPIBase as any, 'getControllerModule')
      .mockReturnValue(mockControllerFactory);

    const api = new TestRealtimeAPI(
      {
        databaseClient,
        specDir
      },
      true
    );

    expect((api as any).listOperationIds()).toContain('getAllCatalogs');
    expect(mockControllerFactory).toHaveBeenCalledWith(expect.anything());
    const factoryArg = mockControllerFactory.mock.calls[0][0];
    expect(factoryArg.catalogUseCases).toBeDefined();
    expect(typeof factoryArg.catalogUseCases.getAll).toBe('function');

    const operations: any[] = [...(api as any).operations.values()];
    const operation = operations.find(
      (entry) => entry.operationId === 'getAllCatalogs'
    );
    expect(operation.controllerMethod).toBe('getAll');

    getControllerModuleSpy.mockRestore();
    fs.rmSync(specDir, { recursive: true, force: true });
  });
});
