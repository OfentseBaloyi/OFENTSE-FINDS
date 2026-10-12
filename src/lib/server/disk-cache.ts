import "server-only";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

// Persistent JSON cache for responses from free public services (Overpass, Nominatim).
// It survives server restarts, so a restart doesn't re-query OpenStreetMap, and it lets us
// serve the last good answer when a service is overloaded ("stale-if-error").
// Writes are best-effort: on read-only filesystems the app simply runs without it.

// Serverless hosts (Netlify, AWS Lambda) only allow writes to the temp directory.
const SERVERLESS = Boolean(process.env.NETLIFY || process.env.AWS_LAMBDA_FUNCTION_NAME);
const DIR =
  process.env.OF_CACHE_DIR ||
  (SERVERLESS ? path.join(os.tmpdir(), "ofentse-finds") : path.join(process.cwd(), ".next", "cache", "ofentse-finds"));

type Stored<T> = { savedAt: number; value: T };

function fileFor(key: string) {
  return path.join(DIR, `${createHash("sha256").update(key).digest("hex").slice(0, 40)}.json`);
}

export async function diskGet<T>(key: string): Promise<Stored<T> | null> {
  try {
    return JSON.parse(await readFile(fileFor(key), "utf8")) as Stored<T>;
  } catch {
    return null;
  }
}

export async function diskSet<T>(key: string, value: T): Promise<void> {
  try {
    await mkdir(DIR, { recursive: true });
    await writeFile(fileFor(key), JSON.stringify({ savedAt: Date.now(), value } satisfies Stored<T>));
  } catch {
    /* read-only filesystem — fine */
  }
}

/**
 * Fresh disk hit → return it. Otherwise fetch; on failure fall back to a stale disk copy
 * (up to `maxStaleMs` old) before giving up.
 */
export async function cachedFetch<T>(key: string, freshMs: number, maxStaleMs: number, fetcher: () => Promise<T>): Promise<T> {
  const hit = await diskGet<T>(key);
  if (hit && Date.now() - hit.savedAt < freshMs) return hit.value;
  try {
    const value = await fetcher();
    await diskSet(key, value);
    return value;
  } catch (e) {
    if (hit && Date.now() - hit.savedAt < maxStaleMs) return hit.value;
    throw e;
  }
}
