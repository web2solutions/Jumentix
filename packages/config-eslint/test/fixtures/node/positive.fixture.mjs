import { readFileSync } from 'node:fs';

export default function readFirstLine(filePath) {
  return readFileSync(filePath, 'utf8').split('\n')[0];
}
