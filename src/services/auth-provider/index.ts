/**
 * Public barrel for the external auth-provider service.
 * Importing from `@/services/auth-provider` is the supported surface;
 * deep imports into individual sub-modules are discouraged.
 */

import "./metadata";

export {
  AuthProviderType,
  type AuthProviderMetadata,
  type AuthProviderRecord,
} from "./types";

export {
  registerAuthProvider,
  getAuthProviderMetadata,
  getAllAuthProviders,
} from "./registry";

export {
  AuthProviderCreateSchema,
  AuthProviderUpdateSchema,
  type AuthProviderCreateInput,
  type AuthProviderUpdateInput,
} from "./schemas";

export {
  listAll,
  listEnabled,
  listEnabledDisplayOnly,
  findById,
  findByProviderId,
  create,
  update,
  remove,
  countLinkedAccounts,
} from "./repository";

export { validateUpdateIssuerUrl } from "./schemas";
