const FNV_OFFSET_BASIS_64 = 0xcbf29ce484222325n;
const FNV_PRIME_64 = 0x100000001b3n;
const UINT64_MASK = 0xffffffffffffffffn;

function fnv1a64(value: string): string {
  let hash = FNV_OFFSET_BASIS_64;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= BigInt(value.charCodeAt(index));
    hash = (hash * FNV_PRIME_64) & UINT64_MASK;
  }

  return hash.toString(16).padStart(16, "0");
}

export function createManifestFingerprint(content: string): string {
  return `fnv1a64:${content.length.toString(16)}:${fnv1a64(content)}`;
}
