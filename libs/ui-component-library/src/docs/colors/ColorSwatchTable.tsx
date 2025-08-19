import React from 'react';

interface ColorSwatchesProps {
  colors: {
    default: string;
    content?: string;
    active?: string;
    hover?: string;
  };
  notes?: string;
  name: string;
}

interface ColorSwatchProps {
  color: string;
}

function ColorSwatch({ color }: ColorSwatchProps) {
  return (
    <div className="">
      <div
        className={`w-[25px] h-[25px] border  ${color}`}
        style={{ width: '100px', height: '100px', borderRadius: '12px' }}
      />
    </div>
  );
}

const baseColors: ColorSwatchesProps['colors'] = {
  default: '',
  content: '',
  active: '',
  hover: '',
};

function ColorSwatches({ colors, name, notes }: ColorSwatchesProps) {
  return (
    <tr className="">
      <td className="text-sm! font-semibold">{name}</td>
      {Object.values({ ...baseColors, ...colors }).map((color, index) => (
        <td key={color || `empty-${index}`} className="text-center">
          {color ? <ColorSwatch color={color} /> : 'N/A'}
        </td>
      ))}
      <td className="text-left">{notes}</td>
    </tr>
  );
}

export function ColorSwatchTable() {
  const [darkMode, setDarkMode] = React.useState(false);

  return (
    <div>
      <div>
        <label className="text-sm! font-medium flex gap-2 border rounded-sm py-2 px-3">
          <input
            type="checkbox"
            checked={darkMode}
            onChange={() => setDarkMode(!darkMode)}
          />
          Show dark mode colors
        </label>
      </div>
      <table className={darkMode ? 'dark' : ''}>
        <thead>
          <tr>
            <th></th>
            <th>Default</th>
            <th>Content</th>
            <th>Active</th>
            <th>Hover</th>
            <th>Notes</th>
          </tr>
        </thead>
        <tbody>
          <ColorSwatches
            colors={{
              default: 'bg-brand',
              content: 'bg-brand-content',
              hover: 'bg-brand-hover',
            }}
            name="Primary"
          />
          <ColorSwatches
            colors={{
              default: 'bg-primary',
              content: 'bg-primary-content',
              hover: 'bg-primary-hover',
            }}
            name="Secondary"
          />
          <ColorSwatches
            colors={{
              default: 'bg-secondary',
              content: 'bg-secondary-content',
              active: 'bg-secondary-active',
              hover: 'bg-secondary-hover',
            }}
            name="Tertiary"
          />
          <ColorSwatches
            colors={{
              default: 'bg-background',
              content: 'bg-content',
              hover: 'bg-background-hover',
            }}
            name="Background"
            notes="Used for the background in the app"
          />
          <ColorSwatches
            colors={{
              default: 'bg-background-grey',
              content: 'bg-background-grey-content',
              hover: 'bg-background-grey-hover',
            }}
            name="Background Grey"
            notes="Used for grey backgrounds in the app"
          />
          <ColorSwatches
            colors={{
              default: 'bg-background-grey2',
              content: 'bg-background-grey2-content',
            }}
            name="Background Greyer"
            notes="Used for even more grey backgrounds in the app"
          />
          <ColorSwatches
            colors={{
              default: 'bg-background-black',
              content: 'bg-background-black-content',
              hover: 'bg-background-black-hover',
            }}
            name="Background Black"
            notes="Used for black backgrounds in the app"
          />
          <ColorSwatches
            colors={{
              default: 'bg-border',
            }}
            name="Border"
          />
          <ColorSwatches
            colors={{
              default: 'bg-ring',
            }}
            name="Ring"
            notes="Used for focus states"
          />
          <ColorSwatches
            colors={{
              default: 'bg-muted',
              content: 'bg-muted-content',
            }}
            name="Muted"
            notes="Used for disabled states"
          />
          <ColorSwatches
            colors={{
              default: 'bg-warning',
              content: 'bg-warning-content',
            }}
            name="Warning"
          />
          <ColorSwatches
            colors={{
              default: 'bg-background-warning',
              content: 'bg-background-warning-content',
            }}
            name="Background Warning"
          />
          <ColorSwatches
            colors={{
              default: 'bg-destructive',
              content: 'bg-destructive-content',
            }}
            name="Destructive"
          />
        </tbody>
      </table>
    </div>
  );
}
