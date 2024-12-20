'use client';
import * as React from 'react';
import { HStack } from '../../framing/HStack/HStack';
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
import type { InputProps } from 'react-select';
import { Button } from '../Button/Button';
import { useTranslations } from 'next-intl';
import { CloseIcon } from '../../icons';

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

type QueryDefinition =
  | AsyncSelectQueryDefinition
  | InputQueryDefinition
  | SelectQueryDefinition;

interface FieldDefinition {
  id: string;
  name: string;
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
  query: RootQuery;
  setQuery: Dispatch<SetStateAction<RootQuery>>;
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
  value: OptionType | undefined;
  onChange: (value: OptionType | undefined) => void;
}

function InputConstructor(props: InputConstructorProps) {
  const { structure, value, onChange } = props;

  switch (structure.display) {
    case 'input':
      return (
        <RawInput
          hideLabel
          fullWidth
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
          fullWidth
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
            fullWidth
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
          fullWidth
          {...structure.options}
          value={value}
          onSelect={(option) => {
            if (!isMultiValue(option)) {
              onChange(option || undefined);
            }
          }}
          label={structure.label}
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
        parent.filter((_, itemIndex) => itemIndex !== Number(index))
      );

      return newQuery;
    });
  }, [path, setQuery]);

  return (
    <Button
      onClick={handleRemoveCondition}
      color="tertiary-transparent"
      label={t('removeCondition')}
      hideLabel
      preIcon={<CloseIcon />}
    />
  );
}

interface GenericQueryItem {
  field?: string;
  queryData?: Record<string, OptionType | undefined>;
}

interface QueryRowProps extends GenericQueryItem {
  path: string;
}

function QueryCondition(props: QueryRowProps) {
  const { field = '', queryData = {}, path } = props;

  const { setQuery } = useQueryBuilder();

  const handleChange = useCallback(
    (key: string, nextValue: OptionType | undefined) => {
      setQuery((prevQuery) => {
        const newQuery = { ...prevQuery };

        set(newQuery, `${path}.queryData.${key}`, nextValue);

        return { ...newQuery };
      });
    },
    [path, setQuery]
  );

  const handleUpdateField = useCallback(
    (nextField: string) => {
      setQuery((prevQuery) => {
        const newQuery = { ...prevQuery };

        set(newQuery, `${path}.field`, nextField);
        set(newQuery, `${path}.queryData`, {});

        return { ...newQuery };
      });
    },
    [path, setQuery]
  );

  const { definition, fieldsOptions } = useQueryBuilder();

  const definitionType = useMemo(() => {
    return definition[field];
  }, [definition, field]);

  return (
    <HStack fullWidth>
      <InputConstructor
        structure={{
          display: 'select',
          label: 'Field',
          key: 'field',
          options: {
            options: fieldsOptions,
          },
        }}
        value={{
          value: field,
          label: definitionType?.name || '',
        }}
        onChange={(value) => {
          handleUpdateField(value?.value || '');
        }}
      />
      {definitionType?.queries?.map((query, index) => {
        return (
          <InputConstructor
            key={index}
            structure={query}
            value={queryData[query.key] || undefined}
            onChange={(nextValue) => {
              handleChange(query.key, nextValue);
            }}
          />
        );
      })}
      <RemoveCondition path={path} />
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

  return <Button onClick={handleAddCombinator} label={t('addCombinator')} />;
}

interface AddNewConditionProps {
  path: string;
}

function AddNewCondition(props: AddNewConditionProps) {
  const { path } = props;
  const t = useTranslations('components/QueryBuilder');

  const { setQuery } = useQueryBuilder();

  const handleAddCondition = useCallback(() => {
    setQuery((prevQuery) => {
      const newQuery = { ...prevQuery };

      const existingCombinator = get(newQuery, path, {
        condition: 'AND',
        items: [],
      });

      set(newQuery, path, {
        ...existingCombinator,
        items: [...existingCombinator.items, { field: '', queryData: {} }],
      });

      return newQuery;
    });
  }, [path, setQuery]);

  return (
    <Button
      color="secondary"
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

interface QueryCombinatorProps extends GenericQueryCondition {
  path: string;
}

function QueryCombinator(props: QueryCombinatorProps) {
  const { combinator, path, items } = props;

  const { setQuery } = useQueryBuilder();
  const combinatorOptions: OptionType[] = [
    { label: 'AND', value: 'AND' },
    { label: 'OR', value: 'OR' },
  ];

  const selectedCombinator = combinatorOptions.find(
    (option) => option.value === combinator
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
    [path, setQuery]
  );

  return (
    <HStack>
      {!DISABLE_COMBINATOR && (
        <HStack>
          <RawSelect
            label="Select Condition"
            hideLabel
            options={combinatorOptions}
            value={selectedCombinator}
            onSelect={(option) => {
              if (!isMultiValue(option)) {
                handleSelectCombinator(
                  option || { value: 'AND', label: 'AND' }
                );
              }
            }}
          />
        </HStack>
      )}

      <VStack fullWidth>
        {items.map((item, index) => {
          if ('combinator' in item) {
            return (
              <QueryCombinator
                path={`${path}.items.${index}`}
                key={index}
                {...item}
              />
            );
          } else {
            return (
              <QueryCondition
                path={`${path}.items.${index}`}
                key={index}
                {...item}
              />
            );
          }
        })}
        <HStack fullWidth>
          <AddNewCondition path={path} />
          {!DISABLE_COMBINATOR && items.length > 0 && (
            <AddNewCombinator path={path} />
          )}
        </HStack>
      </VStack>
    </HStack>
  );
}

interface RootQuery {
  root: GenericQueryCondition;
}

interface QueryBuilderProps {
  query: RootQuery;
  definition: FieldDefinitions;
  defaultQuery?: GenericQueryCondition;
  onSetQuery?: (query: GenericQueryCondition) => void;
}

export function QueryBuilder(props: QueryBuilderProps) {
  const { query, definition } = props;
  const [queryState, setQueryState] = useState<RootQuery>(query);

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
      <VStack overflowY="auto" border padding>
        <QueryCombinator path="root" {...queryState.root} />
      </VStack>
    </QueryBuilderContext.Provider>
  );
}
