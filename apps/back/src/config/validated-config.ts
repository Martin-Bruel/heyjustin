import { type ConfigObject, registerAs } from '@nestjs/config';
import type { z } from 'zod';

/** A configuration namespace failed validation: the app does not start. */
export class InvalidConfigError extends Error {
  constructor(namespace: string, issues: string[]) {
    super(
      `Invalid configuration for "${namespace}":\n${issues.map((issue) => `  - ${issue}`).join('\n')}`,
    );
    this.name = 'InvalidConfigError';
  }
}

/**
 * A typed configuration namespace, validated when its module loads.
 *
 * Each module declares the env variables it needs next to its code, and
 * registers the result with `ConfigModule.forFeature(myConfig)`. Classes
 * inject it typed: `@Inject(myConfig.KEY) private readonly myConfig: ConfigType<typeof myConfig>`.
 * Types come from the zod schema: nothing is written twice.
 *
 * Error messages name the variables, never their values (they can be secrets).
 */
export function validatedConfig<
  Schema extends z.ZodType<Record<string, unknown>>,
  Config extends ConfigObject,
>(
  namespace: string,
  schema: Schema,
  toConfig: (env: z.infer<Schema>) => Config,
) {
  return registerAs(namespace, (): Config => {
    const result = schema.safeParse(process.env);
    if (!result.success) {
      throw new InvalidConfigError(
        namespace,
        result.error.issues.map(
          (issue) => `${issue.path.join('.')}: ${issue.message}`,
        ),
      );
    }
    return toConfig(result.data);
  });
}
