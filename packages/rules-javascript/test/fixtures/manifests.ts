export const multiGroupManifest = {
  name: "fixture-app",
  dependencies: {
    react: "^19.0.0",
    "@scope/runtime": "workspace:^",
  },
  devDependencies: {
    vitest: "^5.0.1",
    shared: "file:../shared",
  },
  peerDependencies: {
    react: ">=18 <20",
    shared: "latest",
  },
  optionalDependencies: {
    sharp: "https://example.com/sharp.tgz",
  },
} as const;
