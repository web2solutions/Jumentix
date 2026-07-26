const fs = require('fs');
const path = require('path');

const packageRoot = path.resolve(__dirname, '..');
const source = path.resolve(packageRoot, '../../spec/asyncapi/async-api.proto');
const destination = path.resolve(packageRoot, 'dist/proto/async-api.proto');

if (!fs.existsSync(source)) {
  throw new Error(`Canonical gRPC proto artifact not found: ${source}`);
}

fs.mkdirSync(path.dirname(destination), { recursive: true });
fs.copyFileSync(source, destination);
