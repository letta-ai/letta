import type { Tree } from '@nx/devkit';
import { formatFiles, generateFiles } from '@nx/devkit';
import * as path from 'path';
import type { NewComponentGeneratorSchema } from './schema';

export async function newComponentGenerator(
  tree: Tree,
  options: NewComponentGeneratorSchema
) {
  if (!/^[A-Z][a-zA-Z]*$/.test(options.name)) {
    throw new Error('Name must be in PascalCase');
  }

  // add the component to the index.ts file
  const indexContent = tree
    .read('libs/ui-component-library/src/index.tsx')
    ?.toString();

  if (!indexContent) {
    throw new Error('Could not find index.tsx file');
  }

  // check if the component already exists
  if (
    tree.exists(
      path.join(
        'libs/ui-component-library/src/lib',
        options.name,
        `${options.name}.tsx`
      )
    )
  ) {
    throw new Error(`Component ${options.name} already exists`);
  }

  generateFiles(
    tree,
    path.join(__dirname, 'files'),
    path.join('libs/ui-component-library/src/lib'),
    options
  );

  const newContents = `${indexContent}\nexport * from './lib/${options.category}/${options.name}/${options.name}';`;

  tree.write('libs/ui-component-library/src/index.tsx', newContents);

  await formatFiles(tree);
}

export default newComponentGenerator;
