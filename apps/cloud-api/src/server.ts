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

export function startServer() {
  const host = process.env.HOST ?? 'localhost';
  const port = process.env.PORT ? Number(process.env.PORT) : 3006;

  const app = express();

  app.use(
    expressWinston.logger({
      transports: [new winston.transports.Console()],
      format: winston.format.combine(winston.format.json()),
      meta: true, // optional: control whether you want to log the meta data about the request (default to true)
      msg: 'HTTP {{req.method}} {{req.url}}', // optional: customize the default logging message. E.g. "{{res.statusCode}} {{req.method}} {{res.responseTime}}ms {{req.url}}"
      colorize: false,
    }),
  );

  OpenAPI.interceptors.request.use((config) => {
    config.baseURL = environment.LETTA_AGENTS_ENDPOINT;

    return config;
  });

  /* verifyIdentityMiddleware needs to be first */
  app.use(verifyIdentityMiddleware);
  app.use(verifyRoutePermissionsMiddleware);
  app.use(rateLimitMiddleware);
  app.use(projectHeaderMiddleware);

  /* tsRestMiddleware needs to be last */
  const s = initServer();

  // @ts-expect-error - this is a valid
  const router = s.router(cloudContracts, cloudApiRouter);

  // @ts-expect-error - this is a valid
  createExpressEndpoints(cloudContracts, router, app, {
    globalMiddleware: [
      bodyParser.json(),
      bodyParser.urlencoded({ extended: false }),
      (req: Request, _res: Response, next: NextFunction) => {
        // @ts-expect-error - transform request to match the expected type
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
    res.send(
      `Curious about this API? View our docs here - <a href="https://docs.letta.com">https://docs.letta.com</a>`,
    );
  });

  const proxyMiddleware = createProxyMiddleware<Request, Response>({
    target: environment.LETTA_AGENTS_ENDPOINT,
    changeOrigin: true,
    followRedirects: true,
  });

  app.use(proxyMiddleware);

  Sentry.setupExpressErrorHandler(app);

  app.listen(port, host, () => {
    console.log(`[ ready ] http://${host}:${port}`);
  });
}
