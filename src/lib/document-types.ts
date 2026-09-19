export const DOCUMENT_BUCKET = "course-documents";
export const MAX_DOCUMENT_BYTES = 25 * 1024 * 1024;

export const DOCUMENT_MIME_TYPES = {
  pdf: ["application/pdf"],
  docx: [
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ],
  txt: ["text/plain"],
  zip: ["application/zip", "application/x-zip-compressed"],
} as const;

export type DocumentExtension = keyof typeof DOCUMENT_MIME_TYPES;

const EXTENSION_RE = /\.([a-z0-9]+)$/i;

/**
 * Return the supported extension only when both the filename and the browser
 * supplied MIME type are compatible. The server repeats this validation before
 * it issues a signed upload URL; this function is also used for friendly
 * client-side validation.
 */
export function getDocumentExtension(
  fileName: string,
  mimeType?: string | null
): DocumentExtension | null {
  const match = fileName.trim().match(EXTENSION_RE);
  if (!match) return null;

  const extension = match[1].toLowerCase() as DocumentExtension;
  if (!(extension in DOCUMENT_MIME_TYPES)) return null;

  const normalizedMime = (mimeType || "").trim().toLowerCase();
  if (!normalizedMime || normalizedMime === "application/octet-stream") {
    return extension;
  }

  return (DOCUMENT_MIME_TYPES[extension] as readonly string[]).includes(
    normalizedMime
  )
    ? extension
    : null;
}

export function getDocumentMimeType(extension: DocumentExtension): string {
  return DOCUMENT_MIME_TYPES[extension][0];
}

export function isSupportedDocumentSize(size: number): boolean {
  return Number.isSafeInteger(size) && size > 0 && size <= MAX_DOCUMENT_BYTES;
}

export function isSafeStoragePath(value: string): boolean {
  return (
    value.length > 0 &&
    value.length <= 1024 &&
    !value.startsWith("/") &&
    !value.includes("\\") &&
    !value.includes("..") &&
    !value.includes("://") &&
    /^[A-Za-z0-9._/@=+?&,;:'()\-$]+$/.test(value)
  );
}
