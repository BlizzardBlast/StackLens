import { stableIdHash } from "../stable-id.js";
import { NPM_REGISTRY_BASE_URL, NPM_REGISTRY_PROVIDER_ID } from "./types.js";

function packageObservationKey(packageName: string): string {
  return stableIdHash(`${NPM_REGISTRY_PROVIDER_ID}\0${packageName}`);
}

export function npmRegistrySourceId(packageName: string): string {
  return `source-npm-${packageObservationKey(packageName)}`;
}

export function npmRegistryEvidenceId(packageName: string): string {
  return `evidence-npm-${packageObservationKey(packageName)}`;
}

export function npmRegistryFailureId(packageName: string, code: string): string {
  return `failure-npm-${packageObservationKey(packageName)}-${stableIdHash(code)}`;
}

export function npmRegistryPackageUrl(packageName: string): string {
  return new URL(encodeURIComponent(packageName), NPM_REGISTRY_BASE_URL).toString();
}
