"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import PasswordField from "@/components/PasswordField";

interface StudentInfo {
  id: number;
  name: string;
  email: string;
  accountStatus: string;
  accessStatus: string;
  accessId: number | null;
  completedLessons: number;
  overallPercent: number;
  mostRecentLessonTitle: string | null;
  lastWatchedAt: Date | string | null;
}

interface LiveSnapshot {
  studentId: number;
  overallPercent: number;
  completedLessons: number;
  mostRecentLesson: { title: string } | null;
  lastWatchedAt: string | null;
}

interface Props {
  courseId: number | null;
  students: StudentInfo[];
  totalLessons: number;
}

function formatDate(value: Date | string | null): string {
  if (!value) return "Not watched";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Not watched" : date.toLocaleString();
}

export default function StudentActions({ courseId, students, totalLessons }: Props) {
  const router = useRouter();
  const [liveByStudent, setLiveByStudent] = useState<Record<number, LiveSnapshot>>({});
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("active");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    let timer: number | undefined;

    const refreshProgress = async () => {
      if (document.visibilityState === "hidden") return;
      try {
        const response = await fetch("/api/admin/progress", {
          credentials: "same-origin",
          cache: "no-store",
        });
        if (!response.ok) return;
        const data = (await response.json()) as { snapshots?: LiveSnapshot[] };
        const byStudent = new Map(
          (data.snapshots || []).map((snapshot) => [snapshot.studentId, snapshot])
        );
        setLiveByStudent(
          Object.fromEntries(byStudent.entries()) as Record<number, LiveSnapshot>
        );
      } catch {
        // Polling is deliberately best-effort; the page remains usable.
      }
    };

    const restartTimer = () => {
      if (timer) window.clearInterval(timer);
      timer = undefined;
      if (document.visibilityState === "visible") {
        void refreshProgress();
        timer = window.setInterval(() => void refreshProgress(), 20_000);
      }
    };

    restartTimer();
    document.addEventListener("visibilitychange", restartTimer);
    return () => {
      if (timer) window.clearInterval(timer);
      document.removeEventListener("visibilitychange", restartTimer);
    };
  }, []);

  const liveStudents = students.map((student) => {
    const snapshot = liveByStudent[student.id];
    return snapshot
      ? {
          ...student,
          overallPercent: snapshot.overallPercent,
          completedLessons: snapshot.completedLessons,
          mostRecentLessonTitle: snapshot.mostRecentLesson?.title || null,
          lastWatchedAt: snapshot.lastWatchedAt,
        }
      : student;
  });

  const visibleStudents = liveStudents.filter((student) => {
    const effectiveStatus = student.accountStatus === "disabled" ? "removed" : student.accessStatus;
    return (
      (filter === "all" || effectiveStatus === filter) &&
      `${student.name} ${student.email}`.toLowerCase().includes(query.toLowerCase())
    );
  });

  async function handleAddStudent(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);
    try {
      const response = await fetch("/api/admin/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, status, courseId }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Failed to add student");
      } else {
        setSuccess("Student added successfully");
        setName("");
        setEmail("");
        setPassword("");
        router.refresh();
      }
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function updateAccess(studentId: number, newStatus: string) {
    try {
      const response = await fetch("/api/admin/students/access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: studentId, courseId, status: newStatus }),
      });
      if (!response.ok) throw new Error();
      router.refresh();
    } catch {
      setError("Failed to update access");
    }
  }

  async function removeStudent(studentId: number, studentName: string) {
    const typed = prompt(
      `Type REMOVE to safely remove ${studentName}. Their progress and records will be preserved.`
    );
    if (typed !== "REMOVE") return;
    const response = await fetch("/api/admin/students", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: studentId, confirmation: typed }),
    });
    const data = await response.json();
    if (!response.ok) setError(data.error || "Removal failed");
    else {
      setSuccess(data.message);
      router.refresh();
    }
  }

  async function sendReset(studentEmail: string) {
    if (!confirm(`Send a password-reset email to ${studentEmail}?`)) return;
    await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: studentEmail }),
    });
    setSuccess("If the email account is valid, a secure reset link has been sent.");
  }

  async function restoreStudent(studentId: number) {
    if (!confirm("Restore this student as pending approval?")) return;
    const response = await fetch("/api/admin/students", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: studentId, action: "restore" }),
    });
    const data = await response.json();
    if (!response.ok) setError(data.error || "Restore failed");
    else {
      setSuccess(data.message);
      router.refresh();
    }
  }

  return (
    <>
      <div className="card mb-6">
        <h3 className="text-lg font-semibold mb-3">Add Student</h3>
        {error && <div className="alert error">{error}</div>}
        {success && <div className="alert success">{success}</div>}
        <form onSubmit={handleAddStudent}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
            <div className="form-group mb-0">
              <label htmlFor="student-name">Name</label>
              <input id="student-name" type="text" value={name} onChange={(event) => setName(event.target.value)} required />
            </div>
            <div className="form-group mb-0">
              <label htmlFor="student-email">Email</label>
              <input id="student-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
            </div>
            <PasswordField label="Temporary password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={8} autoComplete="new-password" />
            <div className="form-group mb-0">
              <label htmlFor="student-status">Course Access</label>
              <select id="student-status" value={status} onChange={(event) => setStatus(event.target.value)}>
                <option value="active">Active</option>
                <option value="pending">Pending</option>
              </select>
            </div>
          </div>
          <button type="submit" className="btn small" disabled={loading}>
            {loading ? "Adding…" : "Add Student"}
          </button>
        </form>
      </div>

      <div className="grid sm:grid-cols-4 gap-3 mb-4">
        <div className="soft-card"><span className="text-sm text-[var(--muted)]">Total Students</span><strong className="block text-2xl">{liveStudents.length}</strong></div>
        <div className="soft-card"><span className="text-sm text-[var(--muted)]">Active</span><strong className="block text-2xl text-[var(--ok)]">{liveStudents.filter((student) => student.accountStatus !== "disabled" && student.accessStatus === "active").length}</strong></div>
        <div className="soft-card"><span className="text-sm text-[var(--muted)]">Pending Approval</span><strong className="block text-2xl text-[var(--warn)]">{liveStudents.filter((student) => student.accountStatus !== "disabled" && student.accessStatus === "pending").length}</strong></div>
        <div className="soft-card"><span className="text-sm text-[var(--muted)]">Suspended</span><strong className="block text-2xl text-[var(--danger)]">{liveStudents.filter((student) => student.accountStatus !== "disabled" && student.accessStatus === "suspended").length}</strong></div>
      </div>

      <div className="card">
        <div className="flex justify-between gap-3 flex-wrap mb-4">
          <div>
            <h3 className="text-lg font-semibold">Students</h3>
            <p className="text-xs text-[var(--muted)] mt-1">Progress refreshes every 20 seconds while visible.</p>
          </div>
          <div className="flex gap-2 items-center">
            <button className="btn small secondary" onClick={() => router.refresh()}>Refresh</button>
            <input aria-label="Search students" placeholder="Search students…" value={query} onChange={(event) => setQuery(event.target.value)} className="px-3 py-2 border border-[var(--line)] rounded-lg" />
            <select aria-label="Filter students" value={filter} onChange={(event) => setFilter(event.target.value)} className="px-3 py-2 border border-[var(--line)] rounded-lg">
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="pending">Pending</option>
              <option value="suspended">Suspended</option>
              <option value="removed">Removed</option>
            </select>
          </div>
        </div>
        {visibleStudents.length === 0 ? (
          <p className="text-[var(--muted)]">No students enrolled yet.</p>
        ) : (
          <div className="grid gap-3">
            {visibleStudents.map((student) => (
              <div key={student.id} className="p-3 border border-[var(--line)] rounded-lg">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold">{student.name}</div>
                    <div className="text-sm text-[var(--muted)]">{student.email}</div>
                    <div className="text-sm text-[var(--muted)] mt-2">
                      <strong className="text-[var(--ink)]">{Math.round(student.overallPercent)}%</strong> overall · {student.completedLessons}/{totalLessons} lessons completed
                      <div className="progress-bar mt-1" style={{ height: 6, maxWidth: 260 }}>
                        <span className="progress-bar-fill" style={{ width: `${student.overallPercent}%` }} />
                      </div>
                      <p className="text-xs mt-2">
                        Recent: {student.mostRecentLessonTitle || "Not started"} · {formatDate(student.lastWatchedAt)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link className="btn small secondary" href={`/admin/students/${student.id}`}>View Progress</Link>
                    {student.accountStatus !== "disabled" && <button className="btn small secondary" onClick={() => sendReset(student.email)}>Send Reset</button>}
                    {student.accountStatus === "disabled" ? (
                      <>
                        <span className="badge suspended">Removed</span>
                        <button className="btn small secondary" onClick={() => restoreStudent(student.id)}>Restore</button>
                      </>
                    ) : (
                      <>
                        <span className={`badge ${student.accessStatus}`}>{student.accessStatus}</span>
                        {student.accessStatus !== "active" && <button className="btn small ok" onClick={() => updateAccess(student.id, "active")}>Activate</button>}
                        {student.accessStatus !== "suspended" && <button className="btn small danger" onClick={() => updateAccess(student.id, "suspended")}>Suspend</button>}
                        {student.accessStatus !== "pending" && student.accessStatus !== "none" && <button className="btn small secondary" onClick={() => updateAccess(student.id, "pending")}>Set Pending</button>}
                        <button className="btn small danger" onClick={() => removeStudent(student.id, student.name)}>Remove</button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
