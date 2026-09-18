// oxlint-disable-next-line import/no-unassigned-import -- jest-dom registers Vitest matchers by side effect.
import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => {
  cleanup();
});
