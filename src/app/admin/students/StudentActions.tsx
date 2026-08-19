"use client";

import { useState } from "react";
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
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const visibleStudents = students.filter((s) => {
    const effectiveStatus=s.accountStatus==="disabled"?"removed":s.accessStatus;
    return (filter === "all" || effectiveStatus === filter) && `${s.name} ${s.email}`.toLowerCase().includes(query.toLowerCase());
  });

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

  async function removeStudent(studentId:number, studentName:string){
    const typed=prompt(`Type REMOVE to safely remove ${studentName}. Their progress and records will be preserved.`);
    if(typed!=="REMOVE") return;
    const res=await fetch("/api/admin/students",{method:"DELETE",headers:{"Content-Type":"application/json"},body:JSON.stringify({userId:studentId,confirmation:typed})});
    const data=await res.json(); if(!res.ok) alert(data.error||"Removal failed"); else {setSuccess(data.message);router.refresh();}
  }
  async function restoreStudent(studentId:number){
    if(!confirm("Restore this student as pending approval?"))return;
    const res=await fetch("/api/admin/students",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({userId:studentId,action:"restore"})});
    const data=await res.json();if(!res.ok)alert(data.error||"Restore failed");else{setSuccess(data.message);router.refresh();}
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
            <PasswordField label="Temporary password" value={password} onChange={(e)=>setPassword(e.target.value)} required minLength={8} autoComplete="new-password" />
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
      <div className="grid sm:grid-cols-4 gap-3 mb-4">
        <div className="soft-card"><span className="text-sm text-[var(--muted)]">Total Students</span><strong className="block text-2xl">{students.length}</strong></div>
        <div className="soft-card"><span className="text-sm text-[var(--muted)]">Active</span><strong className="block text-2xl text-[var(--ok)]">{students.filter(s=>s.accountStatus!=="disabled"&&s.accessStatus==="active").length}</strong></div>
        <div className="soft-card"><span className="text-sm text-[var(--muted)]">Pending Approval</span><strong className="block text-2xl text-[var(--warn)]">{students.filter(s=>s.accountStatus!=="disabled"&&s.accessStatus==="pending").length}</strong></div>
        <div className="soft-card"><span className="text-sm text-[var(--muted)]">Suspended</span><strong className="block text-2xl text-[var(--danger)]">{students.filter(s=>s.accountStatus!=="disabled"&&s.accessStatus==="suspended").length}</strong></div>
      </div>
      <div className="card">
        <div className="flex justify-between gap-3 flex-wrap mb-4"><h3 className="text-lg font-semibold">Students</h3><div className="flex gap-2"><input aria-label="Search students" placeholder="Search students…" value={query} onChange={e=>setQuery(e.target.value)} className="px-3 py-2 border border-[var(--line)] rounded-lg"/><select aria-label="Filter students" value={filter} onChange={e=>setFilter(e.target.value)} className="px-3 py-2 border border-[var(--line)] rounded-lg"><option value="all">All</option><option value="active">Active</option><option value="pending">Pending</option><option value="suspended">Suspended</option><option value="removed">Removed</option></select></div></div>
        {visibleStudents.length === 0 ? (
          <p className="text-[var(--muted)]">No students enrolled yet.</p>
        ) : (
          <div className="grid gap-3">
            {visibleStudents.map((student) => (
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
                    {student.accountStatus === "disabled" ? <><span className="badge suspended">Removed</span><button className="btn small secondary" onClick={()=>restoreStudent(student.id)}>Restore</button></> : <>
                      <span className={`badge ${student.accessStatus}`}>{student.accessStatus}</span>
                      {student.accessStatus !== "active" && <button className="btn small ok" onClick={()=>updateAccess(student.id,"active")}>Activate</button>}
                      {student.accessStatus !== "suspended" && <button className="btn small danger" onClick={()=>updateAccess(student.id,"suspended")}>Suspend</button>}
                      {student.accessStatus !== "pending" && student.accessStatus !== "none" && <button className="btn small secondary" onClick={()=>updateAccess(student.id,"pending")}>Set Pending</button>}
                      <button className="btn small danger" onClick={()=>removeStudent(student.id,student.name)}>Remove</button>
                    </>}
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
