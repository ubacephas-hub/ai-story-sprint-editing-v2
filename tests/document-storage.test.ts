import assert from "node:assert/strict";
import test from "node:test";
import { canDownloadDocument } from "../src/lib/document-access";
import {
  logSupabaseStorageError,
  normalizeDocumentObjectPath,
} from "../src/lib/supabase-storage";

const bucket = "course-documents";
const objectPath = "documents/42/abc123-staging.pdf";

test("only active students and administrators can download private documents", () => {
  assert.equal(
    canDownloadDocument({ role: "admin", accountStatus: "active", courseAccessStatus: null }),
    true,
  );
  assert.equal(
    canDownloadDocument({ role: "student", accountStatus: "active", courseAccessStatus: "active" }),
    true,
  );
  for (const courseAccessStatus of ["pending", "suspended", "removed", null]) {
    assert.equal(
      canDownloadDocument({ role: "student", accountStatus: "active", courseAccessStatus }),
      false,
    );
  }
  assert.equal(
    canDownloadDocument({ role: "student", accountStatus: "disabled", courseAccessStatus: "active" }),
    false,
  );
  assert.equal(
    canDownloadDocument({ role: "student", accountStatus: "removed", courseAccessStatus: "active" }),
    false,
  );
  assert.equal(
    canDownloadDocument({ role: null, accountStatus: null, courseAccessStatus: null }),
    false,
  );
});

test("normalizes exact and legacy Supabase object metadata to one path", () => {
  assert.equal(normalizeDocumentObjectPath(objectPath, bucket), objectPath);
  assert.equal(
    normalizeDocumentObjectPath(`${bucket}/${objectPath}`, bucket),
    objectPath,
  );
  assert.equal(
    normalizeDocumentObjectPath(
      `https://staging-project.supabase.co/storage/v1/object/sign/${bucket}/${objectPath}?token=do-not-store`,
      bucket,
    ),
    objectPath,
  );
  assert.equal(
    normalizeDocumentObjectPath(
      `https://staging-project.supabase.co/storage/v1/object/upload/sign/${bucket}/${objectPath}?token=legacy-upload-token`,
      bucket,
    ),
    objectPath,
  );
  assert.equal(
    normalizeDocumentObjectPath(
      `https://staging-project.supabase.co/storage/v1/object/public/other-bucket/${objectPath}`,
      bucket,
    ),
    null,
  );
});

test("storage diagnostics include safe fields without exposing credentials or signed URLs", () => {
  const originalError = console.error;
  const calls: unknown[][] = [];
  console.error = (...args: unknown[]) => calls.push(args);

  try {
    logSupabaseStorageError("storage test", {
      name: "StorageApiError",
      code: "NoSuchKey",
      status: 404,
      message:
        "signedUrl=https://staging-project.supabase.co/object?token=secret-token service_role=service-role-secret database_url=postgresql://user:password@db.example.test/staging",
    });
  } finally {
    console.error = originalError;
  }

  assert.equal(calls.length, 1);
  const details = calls[0][1] as Record<string, unknown>;
  assert.equal(details.name, "StorageApiError");
  assert.equal(details.code, "NoSuchKey");
  assert.equal(details.status, "404");
  assert.match(String(details.message), /\[redacted\]/);
  assert.doesNotMatch(String(details.message), /secret-token/);
  assert.doesNotMatch(String(details.message), /service-role-secret/);
  assert.doesNotMatch(String(details.message), /postgresql:\/\//);
});
