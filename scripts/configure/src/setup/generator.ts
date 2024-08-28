import type {
  Tree} from '@nx/devkit';
import {
  addProjectConfiguration,
  formatFiles,
  generateFiles,
  workspaceRoot,
} from '@nx/devkit';
import * as path from 'path';
import type { SetupGeneratorSchema } from './schema';




export async function setupGenerator(
  tree: Tree,
  options: SetupGeneratorSchema
) {
  // generates the .env file for the database
  generateFiles(tree, path.join(__dirname, 'files'), path.join('libs', 'database'), options);

}

export default setupGenerator;
