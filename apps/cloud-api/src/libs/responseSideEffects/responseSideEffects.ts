import type { Request } from 'express';
import { deleteShareChatOnIdentityDelete } from '@letta-cloud/utils-server';

export function responseSideEffects(req: Request) {
  if (req.path.startsWith('/v1/identities') && req.method === 'DELETE') {
    void deleteShareChatOnIdentityDelete(req.url, req.method);
  }
}
