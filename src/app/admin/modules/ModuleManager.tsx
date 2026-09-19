"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface ModuleItem {
  id: number;
  title: string;
  position: number;
  lessonCount: number;
}

interface Props {
  courseId: number;
  modules: ModuleItem[];
}

export default function ModuleManager({ courseId, modules }: Props) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function request(method: "POST" | "PUT" | "DELETE", body: object) {
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
      setMessage("Module changes saved.");
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
    if (await request("POST", { courseId, title })) setTitle("");
  }

  return (
    <>
      <div className="soft-card mb-5">
        <h2 className="text-lg font-bold mb-3">Add module</h2>
        {message && <div className="alert success">{message}</div>}
        {error && <div className="alert error">{error}</div>}
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

      {modules.length === 0 ? (
        <div className="soft-card text-[var(--muted)]">
          No modules yet. Add the first module above.
        </div>
      ) : (
        <div className="grid gap-3">
          {modules.map((module) => (
            <ModuleRow
              key={module.id}
              module={module}
              disabled={saving}
              save={(nextTitle, nextPosition) =>
                request("PUT", {
                  id: module.id,
                  title: nextTitle,
                  position: nextPosition,
                })
              }
              remove={() =>
                request("DELETE", {
                  id: module.id,
                  confirmation: "DELETE EMPTY MODULE",
                })
              }
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
  remove,
}: {
  module: ModuleItem;
  disabled: boolean;
  save: (title: string, position: number) => Promise<boolean>;
  remove: () => Promise<boolean>;
}) {
  const [title, setTitle] = useState(module.title);
  const [position, setPosition] = useState(Math.max(1, module.position));

  async function saveModule() {
    await save(title, position);
  }

  async function deleteModule() {
    if (!confirm("Delete this empty module? This cannot be undone.")) return;
    await remove();
  }

  return (
    <div className="soft-card flex justify-between gap-4 flex-wrap">
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
      <div className="flex items-end gap-2">
        <span className="badge">{module.lessonCount} lessons</span>
        <button className="btn small" onClick={saveModule} disabled={disabled}>
          Save
        </button>
        <button
          className="btn small danger"
          disabled={disabled || module.lessonCount > 0}
          title={
            module.lessonCount
              ? "Only empty modules can be deleted"
              : "Delete empty module"
          }
          onClick={deleteModule}
        >
          Delete
        </button>
      </div>
    </div>
  );
}
