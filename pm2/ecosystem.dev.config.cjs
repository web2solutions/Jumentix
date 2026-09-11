module.exports = {
  apps: [
    {
      name: 'jumentix-dev-restapi',
      script: './apps/backend-template/src/interface/HTTP/adapters/start-rest-api.ts',
      interpreter: 'bun',
      interpreter_args: '-r tsconfig-paths/register --env-file=./apps/backend-template/src/config/.env.dev',
      env: {
        NODE_ENV: 'dev',
        JUMENTIX_HTTP_PORT: '3000'
      }
    },
    {
      name: 'jumentix-dev-websocketapi',
      script: './apps/backend-template/src/interface/WebSocket/adapters/start-websocket-api.ts',
      interpreter: 'bun',
      interpreter_args: '-r tsconfig-paths/register --env-file=./apps/backend-template/src/config/.env.dev',
      env: {
        NODE_ENV: 'dev',
        JUMENTIX_WEBSOCKET_PORT: '3001',
        JUMENTIX_REALTIME_API: 'yes',
        JUMENTIX_REALTIME_API_PROTOCOL: 'websocket',
        JUMENTIX_DISABLE_FALLBACK_REST: 'true'
      }
    },
    {
      name: 'jumentix-dev-grpcapi',
      script: './apps/backend-template/src/interface/gRPC/adapters/start-grpc-api.ts',
      interpreter: 'bun',
      interpreter_args: '-r tsconfig-paths/register --env-file=./apps/backend-template/src/config/.env.dev',
      env: {
        NODE_ENV: 'dev',
        JUMENTIX_GRPC_PORT: '3002',
        JUMENTIX_REALTIME_API: 'yes',
        JUMENTIX_REALTIME_API_PROTOCOL: 'grpc',
        JUMENTIX_DISABLE_FALLBACK_REST: 'true'
      }
    },
    {
      name: 'jumentix-dev-service-management-api',
      script: './apps/service-management-api/src/start-service-management-catalog-api.ts',
      interpreter: 'bun',
      interpreter_args: '-r tsconfig-paths/register --env-file=./apps/backend-template/src/config/.env.dev',
      env: {
        NODE_ENV: 'dev',
        JUMENTIX_HTTP_PORT: '3003'
      }
    },
    {
      name: 'jumentix-dev-service-management',
      script: './apps/service-management/server.js',
      interpreter: 'bun',
      env: {
        NODE_ENV: 'dev',
        JUMENTIX_SERVICE_MANAGEMENT_PORT: '3200',
        JUMENTIX_SERVICE_MANAGEMENT_CATALOG_API_URL: 'http://127.0.0.1:3003'
      }
    }
  ]
};
