import React from 'react';

interface ColorSwatchesProps {
  colors: {
    default: string;
    foreground: string;
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

function ColorSwatches({ colors, name, notes }: ColorSwatchesProps) {
  return (
    <tr className="">
      <td className="text-sm! font-semibold">{name}</td>
      {Object.values(colors).map((color) => (
        <td className="text-center">
          {color ? <ColorSwatch key={color} color={color} /> : 'N/A'}
        </td>
      ))}
      <td className="text-left">{notes}</td>
    </tr>
  );
}

export function ColorSwatchTable() {
  return (
    <table className="border-none">
      <thead>
        <tr>
          <th></th>
          <th>Default</th>
          <th>Foreground</th>
          <th>Notes</th>
        </tr>
      </thead>
      <tbody>
        <ColorSwatches
          colors={{
            default: 'bg-primary',
            foreground: 'bg-primary-foreground',
          }}
          name="Primary"
        />
        <ColorSwatches
          colors={{
            default: 'bg-secondary',
            foreground: 'bg-secondary-foreground',
          }}
          name="Secondary"
        />
        <ColorSwatches
          colors={{
            default: 'bg-tertiary',
            foreground: 'bg-tertiary-foreground',
          }}
          name="Tertiary"
        />
        <ColorSwatches
          colors={{
            default: 'bg-background',
            foreground: 'bg-foreground',
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
            default: 'bg-warning-highlight',
            foreground: 'bg-warning-highlight-foreground',
          }}
          name="Warning Highlight"
        />
      </tbody>
    </table>
  );
}
