import assert from "node:assert/strict";
import test from "node:test";
import {
  DOCUMENT_MIME_TYPES,
  getDocumentExtension,
  getDocumentMimeType,
  isSupportedDocumentSize,
  MAX_DOCUMENT_BYTES,
} from "../src/lib/document-types";

test("accepts .md files with text/markdown", () => {
  assert.equal(getDocumentExtension("notes.md", "text/markdown"), "md");
});

test("accepts .md files with text/x-markdown", () => {
  assert.equal(getDocumentExtension("notes.md", "text/x-markdown"), "md");
});

test("accepts .md files with text/plain", () => {
  assert.equal(getDocumentExtension("notes.md", "text/plain"), "md");
});

test("accepts .md files with an empty MIME type, matching existing behavior", () => {
  assert.equal(getDocumentExtension("notes.md", ""), "md");
  assert.equal(getDocumentExtension("notes.md", null), "md");
  assert.equal(getDocumentExtension("notes.md", undefined), "md");
});

test("accepts .md files with application/octet-stream, matching existing behavior", () => {
  assert.equal(getDocumentExtension("notes.md", "application/octet-stream"), "md");
});

test("rejects .md files with unrelated or dangerous MIME types", () => {
  const dangerousMimeTypes = [
    "text/html",
    "application/javascript",
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "image/svg+xml",
    "application/x-sh",
    "application/vnd.ms-excel",
  ];
  for (const mimeType of dangerousMimeTypes) {
    assert.equal(
      getDocumentExtension("notes.md", mimeType),
      null,
      `expected .md + ${mimeType} to be rejected`,
    );
  }
});

test("rejects .md variants with unsafe extensions", () => {
  const unsafeFiles = ["notes.html", "notes.svg", "notes.exe", "notes.sh", "notes.php", "notes", "archive.tar.gz"];
  for (const fileName of unsafeFiles) {
    assert.equal(
      getDocumentExtension(fileName, "text/markdown"),
      null,
      `expected ${fileName} to be rejected`,
    );
  }
  // A double extension like script.js.md still maps to .md, but a .md
  // extension paired with an HTML payload MIME type must still fail.
  assert.equal(getDocumentExtension("readme.md.html", "text/html"), null);
});

test("accepts Markdown MIME types case-insensitively, matching existing behavior", () => {
  assert.equal(getDocumentExtension("NOTES.MD", "TEXT/MARKDOWN"), "md");
  assert.equal(getDocumentExtension("notes.Md", "Text/Markdown"), "md");
});

test("existing PDF, DOCX, TXT, and ZIP formats still pass", () => {
  assert.equal(getDocumentExtension("guide.pdf", "application/pdf"), "pdf");
  assert.equal(
    getDocumentExtension(
      "guide.docx",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ),
    "docx",
  );
  assert.equal(getDocumentExtension("guide.txt", "text/plain"), "txt");
  assert.equal(getDocumentExtension("guide.zip", "application/zip"), "zip");
  assert.equal(getDocumentExtension("guide.zip", "application/x-zip-compressed"), "zip");
  // Empty and octet-stream MIME behavior is preserved for the other formats too.
  assert.equal(getDocumentExtension("guide.pdf", ""), "pdf");
  assert.equal(getDocumentExtension("guide.zip", "application/octet-stream"), "zip");
});

test("existing mismatched MIME types are still rejected", () => {
  assert.equal(getDocumentExtension("guide.pdf", "text/plain"), null);
  assert.equal(getDocumentExtension("guide.txt", "application/pdf"), null);
  assert.equal(getDocumentExtension("guide.zip", "text/markdown"), null);
  assert.equal(getDocumentExtension("guide.docx", "application/octet-stream"), "docx");
});

test("unsupported extensions remain rejected", () => {
  const unsupported = ["archive.rar", "sheet.xlsx", "video.mp4", "script.py", "page.html", "style.css", "archive.tar", "doc.doc", "archive.7z"];
  for (const fileName of unsupported) {
    assert.equal(
      getDocumentExtension(fileName, "application/octet-stream"),
      null,
      `expected ${fileName} to be rejected`,
    );
    assert.equal(
      getDocumentExtension(fileName, ""),
      null,
      `expected ${fileName} to be rejected without a MIME type`,
    );
  }
});

test("markdown is registered with exactly the safe accepted MIME types", () => {
  assert.deepEqual(DOCUMENT_MIME_TYPES.md, ["text/markdown", "text/x-markdown", "text/plain"]);
  assert.equal(getDocumentMimeType("md"), "text/markdown");
});

test("size limits are unchanged", () => {
  assert.equal(isSupportedDocumentSize(MAX_DOCUMENT_BYTES), true);
  assert.equal(isSupportedDocumentSize(MAX_DOCUMENT_BYTES + 1), false);
  assert.equal(isSupportedDocumentSize(0), false);
});
