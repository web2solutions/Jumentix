module.exports = {
  apps: [
    {
      name: 'jumentix-staging-restapi',
      script: './apps/backend-template/src/interface/HTTP/adapters/start-rest-api.ts',
      interpreter: 'bun',
      interpreter_args: '-r tsconfig-paths/register --env-file=./apps/backend-template/src/config/.env.staging',
      env: {
        NODE_ENV: 'staging',
        JUMENTIX_HTTP_PORT: '4000'
      }
    },
    {
      name: 'jumentix-staging-websocketapi',
      script: './apps/backend-template/src/interface/WebSocket/adapters/start-websocket-api.ts',
      interpreter: 'bun',
      interpreter_args: '-r tsconfig-paths/register --env-file=./apps/backend-template/src/config/.env.staging',
      env: {
        NODE_ENV: 'staging',
        JUMENTIX_WEBSOCKET_PORT: '4001',
        JUMENTIX_REALTIME_API: 'yes',
        JUMENTIX_REALTIME_API_PROTOCOL: 'websocket',
        JUMENTIX_DISABLE_FALLBACK_REST: 'true'
      }
    },
    {
      name: 'jumentix-staging-grpcapi',
      script: './apps/backend-template/src/interface/gRPC/adapters/start-grpc-api.ts',
      interpreter: 'bun',
      interpreter_args: '-r tsconfig-paths/register --env-file=./apps/backend-template/src/config/.env.staging',
      env: {
        NODE_ENV: 'staging',
        JUMENTIX_GRPC_PORT: '4002',
        JUMENTIX_REALTIME_API: 'yes',
        JUMENTIX_REALTIME_API_PROTOCOL: 'grpc',
        JUMENTIX_DISABLE_FALLBACK_REST: 'true'
      }
    },
    {
      name: 'jumentix-staging-service-management',
      script: './apps/service-management/server.js',
      interpreter: 'bun',
      env: {
        NODE_ENV: 'staging',
        JUMENTIX_SERVICE_MANAGEMENT_PORT: '4200'
      }
    }
  ]
};
