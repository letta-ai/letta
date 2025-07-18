const Redis = require('ioredis');

// Initialize Redis client with reconnection options
const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD,
  keyPrefix: `next-cache:${process.env.GIT_HASH}:`,
  retryStrategy(times) {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  maxRetriesPerRequest: 3,
});

redis.on('error', (error) => {
  console.error('Redis connection error:', error);
});

module.exports = class RedisCache {
  constructor(options) {
    this.options = options;
    this.redis = redis;
  }

  async get(key) {
    try {
      const data = await this.redis.get(key);
      if (!data) return null;

      return JSON.parse(data);
    } catch (error) {
      console.error('Redis cache get error:', error);
      return null;
    }
  }

  async set(key, data, ctx) {
    try {
      // Store the data with tags for later revalidation
      const value = JSON.stringify({
        value: data,
        tags: ctx.tags || [],
        lastModified: Date.now(),
      });

      // Optional: Set TTL if provided in options
      if (this.options?.ttl) {
        await this.redis.set(key, value, 'EX', this.options.ttl);
      } else {
        await this.redis.set(key, value, 'EX', 60 * 60); // Default TTL of 1 hour
      }

      // Store a reference to this key for each tag for faster revalidation
      if (ctx.tags && ctx.tags.length > 0) {
        for (const tag of ctx.tags) {
          await this.redis.sadd(`tag:${tag}`, key);
        }
      }
    } catch (error) {
      console.error('Redis cache set error:', error);
    }
  }

  async revalidateTag(tags) {
    try {
      // Ensure tags is an array
      tags = Array.isArray(tags) ? tags : [tags];

      for (const tag of tags) {
        // Get all keys associated with this tag
        const keys = await this.redis.smembers(`tag:${tag}`);

        if (keys.length > 0) {
          // Delete all keys associated with this tag
          await this.redis.del(...keys);

          // Remove the tag set itself
          await this.redis.del(`tag:${tag}`);
        }
      }
    } catch (error) {
      console.error('Redis cache revalidateTag error:', error);
    }
  }

  // Optional: Reset request cache (useful for middleware)
  resetRequestCache() {
    // This method is called before each request
    // You can implement per-request caching here if needed
  }
};
