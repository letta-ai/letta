import type { Meta, StoryObj } from '@storybook/react';
import { Input } from './Input';
import { generateWrapWithFormContext } from '../../../helpers';
import {
  SearchIcon,
  PersonIcon,
  KeyIcon,
  MailIcon,
  CreditCardIcon,
  CalendarIcon,
  PhoneIcon,
  EarthIcon,
} from '../../icons';

const formContextDecorator = generateWrapWithFormContext({
  alternativeText: 'Use <RawInput /> instead if you dont need the Form',
});

const meta: Meta<typeof Input> = {
  component: Input,
  title: 'Core/Input',
  argTypes: {
    size: {
      control: { type: 'select' },
      options: ['small', 'default', 'large'],
    },
    variant: {
      control: { type: 'select' },
      options: ['primary', 'secondary'],
    },
    color: {
      control: { type: 'select' },
      options: ['transparent', 'default', 'grey'],
    },
    width: {
      control: { type: 'select' },
      options: ['medium', 'large', undefined],
    },
    fullWidth: {
      control: { type: 'boolean' },
    },
    disabled: {
      control: { type: 'boolean' },
    },
    readOnly: {
      control: { type: 'boolean' },
    },
    warned: {
      control: { type: 'boolean' },
    },
    allowCopy: {
      control: { type: 'boolean' },
    },
    showVisibilityControls: {
      control: { type: 'boolean' },
    },
    isUpdating: {
      control: { type: 'boolean' },
    },
  },
};

export default meta;
type Story = StoryObj<typeof Input>;

export function Default() {
  return (
    <Input
      label="Username"
      placeholder="Enter your username"
      infoTooltip={{ text: 'Your unique username' }}
    />
  );
}
Default.decorators = [formContextDecorator];

export function WithPreIcon() {
  return (
    <Input
      label="Email"
      placeholder="Enter your email"
      preIcon={<MailIcon />}
      type="email"
    />
  );
}
WithPreIcon.decorators = [formContextDecorator];

export function WithPostIcon() {
  return (
    <Input label="Search" placeholder="Search..." postIcon={<SearchIcon />} />
  );
}
WithPostIcon.decorators = [formContextDecorator];

export function WithBothIcons() {
  return (
    <Input
      label="Username"
      placeholder="Enter username"
      preIcon={<PersonIcon />}
      postIcon={<SearchIcon />}
    />
  );
}
WithBothIcons.decorators = [formContextDecorator];

export function Password() {
  return (
    <Input
      label="Password"
      placeholder="Enter your password"
      type="password"
      preIcon={<KeyIcon />}
      showVisibilityControls
    />
  );
}
Password.decorators = [formContextDecorator];

export function WithCopyButton() {
  return (
    <Input
      label="API Key"
      value="sk-1234567890abcdef"
      readOnly
      allowCopy
      preIcon={<KeyIcon />}
    />
  );
}
WithCopyButton.decorators = [formContextDecorator];

export function Numeric() {
  return (
    <Input
      label="Amount"
      placeholder="0.00"
      type="number"
      preIcon={<CreditCardIcon />}
      onNumericValueChange={(value) => {
        console.log('Numeric value:', value);
      }}
    />
  );
}
Numeric.decorators = [formContextDecorator];

export function Loading() {
  return (
    <Input
      label="Loading State"
      placeholder="Checking availability..."
      isUpdating
      preIcon={<PersonIcon />}
    />
  );
}
Loading.decorators = [formContextDecorator];

export function Disabled() {
  return (
    <Input
      label="Disabled Input"
      value="Cannot edit this"
      disabled
      preIcon={<KeyIcon />}
    />
  );
}
Disabled.decorators = [formContextDecorator];

export function ReadOnly() {
  return (
    <Input
      label="Read Only"
      value="Read only value"
      readOnly
      preIcon={<KeyIcon />}
    />
  );
}
ReadOnly.decorators = [formContextDecorator];

export function Warned() {
  return (
    <Input
      label="Username"
      placeholder="This username may be taken"
      warned
      preIcon={<PersonIcon />}
      infoTooltip={{ text: 'This username may already be in use' }}
    />
  );
}
Warned.decorators = [formContextDecorator];

export function SizeSmall() {
  return (
    <Input
      label="Small Input"
      placeholder="Small size"
      size="small"
      preIcon={<PersonIcon />}
    />
  );
}
SizeSmall.decorators = [formContextDecorator];

export function SizeDefault() {
  return (
    <Input
      label="Default Input"
      placeholder="Default size"
      size="default"
      preIcon={<PersonIcon />}
    />
  );
}
SizeDefault.decorators = [formContextDecorator];

export function SizeLarge() {
  return (
    <Input
      label="Large Input"
      placeholder="Large size"
      size="large"
      preIcon={<PersonIcon />}
    />
  );
}
SizeLarge.decorators = [formContextDecorator];

export function VariantPrimary() {
  return (
    <Input
      label="Primary Variant"
      placeholder="Primary text style"
      variant="primary"
    />
  );
}
VariantPrimary.decorators = [formContextDecorator];

export function VariantSecondary() {
  return (
    <Input
      label="Secondary Variant"
      placeholder="Secondary text style"
      variant="secondary"
    />
  );
}
VariantSecondary.decorators = [formContextDecorator];

export function ColorTransparent() {
  return (
    <Input
      label="Transparent Background"
      placeholder="Transparent color"
      color="transparent"
      preIcon={<EarthIcon />}
    />
  );
}
ColorTransparent.decorators = [formContextDecorator];

export function ColorDefault() {
  return (
    <Input
      label="Default Background"
      placeholder="Default color"
      color="default"
      preIcon={<PersonIcon />}
    />
  );
}
ColorDefault.decorators = [formContextDecorator];

export function ColorGrey() {
  return (
    <Input
      label="Grey Background"
      placeholder="Grey color"
      color="grey"
      preIcon={<CalendarIcon />}
    />
  );
}
ColorGrey.decorators = [formContextDecorator];

export function WidthMedium() {
  return (
    <Input
      label="Medium Width"
      placeholder="400px max width"
      width="medium"
      preIcon={<PersonIcon />}
    />
  );
}
WidthMedium.decorators = [formContextDecorator];

export function WidthLarge() {
  return (
    <Input
      label="Large Width"
      placeholder="600px max width"
      width="large"
      preIcon={<MailIcon />}
    />
  );
}
WidthLarge.decorators = [formContextDecorator];

export function FullWidth() {
  return (
    <Input
      label="Full Width"
      placeholder="Takes full container width"
      fullWidth
      preIcon={<SearchIcon />}
    />
  );
}
FullWidth.decorators = [formContextDecorator];

export function WithBottomContent() {
  return (
    <Input
      label="With Helper Text"
      placeholder="Enter value"
      bottomContent={
        <span className="text-sm text-muted-content">
          This is helper text below the input
        </span>
      }
      preIcon={<PersonIcon />}
    />
  );
}
WithBottomContent.decorators = [formContextDecorator];

export function ComplexExample() {
  return (
    <div className="space-y-4">
      <Input
        label="Phone Number"
        placeholder="+1 (555) 000-0000"
        type="tel"
        preIcon={<PhoneIcon />}
        size="large"
        width="medium"
      />
      <Input
        label="Email Address"
        placeholder="user@example.com"
        type="email"
        preIcon={<PersonIcon />}
        postIcon={<SearchIcon />}
        variant="secondary"
      />
      <Input
        label="API Secret"
        value="sk-proj-abcdef1234567890"
        readOnly
        allowCopy
        preIcon={<KeyIcon />}
        color="grey"
      />
    </div>
  );
}
ComplexExample.decorators = [formContextDecorator];

export function HiddenLabel() {
  return (
    <Input
      label="Hidden Label Input"
      placeholder="Label is hidden but still accessible"
      hideLabel
      preIcon={<SearchIcon />}
    />
  );
}
HiddenLabel.decorators = [formContextDecorator];

export function WithoutLabel() {
  return <Input placeholder="No label provided" preIcon={<PersonIcon />} />;
}
WithoutLabel.decorators = [formContextDecorator];

export function CombinedFeatures() {
  return (
    <div className="space-y-4">
      <Input
        label="Password with all features"
        placeholder="Enter secure password"
        type="password"
        showVisibilityControls
        preIcon={<KeyIcon />}
        size="large"
        width="medium"
        infoTooltip={{ text: 'Password must be at least 8 characters' }}
      />
      <Input
        label="Loading search"
        placeholder="Searching..."
        preIcon={<SearchIcon />}
        isUpdating
        warned
        variant="secondary"
        color="grey"
      />
      <Input
        label="Readonly with copy"
        value="Important value to copy"
        readOnly
        allowCopy
        preIcon={<KeyIcon />}
        postIcon={<MailIcon />}
        fullWidth
      />
    </div>
  );
}
CombinedFeatures.decorators = [formContextDecorator];

export const Playground: Story = {
  args: {
    label: 'Playground Input',
    placeholder: 'Try different props...',
    size: 'default',
    variant: 'primary',
    color: 'default',
    fullWidth: false,
    disabled: false,
    readOnly: false,
    warned: false,
    allowCopy: false,
    showVisibilityControls: false,
    isUpdating: false,
    hideLabel: false,
    type: 'text',
    infoTooltip: { text: 'Experiment with different prop combinations' },
  },
  decorators: [formContextDecorator],
};
