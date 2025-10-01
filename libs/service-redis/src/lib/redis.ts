import type { RedisOptions } from 'ioredis';
import Redis from 'ioredis';
import { environment } from '@letta-cloud/config-environment-variables';
import { hasPopulateOnMissFn } from '../schemas';
import type { RedisTypes, RedisDefinitionMap } from '../schemas';
import { redisDefinitions } from '../schemas';
import type { z } from 'zod';

const BOUNCE = 200;
const MAX_BOUNCE = 1000;
const TOTAL_RETRIES = 3;

let redisInstance: Redis | null = null;

const options: RedisOptions = {
  host: environment.REDIS_HOST,
  lazyConnect: true,
  showFriendlyErrorStack: true,
  enableAutoPipelining: true,
  maxRetriesPerRequest: 0,
  retryStrategy: (times: number) => {
    if (times > TOTAL_RETRIES) {
      throw new Error(`[Redis] Could not connect after ${times} attempts`);
    }

    return Math.min(times * BOUNCE, MAX_BOUNCE);
  },
};

if (environment.REDIS_PORT) {
  options.port = environment.REDIS_PORT;
}

if (environment.REDIS_PASSWORD) {
  options.password = environment.REDIS_PASSWORD;
}

export function createRedisInstance() {
  try {
    if (!redisInstance) {
      redisInstance = new Redis(options);

      redisInstance.on('error', (error: unknown) => {
        console.warn('[Redis] Error connecting', error);
      });
    }

    return redisInstance;
  } catch (_) {
    throw new Error(`[Redis] Could not create a Redis instance`);
  }
}

export function destroyRedisInstance() {
  if (redisInstance) {
    redisInstance.disconnect();
    redisInstance = null;
  }
}

export async function testRedisConnection() {
  console.log(
    `[Redis] Testing connection... at ${environment.REDIS_HOST}:${environment.REDIS_PORT}`,
  );

  const redis = createRedisInstance();

  await redis.ping();
}

function ensureRedisShape(object: string, definition: z.ZodObject<any, any>) {
  try {
    definition.parse(JSON.parse(object));

    return true;
  } catch (_e) {
    return false;
  }
}

export async function getRedisData<Type extends RedisTypes = RedisTypes>(
  type: Type,
  args: z.infer<(typeof redisDefinitions)[Type]['input']>,
): Promise<z.infer<RedisDefinitionMap[Type]['output']> | null> {
  const redis = createRedisInstance();

  const res = await redis.get(redisDefinitions[type].getKey(args));

  if (!res || !ensureRedisShape(res, redisDefinitions[type].output)) {
    if (hasPopulateOnMissFn(redisDefinitions[type])) {
      const data = await redisDefinitions[type].populateOnMissFn(args);

      if (data) {
        await setRedisData(type, args, {
          data: data.data,
          expiresAt: data.expiresAt,
        });

        return data.data;
      }
    }

    return null;
  }

  try {
    return JSON.parse(res);
  } catch (_) {
    return null;
  }
}

// eslint-disable-next-line @typescript-eslint/max-params
export async function createUniqueRedisProperty<
  Type extends RedisTypes = RedisTypes,
>(
  type: Type,
  args: z.infer<(typeof redisDefinitions)[Type]['input']>,
  field: string,
  options: SetRedisDataOptions<
    z.infer<(typeof redisDefinitions)[Type]['output']>
  >,
) {
  const { data, expiresAt } = options;
  const redis = createRedisInstance();

  const keyName = redisDefinitions[type].getKey(args);

  const res = await redis.hsetnx(keyName, field, JSON.stringify(data));

  if (expiresAt) {
    await redis.expireat(keyName, expiresAt);
  }

  return res === 1;
}

interface SetRedisDataOptions<Data> {
  expiresAt?: number;
  data: Data;
}

export async function setRedisData<Type extends RedisTypes = RedisTypes>(
  type: Type,
  args: z.infer<(typeof redisDefinitions)[Type]['input']>,
  options: SetRedisDataOptions<
    z.infer<(typeof redisDefinitions)[Type]['output']>
  >,
) {
  const redis = createRedisInstance();
  const { data, expiresAt } = options;

  const keyName = redisDefinitions[type].getKey(args);

  await redis.set(keyName, JSON.stringify(data));

  if (expiresAt) {
    await redis.expireat(keyName, expiresAt);
  }
}

export async function deleteRedisData<Type extends RedisTypes = RedisTypes>(
  type: Type,
  args: z.infer<(typeof redisDefinitions)[Type]['input']>,
) {
  const redis = createRedisInstance();

  await redis.del(redisDefinitions[type].getKey(args));
}

export async function deleteRedisHashField<Type extends RedisTypes = RedisTypes>(
  type: Type,
  args: z.infer<(typeof redisDefinitions)[Type]['input']>,
  field: string,
) {
  const redis = createRedisInstance();

  await redis.hdel(redisDefinitions[type].getKey(args), field);
}
