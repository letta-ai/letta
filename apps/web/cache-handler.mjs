import { createClient } from 'redis';
import { PHASE_PRODUCTION_BUILD } from 'next/constants.js';
import { Next15CacheHandler as CacheHandler } from '@fortedigital/nextjs-cache-handler';
import { LRUCache } from 'lru-cache';
import createRedisHandler from '@fortedigital/nextjs-cache-handler/redis-strings';
import createCompositeHandler from '@fortedigital/nextjs-cache-handler/composite';

CacheHandler.onCreation(({ buildId }) => {
  // Important - It's recommended to use global scope to ensure only one Redis connection is made
  // This ensures only one instance get created
  if (global.cacheHandlerConfig) {
    return global.cacheHandlerConfig;
  }

  // Important - It's recommended to use global scope to ensure only one Redis connection is made
  // This ensures new instances are not created in a race condition
  if (global.cacheHandlerConfigPromise) {
    return global.cacheHandlerConfigPromise;
  }

  // Main promise initializing the handler
  global.cacheHandlerConfigPromise = (async () => {
    let redisClient = null;

    if (PHASE_PRODUCTION_BUILD !== process.env.NEXT_PHASE) {
      try {
        redisClient = createClient({
          host: process.env.REDIS_HOST || 'localhost',
          port: process.env.REDIS_PORT || 6379,
          password: process.env.REDIS_PASSWORD,
          keyPrefix: 'next-cache:',
          retryStrategy(times) {
            const delay = Math.min(times * 50, 2000);
            return delay;
          },
          pingInterval: 10000, // Ping Redis every 10 seconds to keep the connection alive
          maxRetriesPerRequest: 3
        });
        redisClient.on('error', (e) => {
          if (typeof process.env.NEXT_PRIVATE_DEBUG_CACHE !== 'undefined') {
            console.warn('Redis error', e);
          }
          global.cacheHandlerConfig = null;
          global.cacheHandlerConfigPromise = null;
        });
      } catch (error) {
        console.warn('Failed to create Redis client:', error);
      }
    }

    if (redisClient) {
      try {
        console.info('Connecting Redis client...');
        await redisClient.connect();
        console.info('Redis client connected.');
      } catch (error) {
        console.warn('Failed to connect Redis client:', error);
        await redisClient
          .disconnect()
          .catch(() =>
            console.warn(
              'Failed to quit the Redis client after failing to connect.'
            )
          );
      }
    }


    const lruCache = new LRUCache({
      max: 1000, // Adjust the max size of the cache as needed
    });

    if (!redisClient?.isReady) {
      console.error('Failed to initialize caching layer.');


      global.cacheHandlerConfigPromise = null;
      global.cacheHandlerConfig = { handlers: [lruCache] };
      return global.cacheHandlerConfig;
    }

    const redisCacheHandler = createRedisHandler({
      client: redisClient,

      keyPrefix: `nextjs:${buildId}:`,
    });

    global.cacheHandlerConfigPromise = null;

    // This example uses composite handler to switch from Redis to LRU cache if tags contains `memory-cache` tag.
    // You can skip composite and use Redis or LRU only.
    global.cacheHandlerConfig = {
      ttl: {
        defaultStaleAge: 3600,
        estimateExpireAge: (staleAge) => staleAge * 2,
      },
      handlers: [
        createCompositeHandler({
          handlers: [lruCache, redisCacheHandler],
          setStrategy: (ctx) => (ctx?.tags.includes('memory-cache') ? 0 : 1) // You can adjust strategy for deciding which cache should the composite use
        })
      ]
    };

    return global.cacheHandlerConfig;
  })();

  return global.cacheHandlerConfigPromise;
});

export default CacheHandler;
