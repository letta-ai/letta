import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { Tree, readProjectConfiguration } from '@nx/devkit';

import { buildPythonAppGenerator } from './build-python-app';
import { BuildPythonAppGeneratorSchema } from './schema';

describe('build-python-app generator', () => {
  let tree: Tree;
  const options: BuildPythonAppGeneratorSchema = { name: 'test' };

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should run successfully', async () => {
    await buildPythonAppGenerator(tree, options);
    const config = readProjectConfiguration(tree, 'test');
    expect(config).toBeDefined();
  });
});
