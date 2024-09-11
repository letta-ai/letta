import type {
  Tree} from '@nx/devkit';
import {
  generateFiles,
} from '@nx/devkit';
import * as path from 'path';
import type { SetupGeneratorSchema } from './schema';

const LOCAL_DEFAULT_OPTIONS: SetupGeneratorSchema = {
  DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/letta',
  GOOGLE_CLIENT_ID: 'google-client-id',
  GOOGLE_CLIENT_SECRET: 'google-client-secret',
  GOOGLE_REDIRECT_URI: 'http://localhost:3000/api/auth/google/callback',
  REDIS_HOST: 'localhost',
  REDIS_PASSWORD: '',
  REDIS_PORT: '6379',
  LETTA_AGENTS_ENDPOINT: 'http://localhost:8283',
  NEXT_PUBLIC_CURRENT_HOST: 'http://localhost:3000',
}


export async function setupGenerator(
  tree: Tree,
  options: SetupGeneratorSchema
) {
  // generates the .env file for the database
  generateFiles(tree, path.join(__dirname, 'files'), path.join('.'), {
    ...LOCAL_DEFAULT_OPTIONS,
    options,
  });

}

export default setupGenerator;
