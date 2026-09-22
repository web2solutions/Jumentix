import fs from 'node:fs';
import path from 'node:path';

export type InitConfig = {
  mode?: 'monolith' | 'services' | 'hybrid' | 'frontend';
  from?: string;
  preset?: 'users';
  http?: 'express' | 'fastify' | 'restify';
  realtime?: 'none' | 'websocket' | 'grpc';
  db?: 'sqlite' | 'postgres' | 'mysql' | 'mongo' | 'inmemory';
  frontend?: boolean;
  offline?: boolean;
  git?: boolean;
  install?: boolean;
  projectName?: string;
  nonInteractive?: boolean;
};

export function readInitConfig(filePath: string): InitConfig {
  const absolute = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);
  if (!fs.existsSync(absolute)) {
    throw new Error(`Config file not found: ${absolute}`);
  }
  const raw = JSON.parse(fs.readFileSync(absolute, 'utf8')) as InitConfig;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error(`Config file must contain a JSON object: ${absolute}`);
  }
  return raw;
}

export function writeInitConfig(targetDir: string, config: InitConfig): string {
  const outputPath = path.join(targetDir, 'jumentix.init.json');
  fs.writeFileSync(outputPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
  return outputPath;
}
