import { initContract } from '@ts-rest/core';
import type {
  ListEmbeddingModelsData,
  ListEmbeddingModelsResponse,
  ListModelsData,
  ListModelsResponse,
} from '@letta-cloud/sdk-core';

const c = initContract();

type CamelToSnakeCase<S extends string> = S extends `${infer T}${infer U}`
  ? `${T extends Capitalize<T> ? '_' : ''}${Lowercase<T>}${CamelToSnakeCase<U>}`
  : S;

type KeysToSnakeCase<T> = {
  [K in keyof T as CamelToSnakeCase<string & K>]: T[K];
};

const listLLMModelsContract = c.query({
  path: '/v1/models',
  method: 'GET',
  query: c.type<KeysToSnakeCase<ListModelsData>>(),
  responses: {
    200: c.type<ListModelsResponse>(),
  },
});

const listEmbeddingModelsContract = c.query({
  path: '/v1/models/embeddings',
  method: 'GET',
  query: c.type<KeysToSnakeCase<ListEmbeddingModelsData>>(),
  responses: {
    200: c.type<ListEmbeddingModelsResponse>(),
  },
});

export const modelsContract = {
  listLLMModels: listLLMModelsContract,
  listEmbeddingModels: listEmbeddingModelsContract,
};
