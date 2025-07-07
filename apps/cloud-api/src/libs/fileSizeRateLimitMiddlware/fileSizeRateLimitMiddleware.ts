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
      return `fileCountUploadWindow2:${organizationId}:${minute}`;
    }

    function getFileSizeUploadWindowKey(
      organizationId: string,
      minute: number,
    ): string {
      return `fileSizeUploadWindow:${organizationId}:${minute}`;
    }

    const rateLimit = limits.filesPerMinute;
    const currentMinute = Math.floor(Date.now() / 60000);

    const redis = createRedisInstance();

    const fileCountUsage = await redis.get(
      getFileCountUploadWindowKey(req.actor.cloudOrganizationId, currentMinute),
    );

    let currentFileUsage;

    try {
      currentFileUsage = parseInt(fileCountUsage || '0', 10);
    } catch (e) {
      Sentry.captureException(e);
      currentFileUsage = 0;
    }

    if (isNaN(currentFileUsage)) {
      Sentry.captureException(new Error('Invalid current usage value'));
      currentFileUsage = 0;
    }

    if (currentFileUsage + 1 > rateLimit) {
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

    await redis.expire(
      getFileCountUploadWindowKey(req.actor.cloudOrganizationId, currentMinute),
      60, // expire in 60 seconds
    );

    const fileSizeUsage = await redis.get(
      getFileSizeUploadWindowKey(req.actor.cloudOrganizationId, currentMinute),
    );

    let currentFileSizeUsage;

    try {
      currentFileSizeUsage = parseInt(fileSizeUsage || '0', 10);
    } catch (e) {
      Sentry.captureException(e);
      currentFileSizeUsage = 0;
    }

    if (isNaN(currentFileSizeUsage)) {
      Sentry.captureException(
        new Error('Invalid current file size usage value'),
      );
      currentFileSizeUsage = 0;
    }

    if (
      currentFileSizeUsage + Number(contentLength) >
      limits.fileSizePerMinute
    ) {
      res.status(429).json({
        error:
          'File upload size rate limit exceeded - too much data uploaded in a minute',
        errorCode: 'file_upload_size_rate_limit_exceeded',
        limit: `${bytesToMB(limits.fileSizePerMinute)} MB`,
        limit_bytes: limits.fileSizePerMinute,
      });
      return;
    }

    await redis.incrby(
      getFileSizeUploadWindowKey(req.actor.cloudOrganizationId, currentMinute),
      Number(contentLength),
    );

    await redis.expire(
      getFileSizeUploadWindowKey(req.actor.cloudOrganizationId, currentMinute),
      60, // expire in 60 seconds
    );

    next();
  } catch (e) {
    // if this code fails, this is our issue, so we should not throw an error
    Sentry.captureException(e);

    next();
  }
}
