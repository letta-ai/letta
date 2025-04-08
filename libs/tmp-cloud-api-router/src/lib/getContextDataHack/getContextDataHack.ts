import { get } from 'lodash-es';
import type { SDKContext } from '../types';

export function getContextDataHack(
  req: any,
  context: any,
): SDKContext['request'] {
  return get(req, 'req.request') || get(context, 'request');
}
