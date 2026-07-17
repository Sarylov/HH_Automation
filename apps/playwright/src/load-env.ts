import { config as loadDotenv } from 'dotenv';
import path from 'node:path';

const appRoot = process.cwd();
loadDotenv({ path: path.join(appRoot, '../../.env') });
loadDotenv({ path: path.join(appRoot, '.env'), override: true });
