import { redirect } from "next/navigation";
import Navbar from "@/components/Navbar";
import { getSession } from "@/lib/auth";
import { db } from "@/db";
import { courseAccess,courses,lessonProgress,lessons } from "@/db/schema";
import { and,eq,sql } from "drizzle-orm";
import ChangePasswordForm from "./ChangePasswordForm";
import ProfileForm from "./ProfileForm";
export const dynamic="force-dynamic";
export default async function AccountPage(){
 const session=await getSession();if(!session)redirect("/login");if(session.user.role!=="student")redirect("/admin");
 const access=await db.select({status:courseAccess.status,courseTitle:courses.title,createdAt:courseAccess.createdAt}).from(courseAccess).innerJoin(courses,eq(courseAccess.courseId,courses.id)).where(eq(courseAccess.userId,session.user.id)).limit(1);
 const [done]=await db.select({count:sql<number>`count(*)`}).from(lessonProgress).where(and(eq(lessonProgress.userId,session.user.id),eq(lessonProgress.status,"completed")));
 const [total]=await db.select({count:sql<number>`count(*)`}).from(lessons);
 return <><Navbar user={session.user}/><main><div className="app-page"><p className="page-eyebrow">Profile and access</p><h1 className="text-3xl font-bold mt-1 mb-6">My Account</h1><div className="grid lg:grid-cols-[260px_1fr] gap-4"><aside className="soft-card h-fit"><div className="w-16 h-16 rounded-full bg-[#ede8ff] text-[var(--brand)] grid place-items-center text-2xl font-bold mb-3">{session.user.name.slice(0,1).toUpperCase()}</div><strong>{session.user.name}</strong><p className="text-sm text-[var(--muted)]">{session.user.email}</p><hr className="my-4 border-[var(--line)]"/><span className={`badge ${access[0]?.status||"pending"}`}>{access[0]?.status||"No enrollment"}</span></aside><section className="soft-card"><h2 className="text-xl font-bold mb-5">Profile Information</h2><div className="grid sm:grid-cols-2 gap-5"><div><span className="text-sm text-[var(--muted)]">Full name</span><p className="font-semibold">{session.user.name}</p></div><div><span className="text-sm text-[var(--muted)]">Email address</span><p className="font-semibold break-all">{session.user.email}</p></div><div><span className="text-sm text-[var(--muted)]">Account status</span><p><span className="badge active">{session.user.accountStatus}</span></p></div><div><span className="text-sm text-[var(--muted)]">Course</span><p className="font-semibold">{access[0]?.courseTitle||"Not enrolled"}</p></div><div><span className="text-sm text-[var(--muted)]">Course progress</span><p className="font-semibold">{Number(done.count)} of {Number(total.count)} lessons completed</p></div><div><span className="text-sm text-[var(--muted)]">Member since</span><p className="font-semibold">{access[0]?.createdAt?new Date(access[0].createdAt).toLocaleDateString():"—"}</p></div></div><ProfileForm name={session.user.name}/><ChangePasswordForm/></section></div></div></main></>;
}
