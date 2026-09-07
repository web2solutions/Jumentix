module.exports = {
  apps: [
    {
      name: 'jumentix-prod-restapi',
      script: './.build/apps/backend-template/src/interface/HTTP/adapters/start-rest-api.js',
      interpreter: 'bun',
      interpreter_args: '--env-file=./.build/apps/backend-template/src/config/.env.prod',
      env: {
        NODE_ENV: 'prod',
        JUMENTIX_HTTP_PORT: '5000'
      }
    },
    {
      name: 'jumentix-prod-websocketapi',
      script: './.build/apps/backend-template/src/interface/WebSocket/adapters/start-websocket-api.js',
      interpreter: 'bun',
      interpreter_args: '--env-file=./.build/apps/backend-template/src/config/.env.prod',
      env: {
        NODE_ENV: 'prod',
        JUMENTIX_WEBSOCKET_PORT: '5001',
        JUMENTIX_REALTIME_API: 'yes',
        JUMENTIX_REALTIME_API_PROTOCOL: 'websocket',
        JUMENTIX_DISABLE_FALLBACK_REST: 'true'
      }
    },
    {
      name: 'jumentix-prod-grpcapi',
      script: './.build/apps/backend-template/src/interface/gRPC/adapters/start-grpc-api.js',
      interpreter: 'bun',
      interpreter_args: '--env-file=./.build/apps/backend-template/src/config/.env.prod',
      env: {
        NODE_ENV: 'prod',
        JUMENTIX_GRPC_PORT: '5002',
        JUMENTIX_REALTIME_API: 'yes',
        JUMENTIX_REALTIME_API_PROTOCOL: 'grpc',
        JUMENTIX_DISABLE_FALLBACK_REST: 'true'
      }
    },
    {
      name: 'jumentix-prod-service-management-api',
      script: './.build/apps/service-management-api/src/start-service-management-catalog-api.js',
      interpreter: 'bun',
      interpreter_args: '--env-file=./.build/apps/backend-template/src/config/.env.prod',
      env: {
        NODE_ENV: 'prod',
        JUMENTIX_HTTP_PORT: '5003'
      }
    },
    {
      name: 'jumentix-prod-service-management',
      script: './apps/service-management/server.js',
      interpreter: 'bun',
      env: {
        NODE_ENV: 'prod',
        JUMENTIX_SERVICE_MANAGEMENT_PORT: '5200',
        JUMENTIX_SERVICE_MANAGEMENT_CATALOG_API_URL: 'http://127.0.0.1:5003'
      }
    }
  ]
};
