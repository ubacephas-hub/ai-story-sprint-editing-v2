import { redirect } from "next/navigation";
import Navbar from "@/components/Navbar";
import { getSession } from "@/lib/auth";
import { db } from "@/db";
import { resources,lessons,modules,courseAccess } from "@/db/schema";
import { and,eq,asc } from "drizzle-orm";
import ResourceBrowser from "./ResourceBrowser";
export const dynamic="force-dynamic";
export default async function ResourcesPage(){
 const session=await getSession();if(!session)redirect("/login");if(session.user.role!=="student")redirect("/admin");
 const access=await db.select().from(courseAccess).where(and(eq(courseAccess.userId,session.user.id),eq(courseAccess.status,"active"))).limit(1);
 if(!access.length)redirect("/dashboard");
 const rows=await db.select({id:resources.id,type:resources.type,title:resources.title,url:resources.url,content:resources.content,filePath:resources.filePath,description:resources.description,lessonTitle:lessons.title,moduleTitle:modules.title}).from(resources).innerJoin(lessons,eq(resources.lessonId,lessons.id)).innerJoin(modules,eq(lessons.moduleId,modules.id)).where(eq(modules.courseId,access[0].courseId)).orderBy(asc(modules.position),asc(lessons.position),asc(resources.position));
 return <><Navbar user={session.user}/><main><div className="app-page"><p className="page-eyebrow">Course library</p><h1 className="text-3xl font-bold mt-1">Resources</h1><p className="text-[var(--muted)] mb-6">All your guides, prompts, tools, and supporting materials in one place.</p><ResourceBrowser items={rows}/></div></main></>;
}
