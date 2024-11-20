import type { RedisOptions } from 'ioredis';
import Redis from 'ioredis';
import { environment } from '@letta-web/environmental-variables';
import type { RedisTypes, RedisKeySchemaMap } from '../schemas';
import { redisTypeKeyMap } from '../schemas';

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

function createRedisInstance() {
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

export async function getRedisData<Type extends RedisTypes = RedisTypes>(
  type: Type,
  key: string
): Promise<RedisKeySchemaMap[Type] | null> {
  const redis = createRedisInstance();

  const res = await redis.get(redisTypeKeyMap[type](key));

  if (!res) {
    return null;
  }

  try {
    return JSON.parse(res);
  } catch (_) {
    return null;
  }
}

interface SetRedisDataOptions<Data> {
  expiresAt?: number;
  data: Data;
}

export async function setRedisData<Type extends RedisTypes = RedisTypes>(
  type: Type,
  key: string,
  options: SetRedisDataOptions<RedisKeySchemaMap[Type]>
) {
  const redis = createRedisInstance();
  const { data, expiresAt } = options;

  const keyName = redisTypeKeyMap[type](key);

  await redis.set(keyName, JSON.stringify(data));

  if (expiresAt) {
    await redis.expireat(keyName, expiresAt);
  }
}

export async function deleteRedisData<Type extends RedisTypes = RedisTypes>(
  type: Type,
  key: string
) {
  const redis = createRedisInstance();

  await redis.del(redisTypeKeyMap[type](key));
}
