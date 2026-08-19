import { redirect } from "next/navigation";
import Link from "next/link";
import type { CSSProperties } from "react";
import Navbar from "@/components/Navbar";
import { getSession } from "@/lib/auth";
import { db } from "@/db";
import { courses, modules, lessons, courseAccess, lessonProgress, resources } from "@/db/schema";
import { eq, and, asc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.user.role === "admin") redirect("/admin");
  const user = session.user;

  const access = await db.select().from(courseAccess).innerJoin(courses, eq(courseAccess.courseId,courses.id)).where(eq(courseAccess.userId,user.id));
  const active = access.find(a=>a.course_access.status==="active");
  const pending = access.some(a=>a.course_access.status==="pending");
  const suspended = access.some(a=>a.course_access.status==="suspended");

  const courseModules:Array<{module:typeof modules.$inferSelect; lessons:Array<{lesson:typeof lessons.$inferSelect;progress:typeof lessonProgress.$inferSelect|null}>}> = [];
  if(active){
    const mods=await db.select().from(modules).where(eq(modules.courseId,active.courses.id)).orderBy(asc(modules.position));
    for(const mod of mods){
      const ls=await db.select().from(lessons).where(eq(lessons.moduleId,mod.id)).orderBy(asc(lessons.position));
      const items=[];
      for(const lesson of ls){const p=await db.select().from(lessonProgress).where(and(eq(lessonProgress.userId,user.id),eq(lessonProgress.lessonId,lesson.id))).limit(1);items.push({lesson,progress:p[0]||null});}
      courseModules.push({module:mod,lessons:items});
    }
  }
  const flat=courseModules.flatMap(m=>m.lessons.map(x=>({...x,module:m.module})));
  const completed=flat.filter(x=>x.progress?.status==="completed").length;
  const percent=flat.length?Math.round(completed/flat.length*100):0;
  const next=flat.find(x=>x.progress?.status==="in_progress")||flat.find(x=>x.progress?.status!=="completed")||flat[flat.length-1];
  const existingResources=active?await db.select().from(resources).innerJoin(lessons,eq(resources.lessonId,lessons.id)).limit(4):[];
  const icons=["✓","▱","▯","☷"];

  return <><Navbar user={user}/><main><div className="app-page">
    <div className="mb-6"><p className="page-eyebrow">Student home</p><h1 className="text-3xl font-bold mt-1">Welcome back, {user.name}! 👋</h1><p className="text-[var(--muted)]">Let’s continue your AI StorySprint Editing journey.</p></div>

    {pending&&<div className="soft-card text-center py-10"><div className="text-5xl mb-4">◷</div><h2 className="text-2xl font-bold">Your enrollment is pending</h2><p className="text-[var(--muted)] max-w-lg mx-auto mt-2">Your account is ready. We’ll let you know as soon as your course access is approved.</p></div>}
    {suspended&&<div className="alert error">Your course access is currently suspended. Please contact the course administrator.</div>}

    {active&&<>
      <div className="grid lg:grid-cols-[1.6fr_.8fr] gap-4">
        <section className="soft-card continue-card">
          <span className="badge in-progress">{percent===100?"Course completed":"Continue learning"}</span>
          {next?<><h2 className="text-2xl font-bold mt-4">Lesson {flat.findIndex(x=>x.lesson.id===next.lesson.id)+1} — {next.lesson.title}</h2><p className="text-[var(--muted)]">Module {courseModules.findIndex(m=>m.module.id===next.module.id)+1} · {next.module.title}</p><div className="progress-bar my-5"><span className="progress-bar-fill" style={{width:`${next.progress?.status==="completed"?100:next.progress?40:0}%`}}/></div><Link className="btn no-underline" href={`/lesson/${next.lesson.id}`}>{percent===100?"Review Course":"Continue Lesson"} →</Link></>:<p className="mt-4">Your lessons will appear here.</p>}
        </section>
        <section className="soft-card"><h2 className="text-lg font-bold">Your Progress</h2><div className="flex items-center gap-5 my-4"><div className="progress-ring" style={{"--p":percent} as CSSProperties}><strong>{percent}%</strong></div><div><strong>{completed} of {flat.length}</strong><p className="text-sm text-[var(--muted)]">lessons completed</p></div></div><div className="grid gap-2">{courseModules.map((m,i)=>{const n=m.lessons.filter(x=>x.progress?.status==="completed").length;return <div className="flex justify-between text-sm" key={m.module.id}><span><span style={{color:n===m.lessons.length?"var(--ok)":"var(--brand)"}}>●</span> Module {i+1}</span><strong>{n}/{m.lessons.length}</strong></div>})}</div></section>
      </div>

      <div id="course" className="section-heading"><h2>Your Course</h2><span className="text-sm text-[var(--muted)]">{completed}/{flat.length} lessons complete</span></div>
      <div className="grid md:grid-cols-2 gap-3">{courseModules.map((m,i)=>{const done=m.lessons.filter(x=>x.progress?.status==="completed").length;const state=done===m.lessons.length?"Completed":done?"In progress":"Not started";return <details className="module-outline" key={m.module.id} open={i===courseModules.findIndex(x=>x.lessons.some(l=>l.progress?.status==="in_progress"))}>
        <summary><div className="flex items-start justify-between gap-3"><div className="flex gap-3"><div className="module-icon mb-0">{icons[i]}</div><div><strong className="text-sm text-[var(--muted)]">Module {i+1}</strong><h3 className="font-bold text-lg">{m.module.title}</h3><p className="text-xs text-[var(--muted)]">{done} of {m.lessons.length} lessons</p></div></div><div className="flex items-center gap-3"><span className={`badge ${state.toLowerCase().replace(" ","-")}`}>{state}</span><span className="module-chevron">›</span></div></div></summary>
        <div className="lesson-outline">{m.lessons.map((item,li)=>{const globalNum=courseModules.slice(0,i).reduce((sum,x)=>sum+x.lessons.length,0)+li+1;return <Link href={`/lesson/${item.lesson.id}`} key={item.lesson.id}><span className="flex items-center gap-3"><span className={`lesson-status-dot ${item.progress?.status||""}`}/><span><small className="block text-[var(--muted)]">Lesson {globalNum}</small><strong>{item.lesson.title}</strong></span></span><span>→</span></Link>})}</div>
      </details>})}</div>

      <div className="section-heading"><h2>Quick Access</h2><Link href="/resources" className="text-sm font-semibold">View all resources</Link></div>
      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3">{existingResources.length?existingResources.map(({resources:r})=><Link key={r.id} href="/resources" className="soft-card resource-tile text-[var(--ink)]"><span className="resource-icon">{r.type==="link"?"↗":r.type==="text"?"☷":"□"}</span><strong>{r.title}</strong><p className="text-sm text-[var(--muted)]">{r.description||`Course ${r.type} resource`}</p><span className="resource-action text-sm font-bold text-[var(--brand)]">Open →</span></Link>):["Phone Workflow","Laptop Workflow","Prompt Resources","Tools & Glossary"].map((x,i)=><div className="soft-card resource-tile" key={x}><span className="resource-icon">{icons[i]}</span><strong>{x}</strong><p className="text-sm text-[var(--muted)]">Resources will appear here when added.</p></div>)}</div>
    </>}
  </div></main></>;
}
