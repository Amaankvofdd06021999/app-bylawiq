import 'server-only';
import { AppError } from './errors';
import groups from './env-groups.json';

/**
 * Environment variables by feature. A feature is enabled only when every variable it lists is present.
 * Reports and errors carry variable NAMES only, never values.
 * Keep docs/ENVIRONMENT.md in step with this list.
 */
export const CONFIG_GROUPS: Record<string, readonly string[]> = groups;

export type ConfigGroup = keyof typeof groups;

type Env = Record<string, string | undefined>;

/** Names of the variables a group needs that are missing or empty. Pure: takes the environment as an argument. */
export function missingConfig(group: ConfigGroup, env: Env = process.env): string[] {
  return CONFIG_GROUPS[group].filter((name) => !env[name] || env[name]?.trim() === '');
}

export function isGroupConfigured(group: ConfigGroup, env: Env = process.env): boolean {
  return missingConfig(group, env).length === 0;
}

/** Throws a clear configuration error naming the missing variables. The message never includes a value. */
export function assertConfig(group: ConfigGroup, env: Env = process.env): void {
  const missing = missingConfig(group, env);
  if (missing.length > 0) {
    throw new AppError(
      'config_error',
      `Missing configuration for ${group}: ${missing.join(', ')}. Set these variables in the deployment environment.`,
      503,
    );
  }
}
