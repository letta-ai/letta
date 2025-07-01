import type { NextFunction, Request, Response } from 'express';
import pathToRegexp from 'path-to-regexp';
import { getCustomerSubscription } from '@letta-cloud/service-payments';
import { getUsageLimits } from '@letta-cloud/utils-shared';
import { EmbeddingsService } from '@letta-cloud/sdk-core';
import * as Sentry from '@sentry/node';
import { createRedisInstance } from '@letta-cloud/service-redis';

const fileUploadRoute = pathToRegexp('/v1/sources/:sourceId/upload');

function bytesToMB(bytes: number): number {
  return bytes / (1024 * 1024);
}

export async function fileSizeRateLimitMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (!fileUploadRoute.test(req.path)) {
    next();
    return;
  }

  if (!req.actor) {
    next();
    return;
  }

  try {
    const contentLength = req.headers['content-length'];

    const subscription = await getCustomerSubscription(
      req.actor.cloudOrganizationId,
    );

    const limits = await getUsageLimits(subscription.tier);

    const fileSize = limits.fileSize;

    if (!contentLength) {
      res.status(400).json({
        error: 'Missing content-length header',
        errorCode: 'missing_content_length',
      });
      return;
    }

    if (Number(contentLength) > fileSize) {
      res.status(413).json({
        error: 'File size exceeds the limit',
        errorCode: 'file_size_exceeded',
        limit: `${bytesToMB(fileSize)} MB`,
        limit_bytes: fileSize,
      });
      return;
    }

    const totalDataSizeInGB = await EmbeddingsService.getTotalStorageSize(
      {},
      {
        user_id: req.actor.coreUserId,
      },
    );

    const totalDataSize = totalDataSizeInGB * 1024 * 1024 * 1024; // convert GB to bytes

    if (totalDataSize + Number(contentLength) > limits.storage) {
      res.status(413).json({
        error: 'You have reached your storage limit',
        errorCode: 'storage_exceeded',
        limit: `${bytesToMB(limits.storage)} MB`,
        limit_bytes: limits.storage,
      });
      return;
    }

    function getFileCountUploadWindowKey(
      organizationId: string,
      minute: number,
    ): string {
      return `fileCountUploadWindow:${organizationId}:${minute}`;
    }

    const rateLimit = limits.filesPerMinute;
    const currentMinute = Math.floor(Date.now() / 60000);

    const redis = createRedisInstance();

    const window = await redis.get(
      getFileCountUploadWindowKey(req.actor.cloudOrganizationId, currentMinute),
    );

    let currentUsage;

    try {
      currentUsage = parseInt(window || '0', 10);
    } catch (e) {
      Sentry.captureException(e);
      currentUsage = 0;
    }

    if (isNaN(currentUsage)) {
      Sentry.captureException(new Error('Invalid current usage value'));
      currentUsage = 0;
    }

    console.log(
      `Current usage for ${req.actor.cloudOrganizationId} at minute ${currentMinute}: ${currentUsage}`,
    );

    if (currentUsage + 1 > rateLimit) {
      res.status(429).json({
        error:
          'File upload rate limit exceeded - too many files uploaded in a minute',
        errorCode: 'file_upload_rate_limit_exceeded',
        limit: rateLimit,
      });
      return;
    }

    await redis.incrby(
      getFileCountUploadWindowKey(req.actor.cloudOrganizationId, currentMinute),
      1,
    );

    next();
  } catch (e) {
    // if this code fails, this is our issue, so we should not throw an error
    Sentry.captureException(e);

    next();
  }
}
