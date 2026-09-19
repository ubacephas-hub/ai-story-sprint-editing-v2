import { StorageClient } from "@supabase/storage-js";
import { DOCUMENT_BUCKET, isSafeStoragePath } from "@/lib/document-types";

const globalForStorage = globalThis as typeof globalThis & {
  __courseDocumentStorage?: StorageClient;
};

function getStorageUrl(): string {
  const value = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!value) throw new Error("NEXT_PUBLIC_SUPABASE_URL is required");

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is invalid");
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL must use HTTP or HTTPS");
  }

  return url.toString().replace(/\/$/, "") + "/storage/v1";
}

/**
 * Server-only Supabase Storage client. This module must never be imported by a
 * Client Component: the service role key is intentionally read here and is
 * never returned to the browser.
 */
export function getDocumentStorageAdmin(): StorageClient {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!serviceRoleKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY is required");

  if (globalForStorage.__courseDocumentStorage) {
    return globalForStorage.__courseDocumentStorage;
  }

  const client = new StorageClient(getStorageUrl(), {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
  });

  if (process.env.NODE_ENV !== "production") {
    globalForStorage.__courseDocumentStorage = client;
  }

  return client;
}

export function getDocumentBucketName(): string {
  const configured = process.env.SUPABASE_DOCUMENT_BUCKET?.trim();
  return configured || DOCUMENT_BUCKET;
}

/**
 * Convert new and legacy resource metadata to the path relative to the
 * configured private bucket. New records should contain this relative path;
 * the URL/fullPath cases are retained only so existing records can continue
 * to work after the regression fix.
 */
export function normalizeDocumentObjectPath(
  value: string | null | undefined,
  bucket = getDocumentBucketName()
): string | null {
  if (!value || !bucket) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  // Supabase's fullPath is `${bucket}/${objectPath}`. Never pass the bucket
  // name as part of the object path to createSignedUrl.
  const bucketPrefix = `${bucket}/`;
  if (trimmed.startsWith(bucketPrefix)) {
    const objectPath = trimmed.slice(bucketPrefix.length);
    return isSafeStoragePath(objectPath) ? objectPath : null;
  }
  if (isSafeStoragePath(trimmed)) return trimmed;

  // Older records may contain a Supabase public/authenticated/signed URL.
  // Extract only a path belonging to this bucket; the URL is never redirected.
  try {
    const url = new URL(trimmed);
    const parts = url.pathname
      .split("/")
      .filter(Boolean)
      .map((part) => decodeURIComponent(part));
    const objectIndex = parts.indexOf("object");
    const objectMode = parts[objectIndex + 1];
    const isSignedUploadUrl =
      objectMode === "upload" && parts[objectIndex + 2] === "sign";
    const bucketIndex = isSignedUploadUrl ? objectIndex + 3 : objectIndex + 2;
    const storedBucket = parts[bucketIndex];
    if (
      objectIndex < 0 ||
      (!isSignedUploadUrl && !["public", "authenticated", "sign"].includes(objectMode)) ||
      storedBucket !== bucket
    ) {
      return null;
    }

    const objectPath = parts.slice(bucketIndex + 1).join("/");
    return isSafeStoragePath(objectPath) ? objectPath : null;
  } catch {
    return null;
  }
}

function safeErrorField(value: unknown, maxLength = 160): string | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  return String(value).slice(0, maxLength);
}

/**
 * Storage errors can contain URLs, query-string tokens, or authorization
 * details. Log only the small diagnostic fields needed to troubleshoot a
 * staging bucket without ever serializing the original error object.
 */
export function logSupabaseStorageError(context: string, error: unknown): void {
  const candidate =
    error && typeof error === "object"
      ? (error as Record<string, unknown>)
      : undefined;
  const rawMessage =
    candidate && typeof candidate.message === "string"
      ? candidate.message
      : error instanceof Error
        ? error.message
        : "Unknown storage error";
  const configuredServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const message = rawMessage
    .replace(
      configuredServiceRoleKey ? new RegExp(configuredServiceRoleKey.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g") : /$^/,
      "[redacted]"
    )
    .replace(/(?:https?|postgres(?:ql)?):\/\/[^\s]+/gi, "[url]")
    .replace(/bearer\s+[^\s]+/gi, "Bearer [redacted]")
    .replace(
      /((?:token|authorization|apikey|api[_-]?key|service[_-]?role|signed[_-]?url|database[_-]?url)\s*[=:]\s*)[^\s,;]+/gi,
      "$1[redacted]"
    )
    .replace(/([?&](?:token|apikey|signature|authorization)=)[^&\s]+/gi, "$1[redacted]")
    .slice(0, 300);

  console.error(context, {
    name: safeErrorField(candidate?.name) || (error instanceof Error ? error.name : "StorageError"),
    code: safeErrorField(candidate?.code),
    status: safeErrorField(candidate?.status ?? candidate?.statusCode),
    message,
  });
}
