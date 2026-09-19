"use client";

import { useMemo, useState } from "react";

type Item = {
  id: number;
  type: string;
  title: string;
  url: string | null;
  content: string | null;
  description: string | null;
  lessonTitle: string;
  moduleTitle: string;
};

export default function ResourceBrowser({ items }: { items: Item[] }) {
  const [query, setQuery] = useState("");
  const [type, setType] = useState("all");
  const shown = useMemo(
    () =>
      items.filter(
        (item) =>
          (type === "all" || item.type === type) &&
          `${item.title} ${item.description || ""} ${item.lessonTitle} ${item.moduleTitle}`
            .toLowerCase()
            .includes(query.toLowerCase())
      ),
    [items, query, type]
  );

  return (
    <>
      <div className="soft-card mb-4 flex flex-wrap gap-3">
        <input
          aria-label="Search resources"
          placeholder="Search resources…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="flex-1 min-w-52 px-4 py-3 border border-[var(--line)] rounded-lg"
        />
        <select
          aria-label="Filter resource type"
          value={type}
          onChange={(event) => setType(event.target.value)}
          className="px-4 py-3 border border-[var(--line)] rounded-lg"
        >
          <option value="all">All resources</option>
          <option value="link">Links</option>
          <option value="text">Notes</option>
          <option value="document">Documents</option>
        </select>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {shown.map((item) => (
          <article className="soft-card resource-tile" key={item.id}>
            <span className="resource-icon">
              {item.type === "link" ? "↗" : item.type === "text" ? "☷" : "□"}
            </span>
            <span className="page-eyebrow">{item.moduleTitle}</span>
            <h2 className="text-lg font-bold">{item.title}</h2>
            <p className="text-sm text-[var(--muted)]">
              {item.description || item.lessonTitle}
            </p>
            {item.type === "text" && item.content && (
              <p className="text-sm mt-3 line-clamp-3">{item.content}</p>
            )}
            <div className="resource-action">
              {item.type === "link" && item.url ? (
                <a
                  className="btn secondary small"
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open resource ↗
                </a>
              ) : item.type === "document" ? (
                <a
                  className="btn secondary small"
                  href={`/api/resources/${item.id}/download`}
                >
                  Download document
                </a>
              ) : (
                <span className="text-sm text-[var(--muted)]">
                  Available in lesson
                </span>
              )}
            </div>
          </article>
        ))}
      </div>
      {!shown.length && (
        <div className="soft-card text-center py-12">
          <h2 className="text-xl font-bold">No matching resources</h2>
          <p className="text-[var(--muted)]">
            Try another search or filter.
          </p>
        </div>
      )}
    </>
  );
}
