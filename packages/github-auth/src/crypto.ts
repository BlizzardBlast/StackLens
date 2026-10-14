import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

export class GitHubConnectionError extends Error {
  override readonly name = "GitHubConnectionError";
  constructor() {
    super("GitHub connection is unavailable. Reconnect and check repository access.");
  }
}

export function connectionKey(value: string): Buffer {
  if (!/^[a-f0-9]{64}$/iu.test(value)) throw new GitHubConnectionError();
  return Buffer.from(value, "hex");
}

export function digest(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
export function randomSecret(): string {
  return randomBytes(32).toString("base64url");
}
export function equalSecret(left: string, right: string): boolean {
  return timingSafeEqual(Buffer.from(digest(left)), Buffer.from(digest(right)));
}
export function csrfToken(cookie: string, key: Buffer): string {
  return createHmac("sha256", key).update(`csrf:${cookie}`).digest("base64url");
}

export function seal(value: string, key: Buffer, purpose: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(`stacklens-github-v1:${purpose}`));
  const body = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64url");
}

export function unseal(value: string, key: Buffer, purpose: string): string {
  try {
    if (!/^[A-Za-z0-9_-]{40,8192}$/u.test(value)) throw new GitHubConnectionError();
    const packet = Buffer.from(value, "base64url");
    const cipher = createDecipheriv("aes-256-gcm", key, packet.subarray(0, 12));
    cipher.setAAD(Buffer.from(`stacklens-github-v1:${purpose}`));
    cipher.setAuthTag(packet.subarray(12, 28));
    return Buffer.concat([cipher.update(packet.subarray(28)), cipher.final()]).toString("utf8");
  } catch {
    throw new GitHubConnectionError();
  }
}
