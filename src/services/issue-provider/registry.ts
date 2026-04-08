import { githubMetadata } from "./github/github.metadata";
import { gitlabMetadata } from "./gitlab/gitlab.metadata";
import { jiraMetadata } from "./jira/jira.metadata";
import { linearMetadata } from "./linear/linear.metadata";
import type { ProviderMetadata } from "./metadata";
import { redmineMetadata } from "./redmine/redmine.metadata";

/** Module-level singleton registry mapping provider type string to metadata. */
const registry = new Map<string, ProviderMetadata>();

// Register all built-in providers at module load time.
registerProvider(githubMetadata);
registerProvider(jiraMetadata);
registerProvider(redmineMetadata);
registerProvider(gitlabMetadata);
registerProvider(linearMetadata);

/**
 * Registers a provider's metadata in the registry.
 * Call this once per provider, typically at module load time.
 *
 * @param metadata - The provider metadata to register.
 */
export function registerProvider(metadata: ProviderMetadata): void {
  registry.set(metadata.type, metadata);
}

/**
 * Returns all registered providers sorted by displayName ascending.
 *
 * @returns Array of all registered {@link ProviderMetadata}, sorted alphabetically by displayName.
 */
export function getAllProviders(): ProviderMetadata[] {
  return Array.from(registry.values()).sort((a, b) =>
    a.displayName.localeCompare(b.displayName)
  );
}

/**
 * Returns the metadata for the given provider type string, or `undefined` if not registered.
 *
 * @param type - The provider type string (e.g. `"GITHUB"`).
 * @returns The matching {@link ProviderMetadata}, or `undefined`.
 */
export function getProviderMetadata(type: string): ProviderMetadata | undefined {
  return registry.get(type);
}
