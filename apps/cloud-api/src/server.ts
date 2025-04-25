import express, { type NextFunction } from 'express';
import { environment } from '@letta-cloud/config-environment-variables';
import type { Request, Response } from 'express';
import { rateLimitMiddleware } from './libs/rateLimitMiddleware/rateLimitMiddleware';
import { verifyIdentityMiddleware } from './libs/verifyIdentityMiddleware/verifyIdentityMiddleware';
import { verifyRoutePermissionsMiddleware } from './libs/verifyRoutePermissionsMiddleware/verifyRoutePermissionsMiddleware';
import bodyParser from 'body-parser';
import { projectHeaderMiddleware } from './libs/projectHeaderMiddleware/projectHeaderMiddleware';
import {
  createProxyMiddleware,
  responseInterceptor,
} from 'http-proxy-middleware';
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
import { responseSideEffects } from './libs/responseSideEffects/responseSideEffects';
import { Readable } from 'node:stream';

interface ExpressMeta {
  req: {
    headers: Record<string, string>;
    url: string;
    httpVersion: string;
    originalUrl: string;
    query: Record<string, string>;
  };
  res: {
    statusCode: number;
  };
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

  app.use(
    expressWinston.logger({
      transports: [new winston.transports.Console()],
      format: winston.format.combine(
        obfuscateAuthorizationHeader(),
        winston.format.json(),
      ),
      meta: true, // optional: control whether you want to log the meta data about the request (default to true)
      msg: 'HTTP {{req.method}} {{req.url}}', // optional: customize the default logging message. E.g. "{{res.statusCode}} {{req.method}} {{res.responseTime}}ms {{req.url}}"
      colorize: false,
      level: 'info',
    }),
  );

  OpenAPI.interceptors.request.use((config) => {
    config.baseURL = environment.LETTA_AGENTS_ENDPOINT;

    return config;
  });

  app.use(cors());

  /* verifyIdentityMiddleware needs to be first */
  app.use(cookieParser());
  app.use(verifyIdentityMiddleware);
  app.use(verifyRoutePermissionsMiddleware);

  app.use(bodyParser.json());
  app.use(rateLimitMiddleware);
  app.use(requireProjectMiddleware);
  app.use(projectHeaderMiddleware);

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
    }

    return createProxyMiddleware<Request, Response>({
      target: environment.LETTA_AGENTS_ENDPOINT,
      changeOrigin: true,
      followRedirects: true,
      selfHandleResponse: true,
      ...(stream ? { buffer: stream } : {}),
      headers: header,
      on: {
        // proxyReq: fixRequestBody,
        proxyRes: responseInterceptor(
          // eslint-disable-next-line @typescript-eslint/max-params
          async function (responseBuffer, _proxyRes, req, _res) {
            responseSideEffects(req);

            return responseBuffer;
          },
        ),
      },
    })(req, res, next);
  }

  app.use(proxyMiddleware);

  Sentry.setupExpressErrorHandler(app);

  app.listen(port, host, () => {
    console.log(`[ ready ] http://${host}:${port}`);
  });
}
