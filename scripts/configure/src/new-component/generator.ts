import type {
  Tree} from '@nx/devkit';
import { workspaceRoot
} from '@nx/devkit';
import {
  formatFiles,
  generateFiles
} from '@nx/devkit';
import * as path from 'path';
import type { NewComponentGeneratorSchema } from './schema';

export async function newComponentGenerator(
  tree: Tree,
  options: NewComponentGeneratorSchema
) {

  if (!/^[A-Z][a-zA-Z]*$/.test(options.name)) {
    throw new Error('Name must be in PascalCase');
  }

  // check if the component already exists
  if (tree.exists(path.join(workspaceRoot, 'libs/component-library/src/lib', options.name, `${options.name}.tsx`))) {
    throw new Error(`Component ${options.name} already exists`);
  }

  generateFiles(tree, path.join(__dirname, 'files'), path.join(workspaceRoot, 'libs/component-library/src/lib'), options);

  await formatFiles(tree);
}

export default newComponentGenerator;
