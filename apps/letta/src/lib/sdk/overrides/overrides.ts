import type { NextRequest } from 'next/server';
import { generateStandardUnauthorizedResponse } from '$letta/sdk/generateStandardUnauthorizedResponse';
import { defaultValidatePublicAPIHandler } from '$letta/sdk';

interface RequestData<QueryData, BodyData, ParamsData> {
  body: BodyData;
  params: ParamsData;
  query: QueryData;
  organizationId: string;
  userId: string;
  lettaAgentsUserId: string;
}

type ResponsePayload<TResponseData> =
  | {
      body: TResponseData;
      status: number;
    }
  | {
      status: number;
      body: {
        message: string;
      };
    };

type RequestHandler<TResponseData, TQueryData, TBodyData, TParamsData> = (
  requestData: RequestData<TQueryData, TBodyData, TParamsData>
) => Promise<ResponsePayload<TResponseData>>;

export function createSDKRouteOverride<
  TResponseData,
  TQueryData,
  TBodyData,
  TParamsData
>(handler: RequestHandler<TResponseData, TQueryData, TBodyData, TParamsData>) {
  return async function requestHandler(
    req: NextRequest,
    context: { params: TParamsData }
  ) {
    let body: TBodyData;

    const validation = await defaultValidatePublicAPIHandler(req);

    if (!validation) {
      return generateStandardUnauthorizedResponse();
    }

    try {
      body = req.json() as TBodyData;
    } catch (_e) {
      body = undefined as TBodyData;
    }

    const query = Array.from(req.nextUrl.searchParams.entries()).reduce(
      (acc, [key, value]) => {
        // @ts-expect-error - yes, I know what I'm doing
        acc[key] = value;
        return acc;
      },
      {} as TQueryData
    );

    const response = await handler({
      query,
      body,
      params: context.params,
      organizationId: validation.organizationId,
      lettaAgentsUserId: validation.lettaAgentsId,
      userId: validation.id,
    });

    return new Response(JSON.stringify(response.body), {
      status: response.status,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  };
}
