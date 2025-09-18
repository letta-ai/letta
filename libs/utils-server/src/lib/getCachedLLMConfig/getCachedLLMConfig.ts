import { LlmsService } from '@letta-cloud/sdk-core';
import type { ListModelsResponse } from '@letta-cloud/sdk-core';
import { createRedisInstance } from '@letta-cloud/service-redis';

const MODELS_CACHE_KEY = 'listModels';
const MODELS_CACHE_TTL = 60; // 1 minute

interface LLMCache {
  llms?: ListModelsResponse;
  hasCheckedSourceOfTruth: boolean;
}

/**
 * Creates a cached LLM configuration retriever for efficient model lookups.
 * Uses Redis caching with in-memory fallback to minimize API calls to LlmsService.
 *
 * @param lettaAgentsId - The user ID for API authentication
 * @returns Object with getCachedLLMConfig function and getAllModels function
 */
export function createCachedLLMConfigRetriever(lettaAgentsId: string) {
  const cache: LLMCache = {
    llms: undefined,
    hasCheckedSourceOfTruth: false,
  };

  /**
   * Retrieves a specific LLM configuration by handle, using cache when possible.
   *
   * @param handle - The model handle to search for
   * @returns The matching LLM configuration or undefined if not found
   */
  async function getCachedLLMConfig(handle: string) {
    // Check Redis cache for models list
    const redis = createRedisInstance();
    const cacheKey = `${MODELS_CACHE_KEY}:${lettaAgentsId}`;

    try {
      // Check in-memory store first
      if (cache.llms) {
        const match = cache.llms.find(
          (model) => model.handle === handle,
        );

        if (!match && !cache.hasCheckedSourceOfTruth) {
          // If we haven't checked the source of truth, refetch the models
          throw new Error('No match found, need to check source of truth');
        }

        return match;
      }

      // Check Redis cache
      const cachedModels = await redis.get(cacheKey);

      if (cachedModels) {
        cache.llms = JSON.parse(cachedModels);

        if (!Array.isArray(cache.llms)) {
          throw new Error('Invalid cache format');
        }

        // Find the requested model in cached data
        const match = cache.llms.find(
          (model) => model.handle === handle,
        );

        return match;
      } else {
        throw new Error('No cache available');
      }
    } catch (_) {
      // Fetch from API as last resort
      cache.llms = await LlmsService.listModels(
        {},
        {
          user_id: lettaAgentsId,
        },
      );

      // Cache the result with TTL
      await redis.setex(cacheKey, MODELS_CACHE_TTL, JSON.stringify(cache.llms));

      cache.hasCheckedSourceOfTruth = true;

      return cache.llms.find(
        (model) => model.handle === handle,
      );
    }
  }

  /**
   * Retrieves all available LLM models, using cache when possible.
   *
   * @returns Array of all available LLM configurations
   */
  async function getAllCachedLLMConfigs(): Promise<ListModelsResponse> {
    // Check Redis cache for models list
    const redis = createRedisInstance();
    const cacheKey = `${MODELS_CACHE_KEY}:${lettaAgentsId}`;

    try {
      // Check in-memory store first
      if (cache.llms) {
        return cache.llms;
      }

      // Check Redis cache
      const cachedModels = await redis.get(cacheKey);

      if (cachedModels) {
        cache.llms = JSON.parse(cachedModels);

        if (!Array.isArray(cache.llms)) {
          throw new Error('Invalid cache format');
        }

        return cache.llms;
      } else {
        throw new Error('No cache available');
      }
    } catch (_) {
      // Fetch from API as last resort
      cache.llms = await LlmsService.listModels(
        {},
        {
          user_id: lettaAgentsId,
        },
      );

      // Cache the result with TTL
      await redis.setex(cacheKey, MODELS_CACHE_TTL, JSON.stringify(cache.llms));

      cache.hasCheckedSourceOfTruth = true;

      return cache.llms;
    }
  }

  return {
    getCachedLLMConfig,
    getAllCachedLLMConfigs,
  };
}
