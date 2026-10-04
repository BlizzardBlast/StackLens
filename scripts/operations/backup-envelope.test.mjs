import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import test from "node:test";

import { decryptArchive, encryptArchive } from "./backup-envelope.mjs";

const metadata = {
  version: 1,
  createdAt: "2026-10-03T00:00:00.000Z",
  expiresAt: "2026-10-04T00:00:00.000Z",
};
void test("SEC-003/007: encrypted archives authenticate all content and their retention metadata", () => {
  const key = randomBytes(32),
    plaintext = Buffer.from("private-report-fixture");
  const envelope = encryptArchive(plaintext, key, metadata);
  assert(!envelope.includes(plaintext));
  assert(!envelope.includes(key));
  assert.deepEqual(decryptArchive(envelope, key, Date.parse(metadata.createdAt)), {
    metadata,
    archive: plaintext,
  });
  for (const position of [12, envelope.length - 1]) {
    const modified = Buffer.from(envelope);
    modified[position] ^= 1;
    assert.throws(
      () => decryptArchive(modified, key, Date.parse(metadata.createdAt)),
      /backup_unreadable_or_expired/,
    );
  }
  assert.throws(
    () => decryptArchive(envelope, randomBytes(32), Date.parse(metadata.createdAt)),
    /backup_unreadable_or_expired/,
  );
});
void test("SEC-003: expired, malformed and excessive-retention archives cannot be restored", () => {
  const key = randomBytes(32),
    envelope = encryptArchive(Buffer.from("fixture"), key, metadata);
  assert.throws(
    () => decryptArchive(envelope, key, Date.parse(metadata.expiresAt)),
    /backup_unreadable_or_expired/,
  );
  assert.throws(
    () => decryptArchive(envelope.subarray(0, 20), key),
    /backup_unreadable_or_expired/,
  );
  assert.throws(
    () =>
      encryptArchive(Buffer.from("fixture"), key, {
        ...metadata,
        expiresAt: "2026-10-05T00:00:00.000Z",
      }),
    /invalid_backup_retention/,
  );
});
