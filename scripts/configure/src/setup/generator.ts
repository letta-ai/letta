import type {
  Tree} from '@nx/devkit';
import {
  generateFiles,
} from '@nx/devkit';
import * as path from 'path';
import type { SetupGeneratorSchema } from './schema';

const LOCAL_DEFAULT_OPTIONS: SetupGeneratorSchema = {
  DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/letta',
  GOOGLE_CLIENT_ID: '',
  GOOGLE_CLIENT_SECRET: '',
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
    DATABASE_URL: options.DATABASE_URL || LOCAL_DEFAULT_OPTIONS.DATABASE_URL,
    GOOGLE_CLIENT_ID: options.GOOGLE_CLIENT_ID || LOCAL_DEFAULT_OPTIONS.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: options.GOOGLE_CLIENT_SECRET || LOCAL_DEFAULT_OPTIONS.GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI: options.GOOGLE_REDIRECT_URI || LOCAL_DEFAULT_OPTIONS.GOOGLE_REDIRECT_URI,
    REDIS_HOST: options.REDIS_HOST || LOCAL_DEFAULT_OPTIONS.REDIS_HOST,
    REDIS_PASSWORD: options.REDIS_PASSWORD || LOCAL_DEFAULT_OPTIONS.REDIS_PASSWORD,
    REDIS_PORT: options.REDIS_PORT || LOCAL_DEFAULT_OPTIONS.REDIS_PORT,
    LETTA_AGENTS_ENDPOINT: options.LETTA_AGENTS_ENDPOINT || LOCAL_DEFAULT_OPTIONS.LETTA_AGENTS_ENDPOINT,
    NEXT_PUBLIC_CURRENT_HOST: options.NEXT_PUBLIC_CURRENT_HOST || LOCAL_DEFAULT_OPTIONS.NEXT_PUBLIC_CURRENT_HOST,
  });

}

export default setupGenerator;
