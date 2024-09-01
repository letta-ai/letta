import React from 'react';

interface ColorSwatchesProps {
  colors: {
    default: string;
    foreground?: string;
    dark?: string;
    light?: string;
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
  foreground: '',
  dark: '',
  light: '',
};

function ColorSwatches({ colors, name, notes }: ColorSwatchesProps) {
  return (
    <tr className="">
      <td className="text-sm! font-semibold">{name}</td>
      {Object.values({ ...baseColors, ...colors }).map((color) => (
        <td className="text-center">
          {color ? <ColorSwatch key={color} color={color} /> : 'N/A'}
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
            <th>Foreground</th>
            <th>Dark</th>
            <th>Light</th>
            <th>Notes</th>
          </tr>
        </thead>
        <tbody>
          <ColorSwatches
            colors={{
              default: 'bg-primary',
              foreground: 'bg-primary-foreground',
              light: 'bg-primary-light',
            }}
            name="Primary"
          />
          <ColorSwatches
            colors={{
              default: 'bg-secondary',
              foreground: 'bg-secondary-foreground',
              light: 'bg-secondary-light',
            }}
            name="Secondary"
          />
          <ColorSwatches
            colors={{
              default: 'bg-tertiary',
              foreground: 'bg-tertiary-foreground',
              dark: 'bg-tertiary-dark',
              light: 'bg-tertiary-light',
            }}
            name="Tertiary"
          />
          <ColorSwatches
            colors={{
              default: 'bg-background',
              foreground: 'bg-foreground',
              light: 'bg-background-light',
            }}
            name="Background"
            notes="Used for the background in the app"
          />
          <ColorSwatches
            colors={{
              default: 'bg-background-grey',
              foreground: 'bg-background-grey-foreground',
            }}
            name="Background Grey"
            notes="Used for grey backgrounds in the app"
          />
          <ColorSwatches
            colors={{
              default: 'bg-background-greyer',
              foreground: 'bg-background-greyer-foreground',
            }}
            name="Background Greyer"
            notes="Used for even more grey backgrounds in the app"
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
              foreground: 'bg-muted-foreground',
            }}
            name="Muted"
            notes="Used for disabled states"
          />
          <ColorSwatches
            colors={{
              default: 'bg-warning',
              foreground: 'bg-warning-foreground',
            }}
            name="Warning"
          />
          <ColorSwatches
            colors={{
              default: 'bg-background-warning',
              foreground: 'bg-background-warning-foreground',
            }}
            name="Background Warning"
          />
          <ColorSwatches
            colors={{
              default: 'bg-destructive',
              foreground: 'bg-destructive-foreground',
            }}
            name="Destructive"
          />
        </tbody>
      </table>
    </div>
  );
}
