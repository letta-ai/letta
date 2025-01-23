import type { Meta, StoryObj } from '@storybook/react';
import { VerticalDelineatedTextChunker } from './VerticalDelineatedTextChunker';

const meta: Meta<typeof VerticalDelineatedTextChunker> = {
  component: VerticalDelineatedTextChunker,
  title: 'core/VerticalDelinatedTextChunker',
};

export default meta;
type Story = StoryObj<typeof VerticalDelineatedTextChunker>;

export const Primary: Story = {
  args: {
    chunks: [
      {
        id: 'main',
        label: 'Main',
        color: 'red',
        size: 500,
        text:
          'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Maecenas volutpat lectus ut ipsum ultrices, tincidunt vestibulum enim bibendum. Nulla nisi libero, rutrum tincidunt ex vitae, fermentum ultricies quam. Sed quis cursus ante. Fusce volutpat magna et felis rhoncus, ut venenatis nunc efficitur. Fusce tempor dolor id justo sagittis, sit amet aliquam enim feugiat. Nulla in porttitor leo. Maecenas ex ex, pulvinar in enim quis, congue gravida est. Quisque ac lectus vel neque cursus ornare. Aenean non diam nisi. Nullam tempor convallis leo, rhoncus aliquam justo interdum non. Suspendisse leo eros, scelerisque a dolor vitae, tristique porttitor arcu. Sed fringilla nibh vitae congue sagittis.\n' +
          '\n' +
          'Aliquam imperdiet nisl sed metus ultrices lacinia. Duis luctus nulla nec bibendum dictum. Etiam varius, elit et condimentum tincidunt, diam quam tincidunt tellus, nec vulputate velit neque ac odio. Nulla ornare sem at nulla semper iaculis. Ut auctor diam ut cursus commodo. Duis ultrices et erat eget fringilla. In ac nibh eleifend, ultrices turpis sit amet, dignissim odio. Nulla volutpat sem ac metus ornare lobortis. Quisque ut congue elit, nec venenatis dolor. Nullam fringilla felis eu turpis lacinia, in porta magna venenatis. Suspendisse euismod nisl non sollicitudin aliquam. Nam ut urna ipsum. Cras luctus augue ultrices quam maximus, ac lacinia sapien malesuada. Aenean non arcu eget lacus rhoncus ornare. Morbi mollis arcu eu dui consequat suscipit.\n' +
          '\n',
      },
      {
        id: 'secondary',
        label: 'Secondary',
        color: 'blue',
        size: 250,
        text:
          'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Maecenas volutpat lectus ut ipsum ultrices, tincidunt vestibulum enim bibendum. Nulla nisi libero, rutrum tincidunt ex vitae, fermentum ultricies quam. Sed quis cursus ante. Fusce volutpat magna et felis rhoncus, ut venenatis nunc efficitur. Fusce tempor dolor id justo sagittis, sit amet aliquam enim feugiat. Nulla in porttitor leo. Maecenas ex ex, pulvinar in enim quis, congue gravida est. Quisque ac lectus vel neque cursus ornare. Aenean non diam nisi. Nullam tempor convallis leo, rhoncus aliquam justo interdum non. Suspendisse leo eros, scelerisque a dolor vitae, tristique porttitor arcu. Sed fringilla nibh vitae congue sagittis.\n' +
          '\n' +
          'Aliquam imperdiet nisl sed metus ultrices lacinia. Duis luctus nulla nec bibendum dictum. Etiam varius, elit et condimentum tincidunt, diam quam tincidunt tellus, nec vulputate velit neque ac odio. Nulla ornare sem at nulla semper iaculis. Ut auctor diam ut cursus commodo. Duis ultrices et erat eget fringilla. In ac nibh eleifend, ultrices turpis sit amet, dignissim odio. Nulla volutpat sem ac metus ornare lobortis. Quisque ut congue elit, nec venenatis dolor. Nullam fringilla felis eu turpis lacinia, in porta magna venenatis. Suspendisse euismod nisl non sollicitudin aliquam. Nam ut urna ipsum. Cras luctus augue ultrices quam maximus, ac lacinia sapien malesuada. Aenean non arcu eget lacus rhoncus ornare. Morbi mollis arcu eu dui consequat suscipit.\n' +
          '\n',
      },
      {
        id: 'tertiary',
        label: 'Tertiary',
        color: 'green',
        size: 1000,
        text:
          'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Maecenas volutpat lectus ut ipsum ultrices, tincidunt vestibulum enim bibendum. Nulla nisi libero, rutrum tincidunt ex vitae, fermentum ultricies quam. Sed quis cursus ante. Fusce volutpat magna et felis rhoncus, ut venenatis nunc efficitur. Fusce tempor dolor id justo sagittis, sit amet aliquam enim feugiat. Nulla in porttitor leo. Maecenas ex ex, pulvinar in enim quis, congue gravida est. Quisque ac lectus vel neque cursus ornare. Aenean non diam nisi. Nullam tempor convallis leo, rhoncus aliquam justo interdum non. Suspendisse leo eros, scelerisque a dolor vitae, tristique porttitor arcu. Sed fringilla nibh vitae congue sagittis.\n' +
          '\n' +
          'Aliquam imperdiet nisl sed metus ultrices lacinia. Duis luctus nulla nec bibendum dictum. Etiam varius, elit et condimentum tincidunt, diam quam tincidunt tellus, nec vulputate velit neque ac odio. Nulla ornare sem at nulla semper iaculis. Ut auctor diam ut cursus commodo. Duis ultrices et erat eget fringilla. In ac nibh eleifend, ultrices turpis sit amet, dignissim odio. Nulla volutpat sem ac metus ornare lobortis. Quisque ut congue elit, nec venenatis dolor. Nullam fringilla felis eu turpis lacinia, in porta magna venenatis. Suspendisse euismod nisl non sollicitudin aliquam. Nam ut urna ipsum. Cras luctus augue ultrices quam maximus, ac lacinia sapien malesuada. Aenean non arcu eget lacus rhoncus ornare. Morbi mollis arcu eu dui consequat suscipit.\n' +
          '\n',
      },
      {
        id: 'quaternary',
        label: 'Quaternary',
        color: 'orange',
        size: 750,
        text:
          'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Maecenas volutpat lectus ut ipsum ultrices, tincidunt vestibulum enim bibendum. Nulla nisi libero, rutrum tincidunt ex vitae, fermentum ultricies quam. Sed quis cursus ante. Fusce volutpat magna et felis rhoncus, ut venenatis nunc efficitur. Fusce tempor dolor id justo sagittis, sit amet aliquam enim feugiat. Nulla in porttitor leo. Maecenas ex ex, pulvinar in enim quis, congue gravida est. Quisque ac lectus vel neque cursus ornare. Aenean non diam nisi. Nullam tempor convallis leo, rhoncus aliquam justo interdum non. Suspendisse leo eros, scelerisque a dolor vitae, tristique porttitor arcu. Sed fringilla nibh vitae congue sagittis.\n' +
          '\n' +
          'Aliquam imperdiet nisl sed metus ultrices lacinia. Duis luctus nulla nec bibendum dictum. Etiam varius, elit et condimentum tincidunt, diam quam tincidunt tellus, nec vulputate velit neque ac odio. Nulla ornare sem at nulla semper iaculis. Ut auctor diam ut cursus commodo. Duis ultrices et erat eget fringilla. In ac nibh eleifend, ultrices turpis sit amet, dignissim odio. Nulla volutpat sem ac metus ornare lobortis. Quisque ut congue elit, nec venenatis dolor. Nullam fringilla felis eu turpis lacinia, in porta magna venenatis. Suspendisse euismod nisl non sollicitudin aliquam. Nam ut urna ipsum. Cras luctus augue ultrices quam maximus, ac lacinia sapien malesuada. Aenean non arcu eget lacus rhoncus ornare. Morbi mollis arcu eu dui consequat suscipit.\n' +
          '\n',
      },
      {
        id: 'unused',
        label: 'Unused',
        color: 'purple',
        size: 250,
      },
    ],
  },
};
