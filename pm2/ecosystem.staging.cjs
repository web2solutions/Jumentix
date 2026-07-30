module.exports = {
  apps: [
    {
      name: 'aaa-staging-restapi',
      script: './apps/backend-template/src/interface/HTTP/adapters/start-rest-api.ts',
      interpreter: 'bun',
      interpreter_args: '-r tsconfig-paths/register --env-file=./apps/backend-template/src/config/.env.staging',
      env: {
        NODE_ENV: 'staging',
        AAA_HTTP_PORT: '4000'
      }
    },
    {
      name: 'aaa-staging-websocketapi',
      script: './apps/backend-template/src/interface/WebSocket/adapters/start-websocket-api.ts',
      interpreter: 'bun',
      interpreter_args: '-r tsconfig-paths/register --env-file=./apps/backend-template/src/config/.env.staging',
      env: {
        NODE_ENV: 'staging',
        AAA_WEBSOCKET_PORT: '4001',
        AAA_REALTIME_API: 'yes',
        AAA_REALTIME_API_PROTOCOL: 'websocket',
        AAA_DISABLE_FALLBACK_REST: 'true'
      }
    },
    {
      name: 'aaa-staging-grpcapi',
      script: './apps/backend-template/src/interface/gRPC/adapters/start-grpc-api.ts',
      interpreter: 'bun',
      interpreter_args: '-r tsconfig-paths/register --env-file=./apps/backend-template/src/config/.env.staging',
      env: {
        NODE_ENV: 'staging',
        AAA_GRPC_PORT: '4002',
        AAA_REALTIME_API: 'yes',
        AAA_REALTIME_API_PROTOCOL: 'grpc',
        AAA_DISABLE_FALLBACK_REST: 'true'
      }
    },
    {
      name: 'aaa-staging-service-management',
      script: './apps/service-management/server.js',
      interpreter: 'bun',
      env: {
        NODE_ENV: 'staging',
        AAA_SERVICE_MANAGEMENT_PORT: '4200'
      }
    }
  ]
};
