import { StorageClient } from "@supabase/storage-js";
import { DOCUMENT_BUCKET } from "@/lib/document-types";

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
