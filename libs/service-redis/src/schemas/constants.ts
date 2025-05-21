import type { z, ZodType } from 'zod';

export interface RedisDefinition<
  Type extends string,
  Input,
  Output extends ZodType,
> {
  baseKey: Type;
  input: Input;
  getKey: (args: Input) => `${Type}:${string}`;
  populateOnMissFn?: (
    args: Input,
  ) => Promise<{ expiresAt: number; data: z.infer<Output> } | null>;
  output: Output;
}

export function generateDefinitionSatisfies<
  Definition extends RedisDefinition<string, any, any>,
>(definition: Definition) {
  return definition;
}
