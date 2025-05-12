let __NODEJS_CRYPTO_CACHE: typeof import("node:crypto");

export default async function createHash(target: string) {
  // Node.JS 환경
  if (typeof window === "undefined") {
    const crypto =
      __NODEJS_CRYPTO_CACHE ??
      (__NODEJS_CRYPTO_CACHE = await import("node:crypto"));

    return crypto.createHash("sha256").update(target).digest("hex");
  }

  // 브라우저 환경
  const msgBuffer = new TextEncoder().encode(target);
  const hashBuffer = await window.crypto.subtle.digest("SHA-256", msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));

  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}
