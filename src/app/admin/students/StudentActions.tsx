"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface StudentInfo {
  id: number;
  name: string;
  email: string;
  accessStatus: string;
  accessId: number | null;
  completedLessons: number;
}

interface Props {
  courseId: number | null;
  students: StudentInfo[];
  totalLessons: number;
}

export default function StudentActions({
  courseId,
  students,
  totalLessons,
}: Props) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("active");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleAddStudent(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const res = await fetch("/api/admin/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          password,
          status,
          courseId,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
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
    }
    setLoading(false);
  }

  async function updateAccess(studentId: number, newStatus: string) {
    try {
      await fetch("/api/admin/students/access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: studentId,
          courseId,
          status: newStatus,
        }),
      });
      router.refresh();
    } catch {
      alert("Failed to update access");
    }
  }

  return (
    <>
      {/* Add student form */}
      <div className="card mb-6">
        <h3 className="text-lg font-semibold mb-3">Add Student</h3>
        {error && <div className="alert error">{error}</div>}
        {success && <div className="alert success">{success}</div>}
        <form onSubmit={handleAddStudent}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
            <div className="form-group mb-0">
              <label>Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="form-group mb-0">
              <label>Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="form-group mb-0">
              <label>Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
            <div className="form-group mb-0">
              <label>Course Access</label>
              <select value={status} onChange={(e) => setStatus(e.target.value)}>
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

      {/* Student list */}
      <div className="card">
        <h3 className="text-lg font-semibold mb-3">
          All Students ({students.length})
        </h3>
        {students.length === 0 ? (
          <p className="text-[var(--muted)]">No students enrolled yet.</p>
        ) : (
          <div className="grid gap-3">
            {students.map((student) => (
              <div
                key={student.id}
                className="p-3 border border-[var(--line)] rounded-lg"
              >
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <div className="font-semibold">{student.name}</div>
                    <div className="text-sm text-[var(--muted)]">
                      {student.email}
                    </div>
                    <div className="text-sm text-[var(--muted)] mt-1">
                      Progress: {student.completedLessons}/{totalLessons}{" "}
                      lessons
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`badge ${student.accessStatus}`}
                    >
                      {student.accessStatus}
                    </span>
                    {student.accessStatus !== "active" && (
                      <button
                        className="btn small ok"
                        onClick={() => updateAccess(student.id, "active")}
                      >
                        Activate
                      </button>
                    )}
                    {student.accessStatus !== "suspended" && (
                      <button
                        className="btn small danger"
                        onClick={() => updateAccess(student.id, "suspended")}
                      >
                        Suspend
                      </button>
                    )}
                    {student.accessStatus !== "pending" &&
                      student.accessStatus !== "none" && (
                        <button
                          className="btn small secondary"
                          onClick={() => updateAccess(student.id, "pending")}
                        >
                          Set Pending
                        </button>
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
