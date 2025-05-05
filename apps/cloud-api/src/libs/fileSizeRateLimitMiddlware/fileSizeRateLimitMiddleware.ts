import type { NextFunction, Request, Response } from 'express';
import pathToRegexp from 'path-to-regexp';
import { getCustomerSubscription } from '@letta-cloud/service-payments';
import { getUsageLimits } from '@letta-cloud/utils-shared';
import { EmbeddingsService } from '@letta-cloud/sdk-core';
import * as Sentry from '@sentry/node';

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

    if (totalDataSize + Number(contentLength) > 3) {
      res.status(413).json({
        error: 'You have reached your storage limit',
        errorCode: 'storage_exceeded',
        limit: `${bytesToMB(limits.storage)} MB`,
        limit_bytes: limits.storage,
      });
      return;
    }

    next();
  } catch (e) {
    // if this code fails, this is our issue, so we should not throw an error
    Sentry.captureException(e);

    next();
  }
}
