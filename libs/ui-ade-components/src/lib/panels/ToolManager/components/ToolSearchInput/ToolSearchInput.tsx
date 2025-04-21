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
    <HStack paddingX="small">
      <HStack
        align="center"
        className="focus-within:border-b-brand pt-3  pb-1 cursor-pointer focus-within:ring-brand"
        borderBottom
        fullWidth
      >
        <input
          className={cn(
            'w-full   bg-transparent ',
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
        <SearchIcon size="medium" />
        {action}
      </HStack>
    </HStack>
  );
}
