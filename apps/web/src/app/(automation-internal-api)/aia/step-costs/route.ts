import type { NextRequest } from 'next/server';
import { getUserActiveOrganizationIdOrThrow } from '$web/server/auth';
import * as process from 'node:process';
import { db, inferenceModelsMetadata } from '@letta-cloud/database';
import { eq } from 'drizzle-orm';
import { router } from '$web/web-api/router';

export async function POST(req: NextRequest) {
  const organizationId = await getUserActiveOrganizationIdOrThrow();

  if (
    !(
      process.env.IS_CYPRESS_RUN === 'yes' ||
      process.env.NODE_ENV !== 'production'
    )
  ) {
    return new Response(
      JSON.stringify({
        message: 'Unauthorized',
      }),
      {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
        },
      },
    );
  }

  if (!organizationId) {
    return new Response(
      JSON.stringify({
        message: 'Unauthorized',
      }),
      {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
        },
      },
    );
  }

  const { modelName, stepCost } = await req.json();

  const model = await db.query.inferenceModelsMetadata.findFirst({
    where: eq(inferenceModelsMetadata.modelName, modelName),
  });

  if (!model) {
    return new Response(
      JSON.stringify({
        message: 'Model not found',
      }),
      {
        status: 404,
        headers: {
          'Content-Type': 'application/json',
        },
      },
    );
  }

  await router.admin.models.updateStepCosts({
    params: {
      id: model.id,
    },
    body: {
      version: '1',
      data: [
        {
          maxContextWindowSize: 999999999,
          cost: stepCost,
        },
      ],
    },
  });

  return new Response(
    JSON.stringify({
      message: 'Projects deleted',
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    },
  );
}
