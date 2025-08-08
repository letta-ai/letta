'use client';
import * as React from 'react';
import { HStack } from '../../framing/HStack/HStack';
import type { InputProps } from '../Input/Input';
import { RawInput } from '../Input/Input';
import { VStack } from '../../framing/VStack/VStack';
import type {
  AsyncSelectProps,
  OptionType,
  SelectProps,
} from '../Select/Select';
import { isMultiValue, RawAsyncSelect } from '../Select/Select';
import { RawSelect } from '../Select/Select';
import type { Dispatch, SetStateAction } from 'react';
import { useMemo } from 'react';
import { useState } from 'react';
import { useCallback } from 'react';
import { get, set } from 'lodash-es';
import { Button } from '../Button/Button';
import { useTranslations } from '@letta-cloud/translations';
import { CloseIcon, PlusIcon, SearchIcon } from '../../icons';
import {
  RawDatePicker,
  RawDateTimePicker,
  RawDateTimePicker24h,
  RawDateRangePicker,
  RawDateTimeRangePicker
} from '../DateTimePicker/DateTimePicker';

const DISABLE_COMBINATOR = true;

interface QueryPartDefinitionBase {
  label: string;
  key: string;
}

interface SelectQueryDefinition extends QueryPartDefinitionBase {
  display: 'select';
  options: SelectProps;
}

interface InputQueryDefinition extends QueryPartDefinitionBase {
  display: 'input';
  options?: InputProps;
}

interface AsyncSelectQueryDefinition extends QueryPartDefinitionBase {
  display: 'async-select';
  isLoadingDefaultOptions?: boolean;
  options: AsyncSelectProps;
}

interface DatePickerQueryDefinition extends QueryPartDefinitionBase {
  display: 'date-picker';
  options?: {
    placeholder?: string;
    disabled?: boolean;
  };
}

interface DateTimePickerQueryDefinition extends QueryPartDefinitionBase {
  display: 'datetime-picker';
  options?: {
    placeholder?: string;
    disabled?: boolean;
    format24h?: boolean;
  };
}

interface DateRangePickerQueryDefinition extends QueryPartDefinitionBase {
  display: 'date-range-picker';
  options?: {
    placeholder?: string;
    disabled?: boolean;
  };
}

interface DateTimeRangePickerQueryDefinition extends QueryPartDefinitionBase {
  display: 'datetime-range-picker';
  options?: {
    placeholder?: string;
    disabled?: boolean;
    format24h?: boolean;
  };
}

type QueryDefinition =
  | AsyncSelectQueryDefinition
  | DatePickerQueryDefinition
  | DateRangePickerQueryDefinition
  | DateTimePickerQueryDefinition
  | DateTimeRangePickerQueryDefinition
  | InputQueryDefinition
  | SelectQueryDefinition;

interface FieldDefinition {
  id: string;
  name: string;
  single?: boolean;
  queries: QueryDefinition[];
}

export type FieldDefinitions = Record<FieldDefinition['id'], FieldDefinition>;

const baseQuery: GenericQueryCondition = {
  combinator: 'AND',
  items: [],
};

interface QueryBuilderContextData {
  definition: FieldDefinitions;
  fieldsOptions: OptionType[];
  query: QueryBuilderQuery;
  setQuery: Dispatch<SetStateAction<QueryBuilderQuery>>;
}

const QueryBuilderContext = React.createContext<QueryBuilderContextData>({
  query: { root: baseQuery },
  fieldsOptions: [],
  definition: {},
  setQuery: () => {
    return false;
  },
});

function useQueryBuilder() {
  return React.useContext(QueryBuilderContext);
}

interface InputConstructorProps {
  structure: QueryDefinition;
  value: OptionType | OptionType[] | undefined;
  onChange: (value: OptionType | OptionType[] | undefined) => void;
}

function InputConstructor(props: InputConstructorProps) {
  const { structure, value, onChange } = props;

  switch (structure.display) {
    case 'input':
      if (Array.isArray(value)) {
        return null;
      }

      return (
        <RawInput
          hideLabel
          className="min-w-[100px]"
          label={structure.label}
          value={value?.value || ''}
          onChange={(value) => {
            onChange({
              value: value.target.value,
              label: value.target.value,
            });
          }}
        />
      );
    case 'select': {
      const { options } = structure;

      return (
        <RawSelect
          hideLabel
          label={structure.label}
          {...options}
          value={value}
          onSelect={(option) => {
            if (!isMultiValue(option)) {
              onChange(option || undefined);
            }
          }}
        />
      );
    }

    case 'async-select': {
      if (structure.isLoadingDefaultOptions) {
        return (
          <RawSelect
            {...structure.options}
            options={[]}
            hideLabel
            label={structure.label}
            isLoading
          />
        );
      }

      return (
        <RawAsyncSelect
          hideLabel
          preIcon={<SearchIcon />}
          fullWidth
          {...structure.options}
          value={value}
          onSelect={(option) => {
            if (!isMultiValue(option)) {
              onChange(option || undefined);
              return;
            }

            if (Array.isArray(option)) {
              onChange(option);
            }
          }}
          label={structure.label}
        />
      );
    }

    case 'date-picker': {
      if (Array.isArray(value)) {
        return null;
      }

      const dateValue = value?.value ? new Date(value.value) : undefined;
      const options = structure.options || {};

      return (
        <RawDatePicker
          hideLabel
          label={structure.label}
          className="min-w-[150px]"
          value={dateValue}
          onValueChange={(date) => {
            if (date) {
              const isoString = date.toISOString();
              onChange({
                value: isoString,
                label: date.toLocaleDateString(),
              });
            } else {
              onChange(undefined);
            }
          }}
          placeholder={options.placeholder}
          disabled={options.disabled}
        />
      );
    }

    case 'datetime-picker': {
      if (Array.isArray(value)) {
        return null;
      }

      const dateValue = value?.value ? new Date(value.value) : undefined;
      const options = structure.options || {};

      const DateTimeComponent = options.format24h ? RawDateTimePicker24h : RawDateTimePicker;

      return (
        <DateTimeComponent
          hideLabel
          label={structure.label}
          className="min-w-[200px]"
          value={dateValue}
          onValueChange={(date) => {
            if (date) {
              const isoString = date.toISOString();
              onChange({
                value: isoString,
                label: date.toLocaleString(),
              });
            } else {
              onChange(undefined);
            }
          }}
          placeholder={options.placeholder}
          disabled={options.disabled}
        />
      );
    }

    case 'date-range-picker': {
      // Allow undefined, empty array, or array with values
      if (value !== undefined && !Array.isArray(value)) {
        return null;
      }

      const rangeValue = Array.isArray(value) && value.length >= 1 && value[0].value
        ? {
            from: new Date(value[0].value),
            to: value.length >= 2 && value[1]?.value ? new Date(value[1].value) : undefined,
          }
        : undefined;

      const options = structure.options || {};

      return (
        <RawDateRangePicker
          hideLabel
          label={structure.label}
          className="min-w-[250px]"
          value={rangeValue}
          onValueChange={(range) => {
            if (range?.from) {
              const fromOption = {
                value: range.from.toISOString(),
                label: range.from.toLocaleDateString(),
              };

              if (range.to) {
                const toOption = {
                  value: range.to.toISOString(),
                  label: range.to.toLocaleDateString(),
                };
                onChange([fromOption, toOption]);
              } else {
                onChange([fromOption]);
              }
            } else {
              onChange(undefined);
            }
          }}
          placeholder={options.placeholder}
          disabled={options.disabled}
        />
      );
    }

    case 'datetime-range-picker': {
      // Allow undefined, empty array, or array with values
      if (value !== undefined && !Array.isArray(value)) {
        return null;
      }

      const rangeValue = Array.isArray(value) && value.length >= 1 && value[0].value
        ? {
            from: new Date(value[0].value),
            to: value.length >= 2 && value[1]?.value ? new Date(value[1].value) : undefined,
          }
        : undefined;

      const options = structure.options || {};

      return (
        <RawDateTimeRangePicker
          hideLabel
          label={structure.label}
          className="min-w-[300px]"
          value={rangeValue}
          onValueChange={(range) => {
            if (range?.from) {
              const fromOption = {
                value: range.from.toISOString(),
                label: range.from.toLocaleString(),
              };

              if (range.to) {
                const toOption = {
                  value: range.to.toISOString(),
                  label: range.to.toLocaleString(),
                };
                onChange([fromOption, toOption]);
              } else {
                onChange([fromOption]);
              }
            } else {
              onChange(undefined);
            }
          }}
          placeholder={options.placeholder}
          disabled={options.disabled}
          format24h={options.format24h}
        />
      );
    }
  }

  return null;
}

interface RemoveConditionProps {
  path: string;
}

function RemoveCondition(props: RemoveConditionProps) {
  const { path } = props;
  const { setQuery } = useQueryBuilder();
  const t = useTranslations('components/QueryBuilder');

  const handleRemoveCondition = useCallback(() => {
    setQuery((prevQuery) => {
      const newQuery = { ...prevQuery };

      const pathArr = path.split('.');

      const index = pathArr.pop();
      const parentPath = pathArr.join('.');

      const parent = get(newQuery, parentPath);

      if (!Array.isArray(parent)) {
        return newQuery;
      }

      set(
        newQuery,
        parentPath,
        parent.filter((_, itemIndex) => itemIndex !== Number(index)),
      );

      return newQuery;
    });
  }, [path, setQuery]);

  return (
    <HStack>
      <Button
        type="button"
        onClick={handleRemoveCondition}
        color="tertiary"
        label={t('removeCondition')}
        hideLabel
        preIcon={<CloseIcon />}
      />
    </HStack>
  );
}

export interface GenericQueryItem {
  field?: string;
  queryData?: Record<string, OptionType | OptionType[] | undefined>;
}

interface QueryRowProps extends GenericQueryItem {
  path: string;
  isFirstCondition?: boolean;
}

function QueryCondition(props: QueryRowProps) {
  const { field = '', isFirstCondition, queryData = {}, path } = props;

  const { setQuery, definition } = useQueryBuilder();

  const handleChange = useCallback(
    (key: string, nextValue: OptionType | OptionType[] | undefined) => {
      setQuery((prevQuery) => {
        const newQuery = { ...prevQuery };

        set(newQuery, `${path}.queryData.${key}`, nextValue);

        return { ...newQuery };
      });
    },
    [path, setQuery],
  );

  const handleUpdateField = useCallback(
    (nextField: string) => {
      setQuery((prevQuery) => {
        const newQuery = { ...prevQuery };

        set(newQuery, `${path}.field`, nextField);

        // Get the field definition for the new field
        const newFieldDefinition = definition[nextField];

        // Reset queryData with default values for the new field
        const defaultQueryData: Record<
          string,
          OptionType | OptionType[] | undefined
        > = {};

        if (newFieldDefinition) {
          newFieldDefinition.queries.forEach((queryDef) => {
            if (
              queryDef.display === 'select' &&
              queryDef.options?.options &&
              queryDef.options.options.length > 0
            ) {
              // Set the first option as default for select fields (like operators)
              defaultQueryData[queryDef.key] = queryDef.options.options[0];
            } else if (queryDef.display === 'input') {
              // Set empty string for input fields
              defaultQueryData[queryDef.key] = { label: '', value: '' };
            } else if (
              queryDef.display === 'date-picker' ||
              queryDef.display === 'datetime-picker'
            ) {
              // Set undefined for single date fields
              defaultQueryData[queryDef.key] = undefined;
            } else if (
              queryDef.display === 'date-range-picker' ||
              queryDef.display === 'datetime-range-picker'
            ) {
              // Set empty array for date range fields
              defaultQueryData[queryDef.key] = [];
            }
          });
        }

        set(newQuery, `${path}.queryData`, defaultQueryData);

        return { ...newQuery };
      });
    },
    [path, setQuery, definition],
  );

  const { fieldsOptions } = useQueryBuilder();

  const definitionType = useMemo(() => {
    return definition[field];
  }, [definition, field]);

  return (
    <HStack padding="xxsmall" fullWidth>
      <InputConstructor
        structure={{
          display: 'select',
          label: 'Field',
          key: 'field',
          options: {
            fullWidth: false,
            styleConfig: {
              containerWidth: 200,
            },
            options: fieldsOptions,
          },
        }}
        value={{
          value: field,
          label: definitionType?.name || '',
        }}
        onChange={(value) => {
          if (Array.isArray(value)) {
            return;
          }

          handleUpdateField(value?.value || '');
        }}
      />
      {definitionType?.queries?.map((query, index) => {
        return (
          <InputConstructor
            key={`${field}-${query.key}`}
            structure={query}
            value={queryData[query.key] || undefined}
            onChange={(nextValue) => {
              handleChange(query.key, nextValue);
            }}
          />
        );
      })}
      {!isFirstCondition && (
        <HStack justify="spaceBetween" fullWidth>
          <div></div>
          <RemoveCondition path={path} />
        </HStack>
      )}
    </HStack>
  );
}

interface AddNewCombinatorProps {
  path: string;
}

function AddNewCombinator(props: AddNewCombinatorProps) {
  const { path } = props;
  const t = useTranslations('components/QueryBuilder');

  const { setQuery } = useQueryBuilder();

  const handleAddCombinator = useCallback(() => {
    setQuery((prevQuery) => {
      const newQuery = { ...prevQuery };

      const existingCombinator = get(newQuery, path, {
        condition: 'AND',
        items: [],
      });

      set(newQuery, path, {
        ...existingCombinator,
        items: [...existingCombinator.items, { combinator: 'AND', items: [] }],
      });

      return newQuery;
    });
  }, [path, setQuery]);

  return (
    <Button
      type="button"
      onClick={handleAddCombinator}
      label={t('addCombinator')}
    />
  );
}

interface AddNewConditionProps {
  path: string;
}

function AddNewCondition(props: AddNewConditionProps) {
  const { path } = props;
  const t = useTranslations('components/QueryBuilder');

  const { setQuery, definition } = useQueryBuilder();

  const handleAddCondition = useCallback(() => {
    setQuery((prevQuery) => {
      const newQuery = { ...prevQuery };

      const existingCombinator = get(newQuery, path, {
        condition: 'AND',
        items: [],
      });

      const firstField = Object.keys(definition)[0];

      set(newQuery, path, {
        ...existingCombinator,
        items: [
          ...existingCombinator.items,
          { field: firstField || '', queryData: {} },
        ],
      });

      return newQuery;
    });
  }, [definition, path, setQuery]);

  return (
    <Button
      type="button"
      color="tertiary"
      size="small"
      bold
      preIcon={<PlusIcon />}
      onClick={handleAddCondition}
      label={t('addCondition')}
    />
  );
}

type QueryCombinators = 'AND' | 'OR';

interface GenericQueryCondition {
  combinator: QueryCombinators;
  items: Array<GenericQueryCondition | GenericQueryItem>;
}

export function compileSearchTerms(
  items: Array<GenericQueryCondition | GenericQueryItem>,
) {
  return items
    .map((item) => {
      if (isGenericQueryCondition(item) || !item.queryData) {
        return null;
      }

      return {
        field: item.field,
        ...Object.entries(item.queryData).reduce((acc, [key, value]) => {
          if (!value) {
            return acc;
          }

          if (Array.isArray(value)) {
            // Handle multi-value fields (like tags)
            const values = value.map((val) => val?.value).filter(Boolean);
            return {
              ...acc,
              [key]: values,
            };
          }

          return {
            ...acc,
            [key]: value?.value || '',
          };
        }, {}),
      };
    })
    .filter(Boolean) as Array<{
    field: string;
    operator?: string;
    value?: string[] | string;
  }>;
}

export function isGenericQueryCondition(
  item: GenericQueryCondition | GenericQueryItem,
): item is GenericQueryCondition {
  return 'combinator' in item;
}

export function isGenericQueryItem(
  item: GenericQueryCondition | GenericQueryItem,
): item is GenericQueryItem {
  return !('combinator' in item);
}

interface QueryCombinatorProps extends GenericQueryCondition {
  path: string;
  isFirstCondition?: boolean;
}

function QueryCombinator(props: QueryCombinatorProps) {
  const { combinator, path, items } = props;

  const { setQuery } = useQueryBuilder();
  const combinatorOptions: OptionType[] = DISABLE_COMBINATOR
    ? [{ label: 'AND', value: 'AND' }]
    : [
        { label: 'AND', value: 'AND' },
        { label: 'OR', value: 'OR' },
      ];

  const selectedCombinator = combinatorOptions.find(
    (option) => option.value === combinator,
  );

  const handleSelectCombinator = useCallback(
    (option: OptionType) => {
      const nextCombinator = option.value as QueryCombinators;

      setQuery((prevQuery) => {
        const newQuery = { ...prevQuery };

        const existingItems = get(newQuery, `${path}.items`, []);

        set(newQuery, path, {
          combinator: nextCombinator,
          items: existingItems,
        });

        return newQuery;
      });
    },
    [path, setQuery],
  );

  return (
    <HStack>
      <HStack paddingTop="xsmall">
        <RawSelect
          __use_rarely_className="min-w-[65px]"
          label="Select Condition"
          hideLabel
          options={combinatorOptions}
          value={selectedCombinator}
          onSelect={(option) => {
            if (!isMultiValue(option)) {
              handleSelectCombinator(option || { value: 'AND', label: 'AND' });
            }
          }}
        />
      </HStack>
      <VStack gap="small" collapseWidth flex>
        <VStack color="background-grey2" overflowX="auto" gap={false} fullWidth>
          {items.map((item, index) => {
            const isLast = index === items.length - 1;
            let borderClass = 'border-x border-t border-solid border-border';
            if (isLast) {
              borderClass += ' border-b';
            }

            if ('combinator' in item) {
              return (
                <VStack className={borderClass} key={index} padding="xxsmall">
                  <QueryCombinator path={`${path}.items.${index}`} {...item} />
                </VStack>
              );
            } else {
              return (
                <VStack className={borderClass} key={index} padding="xxsmall">
                  <QueryCondition
                    isFirstCondition={index === 0 && path === 'root'}
                    path={`${path}.items.${index}`}
                    {...item}
                  />
                </VStack>
              );
            }
          })}
        </VStack>
        <HStack paddingTop="xxsmall">
          <AddNewCondition path={path} />
        </HStack>
        <HStack fullWidth justify="end">
          {!DISABLE_COMBINATOR && items.length > 0 && (
            <AddNewCombinator path={path} />
          )}
        </HStack>
      </VStack>
    </HStack>
  );
}

export interface QueryBuilderQuery {
  root: GenericQueryCondition;
}

interface QueryBuilderProps {
  query: QueryBuilderQuery;
  definition: FieldDefinitions;
  defaultQuery?: GenericQueryCondition;
  onSetQuery?: Dispatch<SetStateAction<QueryBuilderQuery>>;
}

export function createDefaultQuery(): QueryBuilderQuery {
  return {
    root: {
      combinator: 'AND',
      items: [],
    },
  };
}

export function QueryBuilder(props: QueryBuilderProps) {
  const { query, definition, onSetQuery } = props;
  const [_queryState, _setQueryState] = useState<QueryBuilderQuery>(
    query || createDefaultQuery(),
  );

  const setQueryState: Dispatch<SetStateAction<QueryBuilderQuery>> =
    useCallback(
      (query) => {
        if (onSetQuery) {
          onSetQuery(query);

          return;
        }

        _setQueryState(query);
      },
      [onSetQuery],
    );

  const queryState = useMemo(() => {
    if (query) {
      return query;
    }

    return _queryState;
  }, [query, _queryState]);

  const fieldsOptions = useMemo(() => {
    return Object.keys(definition).map((key) => ({
      label: definition[key].name,
      value: key,
    }));
  }, [definition]);

  return (
    <QueryBuilderContext.Provider
      value={{
        fieldsOptions,
        definition,
        query: queryState,
        setQuery: setQueryState,
      }}
    >
      <QueryCombinator path="root" {...queryState.root} />
    </QueryBuilderContext.Provider>
  );
}
