import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { Tree, readProjectConfiguration } from '@nx/devkit';

import { buildDesktopAppGenerator } from './build-desktop-app';
import { BuildDesktopAppGeneratorSchema } from './schema';

describe('build-desktop-app generator', () => {
  let tree: Tree;
  const options: BuildDesktopAppGeneratorSchema = { name: 'test' };

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should run successfully', async () => {
    await buildDesktopAppGenerator(tree, options);
    const config = readProjectConfiguration(tree, 'test');
    expect(config).toBeDefined();
  });
});
