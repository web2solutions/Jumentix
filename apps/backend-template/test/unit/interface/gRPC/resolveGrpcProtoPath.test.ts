import fs from 'fs';
import os from 'os';
import path from 'path';

import {
  resolveGrpcProtoPath as resolveServerGrpcProtoPath
} from '@src/interface/gRPC/resolveGrpcProtoPath';
import {
  resolveGrpcProtoPath as resolveSdkGrpcProtoPath
} from '@jumentix/sdk-grpc-client';

describe('grpc proto path resolution', () => {
  const temporaryDirectories: string[] = [];

  const createTemporaryDirectory = (): string => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'grpc-proto-path-'));
    temporaryDirectories.push(directory);
    return directory;
  };

  afterAll(() => {
    temporaryDirectories.forEach((directory) => {
      fs.rmSync(directory, { recursive: true, force: true });
    });
  });

  it('resolves the repository-owned proto from source and compiled module locations', () => {
    expect.hasAssertions();
    const canonicalPath = path.resolve('spec/asyncapi/async-api.proto');
    const compiledModuleDirectory = path.resolve(
      '.build/apps/backend-template/src/interface/gRPC'
    );

    expect(resolveServerGrpcProtoPath()).toBe(canonicalPath);
    expect(resolveServerGrpcProtoPath(canonicalPath)).toBe(canonicalPath);
    expect(resolveServerGrpcProtoPath(undefined, compiledModuleDirectory)).toBe(canonicalPath);
  });

  it('resolves the proto copied into an SDK package artifact', () => {
    expect.hasAssertions();
    const packageRoot = createTemporaryDirectory();
    const compiledModuleDirectory = path.join(packageRoot, 'dist');
    const packagedProtoPath = path.join(compiledModuleDirectory, 'proto', 'async-api.proto');
    fs.mkdirSync(path.dirname(packagedProtoPath), { recursive: true });
    fs.writeFileSync(packagedProtoPath, 'syntax = "proto3";');

    expect(resolveSdkGrpcProtoPath(undefined, compiledModuleDirectory)).toBe(packagedProtoPath);
  });

  it('fails with focused diagnostics for missing default and configured artifacts', () => {
    expect.hasAssertions();
    const missingRoot = createTemporaryDirectory();
    const missingModuleDirectory = path.join(missingRoot, 'dist', 'nested');
    const missingConfiguredPath = path.join(missingRoot, 'configured.proto');

    expect(() => resolveServerGrpcProtoPath(undefined, missingModuleDirectory)).toThrow(
      'Canonical gRPC proto artifact "spec/asyncapi/async-api.proto" was not found'
    );
    expect(() => resolveSdkGrpcProtoPath(undefined, missingModuleDirectory)).toThrow(
      'or packaged artifact "proto/async-api.proto" was not found'
    );
    expect(() => resolveServerGrpcProtoPath(missingConfiguredPath)).toThrow(
      `gRPC proto file not found at configured path: ${missingConfiguredPath}`
    );
  });
});
