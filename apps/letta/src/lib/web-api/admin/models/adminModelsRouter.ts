import type { ServerInferRequest, ServerInferResponses } from '@ts-rest/core';
import type { contracts } from '$letta/web-api/contracts';
import {
  db,
  embeddingModelsMetadata,
  inferenceModelsMetadata,
} from '@letta-web/database';
import { and, eq, isNotNull, isNull, like } from 'drizzle-orm';
import {
  getLettaAgentsEmbeddingModelsSingleton,
  getLettaAgentsInferenceModelsSingleton,
} from '$letta/server';
import type { EmbeddingConfig, LLMConfig } from '@letta-web/letta-agents-api';
import { ModelsService } from '@letta-web/letta-agents-api';
import { getBrandFromModelName } from '$letta/utils';

type GetAdminInferenceModelsResponse = ServerInferResponses<
  typeof contracts.admin.models.getAdminInferenceModels
>;

type GetAdminInferenceModelsRequest = ServerInferRequest<
  typeof contracts.admin.models.getAdminInferenceModels
>;

async function getAdminInferenceModels(
  req: GetAdminInferenceModelsRequest
): Promise<GetAdminInferenceModelsResponse> {
  const {
    brand,
    limit = 10,
    offset,
    search,
    fromAgents,
    disabled,
    modelName,
    modelEndpoint,
  } = req.query;

  if (fromAgents) {
    const res = await ModelsService.listModels();

    return {
      status: 200,
      body: {
        inferenceModels: res.map((model) => ({
          id: model.model,
          name: model.model,
          tag: '',
          isRecommended: false,
          brand: model.model_endpoint_type,
          config: model,
          disabledAt: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })),
        hasNextPage: false,
      },
    };
  }

  const where = [];

  if (brand) {
    where.push(eq(inferenceModelsMetadata.brand, brand));
  }

  if (search) {
    where.push(like(inferenceModelsMetadata.name, `%${search}%`));
  }

  if (typeof disabled === 'boolean') {
    if (disabled) {
      where.push(isNotNull(inferenceModelsMetadata.disabledAt));
    } else {
      where.push(isNull(inferenceModelsMetadata.disabledAt));
    }
  }

  if (modelName) {
    where.push(eq(inferenceModelsMetadata.modelName, modelName));
  }

  if (modelEndpoint) {
    where.push(eq(inferenceModelsMetadata.modelEndpoint, modelEndpoint));
  }

  const [response, inferenceModels] = await Promise.all([
    db.query.inferenceModelsMetadata.findMany({
      where: and(...where),
      limit: limit + 1,
      offset,
    }),
    getLettaAgentsInferenceModelsSingleton(),
  ]);

  const configMap = new Map<string, LLMConfig>();

  inferenceModels.forEach((model) => {
    configMap.set(`${model.model_endpoint}${model.model}`, model);
  });

  return {
    status: 200,
    body: {
      inferenceModels: response.slice(0, limit).map((model) => ({
        id: model.id,
        name: model.name,
        brand: model.brand,
        tag: model.tag || '',
        isRecommended: model.isRecommended,
        config: configMap.get(`${model.modelEndpoint}${model.modelName}`),
        disabledAt: model.disabledAt?.toISOString(),
        createdAt: model.createdAt.toISOString(),
        updatedAt: model.updatedAt.toISOString(),
      })),
      hasNextPage: response.length > limit,
    },
  };
}

type GetAdminInferenceModelRequest = ServerInferRequest<
  typeof contracts.admin.models.getAdminInferenceModel
>;

type GetAdminInferenceModelResponse = ServerInferResponses<
  typeof contracts.admin.models.getAdminInferenceModel
>;

async function getAdminInferenceModel(
  req: GetAdminInferenceModelRequest
): Promise<GetAdminInferenceModelResponse> {
  const { id } = req.params;

  const response = await db.query.inferenceModelsMetadata.findFirst({
    where: eq(inferenceModelsMetadata.id, id),
  });

  if (!response) {
    return {
      status: 404,
      body: {
        error: 'Inference model not found',
      },
    };
  }

  const inferenceModels = await getLettaAgentsInferenceModelsSingleton();

  return {
    status: 200,
    body: {
      id: response.id,
      name: response.name,
      isRecommended: response.isRecommended,
      tag: response.tag || '',
      brand: response.brand,
      config: inferenceModels.find(
        (model) =>
          model.model === response.modelName &&
          model.model_endpoint === response.modelEndpoint
      ),
      disabledAt: response.disabledAt?.toISOString(),
      createdAt: response.createdAt.toISOString(),
      updatedAt: response.updatedAt.toISOString(),
    },
  };
}

type CreateAdminInferenceModelRequest = ServerInferRequest<
  typeof contracts.admin.models.createAdminInferenceModel
>;

type CreateAdminInferenceModelResponse = ServerInferResponses<
  typeof contracts.admin.models.createAdminInferenceModel
>;

async function createAdminInferenceModel(
  req: CreateAdminInferenceModelRequest
): Promise<CreateAdminInferenceModelResponse> {
  const { modelName, modelEndpoint } = req.body;

  const agentsInferenceModelsList =
    await getLettaAgentsInferenceModelsSingleton();

  const selectedModel = agentsInferenceModelsList.find(
    (model) =>
      model.model === modelName && model.model_endpoint === modelEndpoint
  );

  if (!selectedModel?.model_endpoint) {
    return {
      status: 400,
      body: {
        error: 'Source not found from Letta Agents',
      },
    };
  }

  const [response] = await db
    .insert(inferenceModelsMetadata)
    .values({
      name: selectedModel.model,
      modelEndpoint: selectedModel.model_endpoint,
      brand: getBrandFromModelName(selectedModel.model) || 'unknown',
      modelName: selectedModel.model,
      disabledAt: new Date(),
    })
    .returning({
      id: inferenceModelsMetadata.id,
      name: inferenceModelsMetadata.name,
      brand: inferenceModelsMetadata.brand,
      modelEndpoint: inferenceModelsMetadata.modelEndpoint,
      tag: inferenceModelsMetadata.tag,
      isRecommended: inferenceModelsMetadata.isRecommended,
      modelName: inferenceModelsMetadata.modelName,
      disabledAt: inferenceModelsMetadata.disabledAt,
      createdAt: inferenceModelsMetadata.createdAt,
      updatedAt: inferenceModelsMetadata.updatedAt,
    });

  return {
    status: 201,
    body: {
      id: response.id,
      name: response.name,
      brand: response.brand,
      tag: response.tag || '',
      isRecommended: response.isRecommended,
      config: null,
      disabledAt: response.disabledAt?.toISOString(),
      createdAt: response.createdAt.toISOString(),
      updatedAt: response.updatedAt.toISOString(),
    },
  };
}

type UpdateAdminInferenceModelRequest = ServerInferRequest<
  typeof contracts.admin.models.updateAdminInferenceModel
>;

type UpdateAdminInferenceModelResponse = ServerInferResponses<
  typeof contracts.admin.models.updateAdminInferenceModel
>;

interface UpdateAdminInferenceSetterType {
  brand?: string;
  disabledAt?: Date | null;
  name?: string;
  tag?: string;
  isRecommended?: boolean;
}

async function updateAdminInferenceModel(
  req: UpdateAdminInferenceModelRequest
): Promise<UpdateAdminInferenceModelResponse> {
  const { id } = req.params;
  const { brand, disabled, name, isRecommended, tag } = req.body;

  const set: Partial<UpdateAdminInferenceSetterType> = {};

  if (brand) {
    set.brand = brand;
  }

  if (typeof disabled === 'boolean') {
    set.disabledAt = disabled ? new Date() : null;
  }

  if (name) {
    set.name = name;
  }

  if (tag) {
    set.tag = tag;
  }

  if (typeof isRecommended === 'boolean') {
    set.isRecommended = isRecommended;
  }

  if (Object.keys(set).length === 0) {
    return {
      status: 400,
      body: {
        error: 'No fields to update',
      },
    };
  }

  const [response] = await db
    .update(inferenceModelsMetadata)
    .set(set)
    .where(eq(inferenceModelsMetadata.id, id))
    .returning({
      id: inferenceModelsMetadata.id,
      name: inferenceModelsMetadata.name,
      brand: inferenceModelsMetadata.brand,
      modelEndpoint: inferenceModelsMetadata.modelEndpoint,
      isRecommended: inferenceModelsMetadata.isRecommended,
      tag: inferenceModelsMetadata.tag,
      modelName: inferenceModelsMetadata.modelName,
      disabledAt: inferenceModelsMetadata.disabledAt,
      createdAt: inferenceModelsMetadata.createdAt,
      updatedAt: inferenceModelsMetadata.updatedAt,
    });

  return {
    status: 200,
    body: {
      id: response.id,
      name: response.name,
      brand: response.brand,
      config: null,
      isRecommended: response.isRecommended,
      tag: response.tag || '',
      disabledAt: response.disabledAt?.toISOString(),
      createdAt: response.createdAt.toISOString(),
      updatedAt: response.updatedAt.toISOString(),
    },
  };
}

export type DeleteAdminInferenceModelRequest = ServerInferRequest<
  typeof contracts.admin.models.deleteAdminInferenceModel
>;

export type DeleteAdminInferenceModelResponse = ServerInferResponses<
  typeof contracts.admin.models.deleteAdminInferenceModel
>;

async function deleteAdminInferenceModel(
  req: DeleteAdminInferenceModelRequest
): Promise<DeleteAdminInferenceModelResponse> {
  const { id } = req.params;

  await db
    .delete(inferenceModelsMetadata)
    .where(eq(inferenceModelsMetadata.id, id));

  return {
    status: 200,
    body: {
      success: true,
    },
  };
}

export type GetAdminEmbeddingModelRequest = ServerInferRequest<
  typeof contracts.admin.models.getAdminEmbeddingModel
>;

export type GetAdminEmbeddingModelResponse = ServerInferResponses<
  typeof contracts.admin.models.getAdminEmbeddingModel
>;

async function getAdminEmbeddingModel(
  req: GetAdminEmbeddingModelRequest
): Promise<GetAdminEmbeddingModelResponse> {
  const { id } = req.params;

  const response = await db.query.embeddingModelsMetadata.findFirst({
    where: eq(embeddingModelsMetadata.id, id),
  });

  if (!response) {
    return {
      status: 404,
      body: {
        error: 'Embedding model not found',
      },
    };
  }

  const embeddingModels = await getLettaAgentsEmbeddingModelsSingleton();

  return {
    status: 200,
    body: {
      id: response.id,
      name: response.name,
      brand: response.brand,
      config: embeddingModels.find(
        (model) =>
          model.embedding_model === response.modelName &&
          model.embedding_endpoint === response.modelEndpoint
      ),
      disabledAt: response.disabledAt?.toISOString(),
      createdAt: response.createdAt.toISOString(),
      updatedAt: response.updatedAt.toISOString(),
    },
  };
}

export type GetAdminEmbeddingModelsRequest = ServerInferRequest<
  typeof contracts.admin.models.getAdminEmbeddingModels
>;

export type GetAdminEmbeddingModelsResponse = ServerInferResponses<
  typeof contracts.admin.models.getAdminEmbeddingModels
>;

async function getAdminEmbeddingModels(
  req: GetAdminEmbeddingModelsRequest
): Promise<GetAdminEmbeddingModelsResponse> {
  const {
    brand,
    limit = 10,
    offset,
    fromAgents,
    search,
    disabled,
    modelName,
    modelEndpoint,
  } = req.query;

  if (fromAgents) {
    const res = await ModelsService.listEmbeddingModels();

    return {
      status: 200,
      body: {
        embeddingModels: res.map((model) => ({
          id: model.embedding_model,
          name: model.embedding_model,
          brand: model.embedding_endpoint_type,
          config: model,
          disabledAt: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })),
        hasNextPage: false,
      },
    };
  }

  const where = [];

  if (brand) {
    where.push(eq(embeddingModelsMetadata.brand, brand));
  }

  if (search) {
    where.push(like(embeddingModelsMetadata.name, `%${search}%`));
  }

  if (typeof disabled === 'boolean') {
    if (disabled) {
      where.push(isNotNull(embeddingModelsMetadata.disabledAt));
    } else {
      where.push(isNull(embeddingModelsMetadata.disabledAt));
    }
  }

  if (modelName) {
    where.push(eq(embeddingModelsMetadata.modelName, modelName));
  }

  if (modelEndpoint) {
    where.push(eq(embeddingModelsMetadata.modelEndpoint, modelEndpoint));
  }

  const [response, inferenceModels] = await Promise.all([
    db.query.embeddingModelsMetadata.findMany({
      where: and(...where),
      limit: limit + 1,
      offset,
    }),
    getLettaAgentsEmbeddingModelsSingleton(),
  ]);

  const configMap = new Map<string, EmbeddingConfig>();

  inferenceModels.forEach((model) => {
    configMap.set(`${model.embedding_endpoint}${model.embedding_model}`, model);
  });

  return {
    status: 200,
    body: {
      embeddingModels: response.slice(0, limit).map((model) => ({
        id: model.id,
        name: model.name,
        brand: model.brand,
        config: configMap.get(`${model.modelEndpoint}${model.modelName}`),
        disabledAt: model.disabledAt?.toISOString(),
        createdAt: model.createdAt.toISOString(),
        updatedAt: model.updatedAt.toISOString(),
      })),
      hasNextPage: response.length > limit,
    },
  };
}

export type CreateAdminEmbeddingModelRequest = ServerInferRequest<
  typeof contracts.admin.models.createAdminEmbeddingModel
>;

export type CreateAdminEmbeddingModelResponse = ServerInferResponses<
  typeof contracts.admin.models.createAdminEmbeddingModel
>;

async function createAdminEmbeddingModel(
  req: CreateAdminEmbeddingModelRequest
): Promise<CreateAdminEmbeddingModelResponse> {
  const { modelName, modelEndpoint } = req.body;

  const agentsEmbeddingModelsList =
    await getLettaAgentsEmbeddingModelsSingleton();

  const selectedModel = agentsEmbeddingModelsList.find(
    (model) =>
      model.embedding_model === modelName &&
      model.embedding_endpoint === modelEndpoint
  );

  if (!selectedModel?.embedding_endpoint) {
    return {
      status: 400,
      body: {
        error: 'Source not found from Letta Agents',
      },
    };
  }

  const [response] = await db
    .insert(embeddingModelsMetadata)
    .values({
      name: selectedModel.embedding_model,
      modelEndpoint: selectedModel.embedding_endpoint,
      brand: selectedModel.embedding_endpoint_type,
      modelName: selectedModel.embedding_model,
      disabledAt: new Date(),
    })
    .returning({
      id: embeddingModelsMetadata.id,
      name: embeddingModelsMetadata.name,
      brand: embeddingModelsMetadata.brand,
      modelEndpoint: embeddingModelsMetadata.modelEndpoint,
      modelName: embeddingModelsMetadata.modelName,
      disabledAt: embeddingModelsMetadata.disabledAt,
      createdAt: embeddingModelsMetadata.createdAt,
      updatedAt: embeddingModelsMetadata.updatedAt,
    });

  return {
    status: 201,
    body: {
      id: response.id,
      name: response.name,
      brand: response.brand,
      config: null,
      disabledAt: response.disabledAt?.toISOString(),
      createdAt: response.createdAt.toISOString(),
      updatedAt: response.updatedAt.toISOString(),
    },
  };
}

export type UpdateAdminEmbeddingModelRequest = ServerInferRequest<
  typeof contracts.admin.models.updateAdminEmbeddingModel
>;

export type UpdateAdminEmbeddingModelResponse = ServerInferResponses<
  typeof contracts.admin.models.updateAdminEmbeddingModel
>;

interface UpdateAdminEmbeddingSetterType {
  brand?: string;
  disabledAt?: Date | null;
  name?: string;
}

async function updateAdminEmbeddingModel(
  req: UpdateAdminEmbeddingModelRequest
): Promise<UpdateAdminEmbeddingModelResponse> {
  const { id } = req.params;
  const { brand, disabled, name } = req.body;

  const set: Partial<UpdateAdminEmbeddingSetterType> = {};

  if (brand) {
    set.brand = brand;
  }

  if (typeof disabled === 'boolean') {
    set.disabledAt = disabled ? new Date() : null;
  }

  if (name) {
    set.name = name;
  }

  if (Object.keys(set).length === 0) {
    return {
      status: 400,
      body: {
        error: 'No fields to update',
      },
    };
  }

  const [response] = await db
    .update(embeddingModelsMetadata)
    .set(set)
    .where(eq(embeddingModelsMetadata.id, id))
    .returning({
      id: embeddingModelsMetadata.id,
      name: embeddingModelsMetadata.name,
      brand: embeddingModelsMetadata.brand,
      modelEndpoint: embeddingModelsMetadata.modelEndpoint,
      modelName: embeddingModelsMetadata.modelName,
      disabledAt: embeddingModelsMetadata.disabledAt,
      createdAt: embeddingModelsMetadata.createdAt,
      updatedAt: embeddingModelsMetadata.updatedAt,
    });

  return {
    status: 200,
    body: {
      id: response.id,
      name: response.name,
      brand: response.brand,
      config: null,
      disabledAt: response.disabledAt?.toISOString(),
      createdAt: response.createdAt.toISOString(),
      updatedAt: response.updatedAt.toISOString(),
    },
  };
}

export type DeleteAdminEmbeddingModelRequest = ServerInferRequest<
  typeof contracts.admin.models.deleteAdminEmbeddingModel
>;

export type DeleteAdminEmbeddingModelResponse = ServerInferResponses<
  typeof contracts.admin.models.deleteAdminEmbeddingModel
>;

async function deleteAdminEmbeddingModel(
  req: DeleteAdminEmbeddingModelRequest
): Promise<DeleteAdminEmbeddingModelResponse> {
  const { id } = req.params;

  await db
    .delete(embeddingModelsMetadata)
    .where(eq(embeddingModelsMetadata.id, id));

  return {
    status: 200,
    body: {
      success: true,
    },
  };
}

export const adminModelsRouter = {
  getAdminInferenceModels,
  getAdminInferenceModel,
  createAdminInferenceModel,
  updateAdminInferenceModel,
  deleteAdminInferenceModel,
  getAdminEmbeddingModel,
  getAdminEmbeddingModels,
  createAdminEmbeddingModel,
  updateAdminEmbeddingModel,
  deleteAdminEmbeddingModel,
};
