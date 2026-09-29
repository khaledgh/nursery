import type { ImageSource } from "expo-image";

/**
 * Image source for a remote photo with a stable cache key.
 *
 * Media URLs from R2 are presigned: the query string (signature, date) changes
 * every time the API returns the row, so caching by full URL re-downloads the
 * same photo on every refresh. Keying the cache by the object path makes each
 * photo download once and come from disk afterwards — less data and battery.
 */
export function remoteImage(uri: string | null | undefined): ImageSource | undefined {
  if (!uri) return undefined;
  const q = uri.indexOf("?");
  return { uri, cacheKey: q >= 0 ? uri.slice(0, q) : uri };
}
