// SEC-003/007: authenticated, expiring logical archives. Keys never enter an archive or evidence.
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const magic = Buffer.from("SLBK1\n");
export const maximumArchiveBytes = 128 * 1024 * 1024;
function validateMetadata(value) {
  if (
    !value ||
    Object.keys(value).toSorted().join(",") !== "createdAt,expiresAt,version" ||
    value.version !== 1 ||
    typeof value.createdAt !== "string" ||
    typeof value.expiresAt !== "string"
  )
    throw new Error("invalid_backup_metadata");
  const created = Date.parse(value.createdAt),
    expires = Date.parse(value.expiresAt);
  if (
    !Number.isFinite(created) ||
    !Number.isFinite(expires) ||
    expires <= created ||
    expires - created > 24 * 60 * 60 * 1_000
  )
    throw new Error("invalid_backup_retention");
}
export function encryptArchive(archive, key, metadata) {
  validateMetadata(metadata);
  if (key.length !== 32 || archive.length > maximumArchiveBytes)
    throw new Error("invalid_backup_input");
  const header = Buffer.from(JSON.stringify(metadata));
  const size = Buffer.alloc(4);
  size.writeUInt32BE(header.length);
  const aad = Buffer.concat([magic, size, header]);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(aad);
  const ciphertext = Buffer.concat([cipher.update(archive), cipher.final()]);
  return Buffer.concat([aad, iv, cipher.getAuthTag(), ciphertext]);
}
export function decryptArchive(envelope, key, now = Date.now()) {
  try {
    if (
      key.length !== 32 ||
      envelope.length < 38 ||
      envelope.length > maximumArchiveBytes + 1_024 ||
      !envelope.subarray(0, 6).equals(magic)
    )
      throw new Error();
    const size = envelope.readUInt32BE(6),
      offset = 10 + size;
    if (
      size > 512 ||
      offset + 28 > envelope.length ||
      envelope.length - offset - 28 > maximumArchiveBytes
    )
      throw new Error();
    const metadata = JSON.parse(envelope.subarray(10, offset).toString());
    validateMetadata(metadata);
    const cipher = createDecipheriv("aes-256-gcm", key, envelope.subarray(offset, offset + 12));
    cipher.setAAD(envelope.subarray(0, offset));
    cipher.setAuthTag(envelope.subarray(offset + 12, offset + 28));
    const archive = Buffer.concat([cipher.update(envelope.subarray(offset + 28)), cipher.final()]);
    if (Date.parse(metadata.expiresAt) <= now) throw new Error();
    return { metadata, archive };
  } catch {
    // Authentication failures, malformed files and expiration expose no private detail.
    throw new Error("backup_unreadable_or_expired");
  }
}
