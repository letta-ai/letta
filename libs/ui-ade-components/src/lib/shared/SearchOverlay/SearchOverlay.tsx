'use client';
import React, { useCallback } from 'react';
import {
  Button,
  CloseIcon,
  HStack,
  RawInput,
  SearchIcon,
} from '@letta-cloud/ui-component-library';
import { useTranslations } from '@letta-cloud/translations';

export interface SearchOverlayProps {
  /**
   * Whether the search overlay is visible
   */
  isVisible: boolean;
  /**
   * Current search value
   */
  value: string;
  /**
   * Callback when search value changes
   */
  onChange: (value: string) => void;
  /**
   * Callback to close the search overlay. Should also clear the search value if needed.
   */
  onClose: () => void;
  /**
   * Placeholder text for the search input (overrides translation default)
   * @default Uses translation key 'SearchOverlay.placeholder'
   */
  placeholder?: string;
  /**
   * Label for the search input (for accessibility, overrides translation default)
   * @default Uses translation key 'SearchOverlay.label'
   */
  label?: string;
  /**
   * Label for the close button (for accessibility, overrides translation default)
   * @default Uses translation key 'SearchOverlay.closeLabel'
   */
  closeLabel?: string;

  /**
   * Test ID for the search input
   */
  testId?: string;
}

/**
 * A generic search overlay component that appears over other content
 * with smooth animations and keyboard shortcuts.
 *
 * Features:
 * - Smooth slide-in animation
 * - Keyboard shortcuts (Escape to close)
 * - Auto-focus on search input
 * - Customizable styling and positioning
 * - Built-in translations with override support
 *
 * @example Basic usage
 * ```tsx
 * const [showSearch, setShowSearch] = useState(false);
 * const [searchValue, setSearchValue] = useState('');
 *
 * return (
 *   <div style={{ position: 'relative' }}>
 *     <SearchOverlay
 *       isVisible={showSearch}
 *       value={searchValue}
 *       onChange={setSearchValue}
 *       onClose={() => {
 *         setShowSearch(false);
 *         setSearchValue(''); // Clear search when closing
 *       }}
 *     />
 *     <Button onClick={() => setShowSearch(true)}>
 *       Show Search
 *     </Button>
 *   </div>
 * );
 * ```
 *
 * @example With custom labels (overrides translations)
 * ```tsx
 * <SearchOverlay
 *   isVisible={showSearch}
 *   value={searchValue}
 *   onChange={setSearchValue}
 *   onClose={() => setShowSearch(false)}
 *   placeholder="Search tools..."
 *   label="Search for tools"
 *   closeLabel="Close tool search"
 * />
 * ```
 *
 * @example With custom styling
 * ```tsx
 * <SearchOverlay
 *   isVisible={showSearch}
 *   value={searchValue}
 *   onChange={setSearchValue}
 *   onClose={() => setShowSearch(false)}
 *   className="custom-search-overlay"
 *   style={{ zIndex: 10 }}
 *   testId="search-input"
 * />
 * ```
 *
 * @example Integration with existing component translations
 * ```tsx
 * function ToolsPanel() {
 *   const t = useTranslations('ADE/Tools');
 *   const [showSearch, setShowSearch] = useState(false);
 *   const [search, setSearch] = useState('');
 *
 *   return (
 *     <div style={{ position: 'relative' }}>
 *       <SearchOverlay
 *         isVisible={showSearch}
 *         value={search}
 *         onChange={setSearch}
 *         onClose={() => setShowSearch(false)}
 *         // Override with existing component translations
 *         placeholder={t('ToolsListPage.search.placeholder')}
 *         label={t('ToolsListPage.search.label')}
 *         closeLabel={t('ToolsListPage.search.close')}
 *       />
 *     </div>
 *   );
 * }
 * ```
 *
 * Required translation keys (namespace: 'SearchOverlay'):
 * - placeholder: "Search..." - Default placeholder text
 * - label: "Search" - Default accessibility label for input
 * - closeLabel: "Close search" - Default accessibility label for close button
 */
export function SearchOverlay(props: SearchOverlayProps) {
  const {
    isVisible,
    value,
    onChange,
    onClose,
    placeholder: placeholderProp,
    label: labelProp,
    closeLabel: closeLabelProp,
    testId,
  } = props;

  const t = useTranslations('SearchOverlay');

  const placeholder = placeholderProp ?? t('placeholder');
  const label = labelProp ?? t('label');
  const closeLabel = closeLabelProp ?? t('closeLabel');

  const handleKeyUp = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Escape') {
        onClose();
      }
    },
    [onClose],
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange(e.target.value);
    },
    [onChange],
  );

  const handleClose = useCallback(() => {
    onChange('');
    onClose();
  }, [onChange, onClose]);

  if (!isVisible) {
    return null;
  }

  return (
    <div
      className={`absolute animate-in z-[1] duration-500 top-0 left-0 top-0 px-2`}
      style={{
        width: 'calc(100% - 37px)'
      }}
    >
      <HStack align="center" color="background-grey" fullWidth>
        <RawInput
          fullWidth
          preIcon={<SearchIcon />}
          variant="tertiary"
          label={label}
          autoFocus
          value={value}
          hideLabel
          onKeyUp={handleKeyUp}
          onChange={handleChange}
          placeholder={placeholder}
          data-testid={testId}
        />
        <div style={{ marginTop: '7px' }}>
          <Button
            hideLabel
            size="xsmall"
            color="tertiary"
            preIcon={<CloseIcon />}
            label={closeLabel}
            onClick={handleClose}
          />
        </div>
      </HStack>
    </div>
  );
}
