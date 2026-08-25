import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(currentDirectory, '../.env') });

autoExport();

function autoExport() {
  if (!process.env.PORT) process.env.PORT = '4000';
  if (!process.env.NODE_ENV) process.env.NODE_ENV = 'development';
}
