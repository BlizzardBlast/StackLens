export interface JavaScriptOsvVulnerabilityMatch {
  readonly id: string;
}

export interface JavaScriptOsvQueryResult {
  readonly packageName: string;
  readonly version: string;
  readonly matches: readonly JavaScriptOsvVulnerabilityMatch[];
  readonly complete: boolean;
}

export interface JavaScriptOsvSeverity {
  readonly type: string;
  readonly score: string;
  readonly source?: string;
}

export interface JavaScriptOsvAffectedPackage {
  readonly packageName: string;
  readonly ecosystem: string;
  readonly severities: readonly JavaScriptOsvSeverity[];
}

export interface JavaScriptOsvVulnerability {
  readonly id: string;
  readonly withdrawnAt?: string;
  readonly severities: readonly JavaScriptOsvSeverity[];
  readonly affected: readonly JavaScriptOsvAffectedPackage[];
}

export interface JavaScriptOsvSnapshot {
  readonly queryResults: readonly JavaScriptOsvQueryResult[];
  readonly vulnerabilities: readonly JavaScriptOsvVulnerability[];
}

export interface JavaScriptOsvMetadata {
  readonly sourceId: string;
  readonly snapshot: JavaScriptOsvSnapshot;
}

export interface JavaScriptNpmDistTag {
  readonly tag: string;
  readonly version: string;
}

export interface JavaScriptNpmPackageVersion {
  readonly version: string;
  readonly deprecatedMessage?: string;
  readonly publishedAt?: string;
}

export interface JavaScriptNpmPackageSnapshot {
  readonly packageName: string;
  readonly registryCreatedAt?: string;
  readonly registryModifiedAt?: string;
  readonly distTags: readonly JavaScriptNpmDistTag[];
  readonly versions: readonly JavaScriptNpmPackageVersion[];
}

export interface JavaScriptNpmMetadata {
  readonly sourceId: string;
  readonly snapshot: JavaScriptNpmPackageSnapshot;
}

export interface JavaScriptAnalysisMetadata {
  readonly osv?: JavaScriptOsvMetadata;
  readonly npmRegistry?: readonly JavaScriptNpmMetadata[];
}
