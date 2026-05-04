/**
 * Typed feature flags from login response (80+ in legacy app).
 * Extend as each flag is mapped from the wire format.
 */
export type FeatureFlags = Record<string, boolean | string | number>;
