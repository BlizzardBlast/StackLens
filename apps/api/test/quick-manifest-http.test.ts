import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";

import { AnalysisReportSchema } from "@stacklens/contracts";
import type { AnalysisRepository } from "@stacklens/persistence";
import type { RepositoryJobQueue } from "@stacklens/repository-jobs";

import {
  createStackLensApi,
  QUICK_MANIFEST_ANALYZER_VERSION,
  QUICK_MANIFEST_RULE_SET_VERSION,
  QUICK_MANIFEST_SCORING_VERSION,
} from "../src/index.js";

const createdAt = "2026-09-22T00:00:00.000Z";
const analysisId = "analysis-quick-http-001";

const repository: AnalysisRepository = {
  async createQueuedRepositoryAnalysis() {
    throw new Error("Quick manifest analysis must not create durable repository state.");
  },
  async findAnalysis() {
    return undefined;
  },
  async findReport() {
    return undefined;
  },
  async claimForExecution() {
    return false;
  },
  async updateProgress() {
    return undefined;
  },
  async markRetryPending() {
    return undefined;
  },
  async complete() {
    return undefined;
  },
  async fail() {
    return undefined;
  },
};

const queue: RepositoryJobQueue = {
  async enqueue() {
    throw new Error("Quick manifest analysis must not enqueue background work.");
  },
};

const openApps: FastifyInstance[] = [];

afterEach(async () => {
  const apps = openApps.splice(0);
  await Promise.all(apps.map(async (app) => app.close()));
});

async function testApi(): Promise<FastifyInstance> {
  const app = await createStackLensApi({
    repository,
    queue,
    createAnalysisId: () => analysisId,
    now: () => createdAt,
  });

  openApps.push(app);
  return app;
}

describe("quick manifest Fastify transport [FR-001, FR-002, FR-004, FR-021]", () => {
  it("analyzes pasted package.json synchronously without persistence", async () => {
    const app = await testApi();
    const secretScript = "never-retain-this-script";

    const response = await app.inject({
      method: "POST",
      url: "/v1/analyze/manifest",
      payload: {
        kind: "paste",
        content: JSON.stringify({
          dependencies: {
            react: "^19.0.0",
          },
          scripts: {
            postinstall: secretScript,
          },
        }),
      },
    });

    expect(response.statusCode).toBe(200);

    const body = response.json();
    expect(body.report.analysisId).toBe(analysisId);
    expect(body.report.createdAt).toBe(createdAt);
    expect(body.report.input.type).toBe("manifest");
    expect(body.report.analyzer).toEqual({
      version: QUICK_MANIFEST_ANALYZER_VERSION,
      ruleSetVersion: QUICK_MANIFEST_RULE_SET_VERSION,
      scoringVersion: QUICK_MANIFEST_SCORING_VERSION,
    });
    expect(body.report.facts).toHaveLength(2);
    expect(body.report.facts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "dependency.inventory",
          subject: expect.objectContaining({ name: "react" }),
        }),
        expect.objectContaining({
          type: "project.tool.ui_library",
          subject: expect.objectContaining({ name: "React" }),
        }),
      ]),
    );
    expect(body.report.scores.overall.status).toBe("insufficient_evidence");
    expect(body.report.limitations).toHaveLength(2);
    expect(JSON.stringify(body.report)).not.toContain(secretScript);
    expect(AnalysisReportSchema.safeParse(body.report).success).toBe(true);
  });

  it("emits manifest-safe tool facts, overlap findings, and recommendations without numeric scoring", async () => {
    const app = await testApi();

    const response = await app.inject({
      method: "POST",
      url: "/v1/analyze/manifest",
      payload: {
        kind: "paste",
        content: JSON.stringify({
          dependencies: {
            expo: "~57.0.23",
            "react-native": "0.86.3",
          },
          devDependencies: {
            "@biomejs/biome": "2.5.13",
            eslint: "10.10.0",
            jest: "~29.7.0",
            typescript: "~6.0.3",
          },
        }),
      },
    });

    expect(response.statusCode).toBe(200);

    const report = response.json().report;
    expect(report.facts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "project.tool.framework",
          subject: expect.objectContaining({ name: "Expo" }),
        }),
        expect.objectContaining({
          type: "project.tool.framework",
          subject: expect.objectContaining({ name: "React Native" }),
        }),
        expect.objectContaining({
          type: "project.tool.linter_formatter",
          subject: expect.objectContaining({ name: "Biome" }),
        }),
        expect.objectContaining({
          type: "project.tool.linter",
          subject: expect.objectContaining({ name: "ESLint" }),
        }),
      ]),
    );
    expect(report.findings).toEqual([
      expect.objectContaining({
        classification: "heuristic",
        category: "dependencies",
        rule: {
          id: "JS-OVERLAP-008",
          version: "1",
        },
        priority: expect.objectContaining({
          level: "medium",
          rule: {
            id: "JS-PRIORITY-016",
            version: "1",
          },
        }),
      }),
    ]);
    expect(report.recommendations).toEqual([
      expect.objectContaining({
        basis: "heuristic",
        rule: {
          id: "JS-RECOMMEND-015",
          version: "1",
        },
      }),
    ]);
    expect(report.scores.overall).toMatchObject({
      status: "insufficient_evidence",
      evidenceCoverage: 0,
    });
  });

  it("accepts uploaded package.json semantics through the same route", async () => {
    const app = await testApi();

    const response = await app.inject({
      method: "POST",
      url: "/v1/analyze/manifest",
      payload: {
        kind: "upload",
        filename: "package.json",
        content: '{"devDependencies":{"vitest":"^5.0.1"}}',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().report.facts[0]?.details).toEqual({
      kind: "dependency_inventory",
      dependencyGroup: "devDependencies",
      declaredSpecifier: "^5.0.1",
    });
  });

  it("maps application validation errors to stable public 400 responses", async () => {
    const app = await testApi();

    const invalidJson = await app.inject({
      method: "POST",
      url: "/v1/analyze/manifest",
      payload: {
        kind: "paste",
        content: '{"dependencies":',
      },
    });
    const unsupportedUpload = await app.inject({
      method: "POST",
      url: "/v1/analyze/manifest",
      payload: {
        kind: "upload",
        filename: "manifest.txt",
        content: "{}",
      },
    });

    expect(invalidJson.statusCode).toBe(400);
    expect(invalidJson.json()).toEqual({
      code: "invalid_json",
      message: "package.json must contain valid JSON.",
    });
    expect(unsupportedUpload.statusCode).toBe(400);
    expect(unsupportedUpload.json()).toEqual({
      code: "unsupported_upload",
      message: "Uploaded quick-analysis files must be named package.json.",
    });
  });

  it("rejects schema violations and over-limit manifest content", async () => {
    const app = await testApi();

    const unknownField = await app.inject({
      method: "POST",
      url: "/v1/analyze/manifest",
      payload: {
        kind: "paste",
        content: "{}",
        repositoryUrl: "https://github.com/acme/demo",
      },
    });
    const tooLarge = await app.inject({
      method: "POST",
      url: "/v1/analyze/manifest",
      payload: {
        kind: "paste",
        content: "x".repeat(524_289),
      },
    });

    expect(unknownField.statusCode).toBe(400);
    expect(unknownField.json()).toEqual({
      code: "invalid_request",
      message: "Request does not match the API schema.",
    });
    expect(tooLarge.statusCode).toBe(400);
    expect(tooLarge.json()).toEqual({
      code: "invalid_request",
      message: "Request does not match the API schema.",
    });
  });

  it("publishes the quick manifest operation in the existing OpenAPI document", async () => {
    const app = await testApi();

    const response = await app.inject({
      method: "GET",
      url: "/openapi.json",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      openapi: "3.1.0",
      paths: {
        "/v1/analyze/manifest": {
          post: {
            operationId: "analyzeManifest",
          },
        },
      },
    });
  });
});
