"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface ModuleItem {
  id: number;
  title: string;
  position: number;
  lessonCount: number;
  archivedAt: Date | string | null;
}

interface Props {
  courseId: number;
  activeModules: ModuleItem[];
  archivedModules: ModuleItem[];
}

type Tab = "active" | "archived";

export default function ModuleManager({
  courseId,
  activeModules,
  archivedModules,
}: Props) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [tab, setTab] = useState<Tab>("active");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function request(
    method: "POST" | "PUT" | "PATCH",
    body: object,
    successMessage: string
  ): Promise<boolean> {
    setError("");
    setMessage("");
    setSaving(true);
    try {
      const response = await fetch("/api/admin/modules", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Module changes could not be saved.");
        return false;
      }
      setMessage(successMessage);
      router.refresh();
      return true;
    } catch {
      setError("The module request failed. Please try again.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function addModule(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      await request(
        "POST",
        { courseId, title },
        "Module added to the active course."
      )
    ) {
      setTitle("");
    }
  }

  async function archiveModule(module: ModuleItem) {
    const typedConfirmation = window.prompt(
      `Archiving “${module.title}” hides it from students but preserves its content and progress. Type ARCHIVE MODULE to continue.`
    );
    if (typedConfirmation !== "ARCHIVE MODULE") {
      setMessage("Module was not archived. No content was changed.");
      return;
    }
    await request(
      "PATCH",
      { id: module.id, action: "archive", confirmation: typedConfirmation },
      `“${module.title}” was archived. Its lessons and progress are preserved.`
    );
  }

  async function restoreModule(module: ModuleItem) {
    if (!window.confirm(`Restore “${module.title}” to the active course?`)) {
      setMessage("Module was not restored.");
      return;
    }
    await request(
      "PATCH",
      { id: module.id, action: "restore", confirmation: "RESTORE MODULE" },
      `“${module.title}” was restored with its existing lessons and progress.`
    );
  }

  return (
    <>
      <div className="soft-card mb-5">
        <h2 className="text-lg font-bold mb-1">Add module</h2>
        <p className="text-sm text-[var(--muted)] mb-3">
          New modules are active for students as soon as they are created.
        </p>
        {message && <div className="alert success" role="status">{message}</div>}
        {error && <div className="alert error" role="alert">{error}</div>}
        <form className="flex gap-3 flex-wrap" onSubmit={addModule}>
          <input
            className="flex-1 min-w-56 px-4 py-3 border border-[var(--line)] rounded-lg"
            placeholder="Module title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={160}
            required
          />
          <button className="btn" disabled={saving}>
            {saving ? "Saving…" : "Add module"}
          </button>
        </form>
      </div>

      <div className="content-tabs" role="tablist" aria-label="Module status">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "active"}
          className={tab === "active" ? "content-tab active" : "content-tab"}
          onClick={() => setTab("active")}
        >
          Active <span>{activeModules.length}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "archived"}
          className={tab === "archived" ? "content-tab active" : "content-tab"}
          onClick={() => setTab("archived")}
        >
          Archived <span>{archivedModules.length}</span>
        </button>
      </div>

      {tab === "active" ? (
        activeModules.length === 0 ? (
          <div className="soft-card text-center text-[var(--muted)]">
            <strong className="block text-[var(--ink)]">No active modules yet</strong>
            Add a module above to start building the course.
          </div>
        ) : (
          <div className="grid gap-3">
            {activeModules.map((module) => (
              <ModuleRow
                key={`${module.id}:${module.title}:${module.position}`}
                module={module}
                disabled={saving}
                save={(nextTitle, nextPosition) =>
                  request(
                    "PUT",
                    { id: module.id, title: nextTitle, position: nextPosition },
                    `“${nextTitle.trim()}” was saved.`
                  )
                }
                archive={() => archiveModule(module)}
              />
            ))}
          </div>
        )
      ) : archivedModules.length === 0 ? (
        <div className="soft-card text-center text-[var(--muted)]">
          <strong className="block text-[var(--ink)]">No archived modules</strong>
          Archived modules will remain here until you restore them.
        </div>
      ) : (
        <div className="grid gap-3">
          {archivedModules.map((module) => (
            <ArchivedModuleRow
              key={`${module.id}:${module.title}:${module.position}`}
              module={module}
              disabled={saving}
              save={(nextTitle, nextPosition) =>
                request(
                  "PUT",
                  { id: module.id, title: nextTitle, position: nextPosition },
                  `Archived module “${nextTitle.trim()}” was saved.`
                )
              }
              restore={() => restoreModule(module)}
            />
          ))}
        </div>
      )}
    </>
  );
}

function ModuleRow({
  module,
  disabled,
  save,
  archive,
}: {
  module: ModuleItem;
  disabled: boolean;
  save: (title: string, position: number) => Promise<boolean>;
  archive: () => Promise<void>;
}) {
  const [title, setTitle] = useState(module.title);
  const [position, setPosition] = useState(Math.max(1, module.position));

  async function saveModule() {
    await save(title, position);
  }

  return (
    <article className="soft-card module-card-purple admin-module-card">
      <div className="flex justify-between gap-4 flex-wrap">
        <div className="flex gap-3 flex-wrap flex-1">
          <div className="form-group mb-0 w-24">
            <label htmlFor={`module-position-${module.id}`}>Order</label>
            <input
              id={`module-position-${module.id}`}
              type="number"
              min={1}
              value={position}
              onChange={(event) => setPosition(Number(event.target.value))}
            />
          </div>
          <div className="form-group mb-0 flex-1 min-w-56">
            <label htmlFor={`module-title-${module.id}`}>Module title</label>
            <input
              id={`module-title-${module.id}`}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={160}
            />
          </div>
        </div>
        <div className="flex items-end gap-2 flex-wrap">
          <span className="badge module-count-badge">{module.lessonCount} lessons</span>
          <button className="btn small" onClick={() => void saveModule()} disabled={disabled}>
            Save
          </button>
          <button
            className="btn small danger"
            disabled={disabled}
            onClick={() => void archive()}
          >
            Archive
          </button>
        </div>
      </div>
    </article>
  );
}

function ArchivedModuleRow({
  module,
  disabled,
  save,
  restore,
}: {
  module: ModuleItem;
  disabled: boolean;
  save: (title: string, position: number) => Promise<boolean>;
  restore: () => Promise<void>;
}) {
  const [title, setTitle] = useState(module.title);
  const [position, setPosition] = useState(Math.max(1, module.position));

  return (
    <article className="soft-card archived-content-card">
      <div className="flex justify-between items-center gap-4 flex-wrap">
        <div className="flex gap-3 flex-wrap flex-1">
          <div className="form-group mb-0 w-24">
            <label htmlFor={`archived-module-position-${module.id}`}>Order</label>
            <input
              id={`archived-module-position-${module.id}`}
              type="number"
              min={1}
              value={position}
              onChange={(event) => setPosition(Number(event.target.value))}
            />
          </div>
          <div className="form-group mb-0 flex-1 min-w-56">
            <label htmlFor={`archived-module-title-${module.id}`}>Module title</label>
            <input
              id={`archived-module-title-${module.id}`}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={160}
            />
          </div>
        </div>
        <div className="flex items-end gap-2 flex-wrap">
          <span className="badge archived-badge">{module.lessonCount} lessons · Archived</span>
          <button
            className="btn small secondary"
            disabled={disabled}
            onClick={() => void save(title, position)}
          >
            Save
          </button>
          <button
            className="btn small"
            disabled={disabled}
            onClick={() => void restore()}
          >
            Restore module
          </button>
        </div>
      </div>
      <p className="text-sm text-[var(--muted)] mt-2">
        Lessons, resources, and student progress are retained while archived.
      </p>
    </article>
  );
}
