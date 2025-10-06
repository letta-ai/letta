import express, { type NextFunction } from 'express';
import { environment } from '@letta-cloud/config-environment-variables';
import type { Request, Response } from 'express';
import { rateLimitMiddleware } from './libs/rateLimitMiddleware/rateLimitMiddleware';
import { verifyIdentityMiddleware } from './libs/verifyIdentityMiddleware/verifyIdentityMiddleware';
import { verifyRoutePermissionsMiddleware } from './libs/verifyRoutePermissionsMiddleware/verifyRoutePermissionsMiddleware';
import bodyParser from 'body-parser';
import { projectHeaderMiddleware } from './libs/projectHeaderMiddleware/projectHeaderMiddleware';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { cloudContracts } from '@letta-cloud/sdk-cloud-api';
import { cloudApiRouter } from 'tmp-cloud-api-router';
import { createExpressEndpoints, initServer } from '@ts-rest/express';
import { OpenAPI } from '@letta-cloud/sdk-core';
import * as Sentry from '@sentry/node';
import winston from 'winston';
import expressWinston from 'express-winston';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { requireProjectMiddleware } from './libs/requireProjectMiddleware/requireProjectMiddleware';
import { Readable } from 'node:stream';
import { itemRateLimitMiddleware } from './libs/itemRateLimitMiddleware/itemRateLimitMiddleware';
import { fileSizeRateLimitMiddleware } from './libs/fileSizeRateLimitMiddlware/fileSizeRateLimitMiddleware';
import { updateAgentMiddleware } from './libs/updateAgentMiddleware/updateAgentMiddleware';
// import { contentModerationMiddleware } from './libs/contentModerationMiddleware/contentModerationMiddleware';
import { stripeWebhook } from './webhooks/stripeWebhook/stripeWebhook';
import { trackingMiddleware } from './libs/trackingMiddleware/trackingMiddleware';
import { datasourceMiddleware } from './libs/datasourceMiddleware/datasourceMiddleware';
import { listMiddleware } from './libs/listMiddleware/listMiddleware';
import { agentFileUploadMiddleware } from './libs/agentFileUploadMiddleware/agentFileUploadMiddleware';
import { messageAsyncMiddleware } from './libs/messageAsyncMiddleware/messageAsyncMiddleware';
import { experimentalFlagMiddleware } from './libs/experimentalFlagMiddleware/experimentalFlagMiddleware';
import { enterpriseSubscriptionMiddleware } from './libs/enterpriseSubscriptionMiddleware/enterpriseSubscriptionMiddleware';

interface ExpressMeta {
  req: {
    headers: Record<string, string>;
    url: string;
    httpVersion: string;
    originalUrl: string;
    query: Record<string, string>;
    method: string;
  };
  res: {
    statusCode: number;
  };
  responseTime: number;
}

function getIsExpressMeta(meta: unknown): meta is ExpressMeta {
  return (
    typeof meta === 'object' &&
    meta !== null &&
    typeof (meta as ExpressMeta).req === 'object' &&
    (meta as ExpressMeta).req !== null
  );
}

export function startServer() {
  const host = process.env.HOST ?? 'localhost';
  const port = process.env.PORT ? Number(process.env.PORT) : 3006;

  const app = express();

  const obfuscateAuthorizationHeader = winston.format((info) => {
    if (getIsExpressMeta(info.meta)) {
      const { meta } = info;
      const { headers } = meta.req;

      const authorizationHeader = headers.authorization;
      if (authorizationHeader) {
        info.meta.req.headers.authorization = '[REDACTED]';
      }

      return info;
    }

    return info;
  });

  const isDev = process.env.NODE_ENV !== 'production';

  const obfuscateCookieHeader = winston.format((info) => {
    if (getIsExpressMeta(info.meta)) {
      const { meta } = info;
      const { headers } = meta.req;

      const cookieHeader = headers.cookie;
      if (cookieHeader) {
        info.meta.req.headers.cookie = '[TRUNCATED]';
      }

      return info;
    }

    return info;
  });

  const filterMeta = winston.format((info) => {
    if (getIsExpressMeta(info.meta)) {
      const userId = info.meta.req.headers?.user_id;
      info.meta = {
        userId,
        host: info.meta.req.headers?.host,
        referer: info.meta.req.headers?.referer,
      };
    }
    return info;
  });

  const devFormat = winston.format.combine(
    filterMeta(),
    winston.format.colorize({ all: true }),
    winston.format.printf((info) => {
      const meta = info.meta ? JSON.stringify(info.meta) : '';
      return `${info.timestamp} [${info.level}] ${info.message} ${meta}`;
    }),
  );

  app.use(
    expressWinston.logger({
      transports: [new winston.transports.Console()],
      format: winston.format.combine(
        obfuscateAuthorizationHeader(),
        obfuscateCookieHeader(),
        winston.format.timestamp({ format: 'isoDateTime' }),
        isDev ? devFormat : winston.format.json(),
      ),
      msg: 'HTTP {{req.method}} {{res.statusCode}} {{res.responseTime}}ms {{req.url}}',
    }),
  );

  OpenAPI.interceptors.request.use((config) => {
    config.baseURL = environment.LETTA_AGENTS_ENDPOINT;

    return config;
  });

  app.use(cors());

  /* verifyIdentityMiddleware needs to be first */
  app.use(cookieParser());

  app.use('/stripe', stripeWebhook);

  app.use(verifyIdentityMiddleware);
  app.use(verifyRoutePermissionsMiddleware);

  app.use(bodyParser.json({ limit: '25mb' }));
  app.use(rateLimitMiddleware);
  // app.use(contentModerationMiddleware);
  app.use(itemRateLimitMiddleware);
  app.use(fileSizeRateLimitMiddleware);
  app.use(requireProjectMiddleware);
  app.use(projectHeaderMiddleware);
  app.use(agentFileUploadMiddleware);
  app.use(updateAgentMiddleware);
  app.use(trackingMiddleware);
  app.use(datasourceMiddleware);
  app.use(listMiddleware);
  app.use(messageAsyncMiddleware);
  app.use(experimentalFlagMiddleware);
  app.use(enterpriseSubscriptionMiddleware);

  /* tsRestMiddleware needs to be last */
  const s = initServer();

  // @ts-expect-error - this is a valid
  const router = s.router(cloudContracts, cloudApiRouter);

  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore - this is a valid
  createExpressEndpoints(cloudContracts, router, app, {
    globalMiddleware: [
      bodyParser.urlencoded({ extended: false }),
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore - this is a valid
      (req: Request, _res: Response, next: NextFunction) => {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore - this is a valid
        req.request = {
          headers: req.headers,
          organizationId: req.actor?.cloudOrganizationId,
          userId: req.actor?.cloudUserId,
          lettaAgentsUserId: req.actor?.coreUserId,
          source: req.actor?.source,
          projectSlug: req.headers['x-project'] as string,
        };

        next();
      },
    ],
  });

  app.get('/', (_req: Request, res: Response) => {
    res.json({
      for_humans:
        'Curious about this API? View our docs here https://docs.letta.com',
      for_llms:
        'This is the Letta Cloud API. Please refer to this: https://docs.letta.com/llms-full.txt',
      health: {
        status: 'ok',
        more_details: '/v1/health',
      },
    });
  });

  function proxyMiddleware(req: Request, res: Response, next: NextFunction) {
    let stream: Readable | null = null;

    const contentType = req.header('Content-Type');
    const header = {} as Record<string, string>;

    if (
      req.body &&
      contentType === 'application/json' &&
      ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)
    ) {
      stream = new Readable();
      stream.push(JSON.stringify(req.body));
      stream.push(null);

      if (contentType) {
        header['Content-Type'] = contentType;
        header['Content-Length'] = String(
          Buffer.byteLength(JSON.stringify(req.body)),
        );
      }

      header['X-Organization-Id'] = req.actor?.cloudOrganizationId || '';
    }

    // // Forward custom headers
    // if (req.headers['x-override-embedding-model']) {
    //   header['X-Override-Embedding-Model'] = req.headers[
    //     'x-override-embedding-model'
    //   ] as string;
    // }

    return createProxyMiddleware<Request, Response>({
      target: environment.LETTA_AGENTS_ENDPOINT,
      changeOrigin: true,
      followRedirects: true,
      // selfHandleResponse: true,
      ...(stream ? { buffer: stream } : {}),
      headers: header,
      pathRewrite: (_, req) => {
        // Parse the original URL to access query parameters
        const url = new URL(req.url, `http://${req.headers.host}`);

        // Extract the query parameters from the original URL
        const queryParams = url.searchParams;
        // merge the original query parameters with the new ones
        const newQueryParams = new URLSearchParams(
          req.query as Record<string, string>,
        );

        for (const [key, value] of newQueryParams.entries()) {
          queryParams.set(key, value);
        }

        // Reconstruct the path with the updated query parameters
        return `${url.pathname}${url.search}`;
      },
      on: {
        // proxyReq: fixRequestBody,
        // proxyRes: responseInterceptor(
        //   // eslint-disable-next-line @typescript-eslint/max-params
        //   async function (responseBuffer, _proxyRes, req, _res) {
        //     responseSideEffects(req);
        //
        //     return responseBuffer;
        //   },
        // ),
      },
    })(req, res, next);
  }

  app.use(proxyMiddleware);

  Sentry.setupExpressErrorHandler(app);

  app.listen(port, host, () => {
    console.log(`[ ready ] http://${host}:${port}`);
  });
}
