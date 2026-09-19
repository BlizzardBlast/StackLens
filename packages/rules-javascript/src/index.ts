export {
  createDependencyInventoryEvidence,
  dependencyInventoryEvidenceId,
  dependencyInventoryFactId,
  dependencyInventoryRule,
} from "./dependency-inventory.js";

export { normalizePackageManifest, PACKAGE_DEPENDENCY_GROUPS } from "./manifest.js";
export type {
  NormalizedDependencyDeclaration,
  NormalizedPackageManifest,
  PackageDependencyGroup,
} from "./manifest.js";
