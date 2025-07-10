import { createRedisInstance } from '@letta-cloud/service-redis';
import { OBSERVABILITY_CACHE_TTL_SECONDS } from './constants';

export function createObservabilityCacheKey(
  handlerName: string,
  params: Record<string, unknown>,
): string {
  const sortedParams = Object.keys(params)
    .sort()
    .reduce((result: Record<string, unknown>, key) => {
      result[key] = params[key];
      return result;
    }, {});

  const paramsHash = Buffer.from(JSON.stringify(sortedParams)).toString(
    'base64',
  );
  return `observability_${handlerName}_1:${paramsHash}`;
}

export async function getObservabilityCache<T>(
  handlerName: string,
  params: Record<string, unknown>,
): Promise<T | null> {
  try {
    const redis = createRedisInstance();
    const cacheKey = createObservabilityCacheKey(handlerName, params);

    const cachedData = await redis.get(cacheKey);
    if (cachedData) {
      return JSON.parse(cachedData) as T;
    }

    return null;
  } catch (error) {
    // If Redis is unavailable, throw error
    throw new Error(`Redis cache unavailable: ${error}`);
  }
}

export async function setObservabilityCache<T>(
  handlerName: string,
  params: Record<string, unknown>,
  data: T,
): Promise<void> {
  try {
    const redis = createRedisInstance();
    const cacheKey = createObservabilityCacheKey(handlerName, params);

    await redis.setex(
      cacheKey,
      OBSERVABILITY_CACHE_TTL_SECONDS,
      JSON.stringify(data),
    );
  } catch (error) {
    // If Redis is unavailable, throw error
    throw new Error(`Redis cache unavailable: ${error}`);
  }
}
