import { getUserActiveOrganizationIdOrThrow } from '$web/server/auth';
import * as process from 'node:process';
import { router } from '$web/web-api/router';

export async function POST() {
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

  await router.admin.models.createAdminInferenceModel({
    body: {
      modelName: 'gpt-4o-mini',
      modelEndpoint: 'https://api.openai.com/v1',
    },
  });

  return new Response(
    JSON.stringify({
      message: 'Added model',
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    },
  );
}
