import { HStack, SearchIcon } from '@letta-cloud/ui-component-library';
import { cn } from '@letta-cloud/ui-styles';

interface ToolSearchInputProps {
  search: string;
  onSearchChange: (search: string) => void;
  isMobile?: boolean;
  placeholder?: string;
  action?: React.ReactNode;
}

export function ToolSearchInput(props: ToolSearchInputProps) {
  const { search, onSearchChange, placeholder, isMobile, action } = props;

  return (
    <HStack
      align="center"
      className="focus-within:bg-background-grey cursor-pointer focus-within:ring-brand"
      paddingX="small"
      paddingLeft="xlarge"
      height="header-sm"
      borderBottom
      minHeight="header-sm"
      fullWidth
    >
      <SearchIcon />
      <input
        className={cn(
          'w-full h-[35px] bg-transparent ',
          'focus:outline-none ',
          isMobile ? '' : 'text-[12px]',
        )}
        type="text"
        placeholder={placeholder}
        value={search}
        onChange={(e) => {
          onSearchChange(e.target.value);
        }}
      />
      {action}
    </HStack>
  );
}
