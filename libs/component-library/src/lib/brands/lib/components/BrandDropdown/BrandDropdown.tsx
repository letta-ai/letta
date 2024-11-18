import React, { useMemo } from 'react';
import { isMultiValue } from '../../../../core/Select/Select';
import { Select } from '../../../../core/Select/Select';
import { brandKeyToLogo, brandKeyToNameMap, isBrandKey } from '../../utils/brandKeyToName/brandKeyToName';

interface BrandDropdownProps {
  value: string | null;
  onChange: (value: string | null) => void;
}

const brandOptions = Object.entries(brandKeyToNameMap).map(([key, name]) => ({
  value: key,
  label: name,
  icon: isBrandKey(key) ? brandKeyToLogo(key) : undefined,
}));

export function BrandDropdown(props: BrandDropdownProps) {
  const { value: _value, onChange } = props;

  const value = useMemo(() => {
    return brandOptions.find(({ value }) => value === _value)
  }, [_value]);

  return (
    <Select fullWidth label="Brands" options={brandOptions} value={value} onSelect={(response) => {
      if (isMultiValue(response)) {
        return;
      }

      onChange(response?.value ?? null);
    }}
    />
  )
}
