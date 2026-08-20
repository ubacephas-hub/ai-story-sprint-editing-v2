"use client";
import { useMemo, useState } from "react";

type Item={id:number;type:string;title:string;url:string|null;content:string|null;filePath:string|null;description:string|null;lessonTitle:string;moduleTitle:string};
export default function ResourceBrowser({items}:{items:Item[]}){
 const [q,setQ]=useState(""); const [type,setType]=useState("all");
 const shown=useMemo(()=>items.filter(x=>(type==="all"||x.type===type)&&`${x.title} ${x.description} ${x.lessonTitle} ${x.moduleTitle}`.toLowerCase().includes(q.toLowerCase())),[items,q,type]);
 return <><div className="soft-card mb-4 flex flex-wrap gap-3"><input aria-label="Search resources" placeholder="Search resources…" value={q} onChange={e=>setQ(e.target.value)} className="flex-1 min-w-52 px-4 py-3 border border-[var(--line)] rounded-lg"/><select aria-label="Filter resource type" value={type} onChange={e=>setType(e.target.value)} className="px-4 py-3 border border-[var(--line)] rounded-lg"><option value="all">All resources</option><option value="link">Links</option><option value="text">Notes</option><option value="document">Documents</option></select></div>
 <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">{shown.map(x=><article className="soft-card resource-tile" key={x.id}><span className="resource-icon">{x.type==="link"?"↗":x.type==="text"?"☷":"□"}</span><span className="page-eyebrow">{x.moduleTitle}</span><h2 className="text-lg font-bold">{x.title}</h2><p className="text-sm text-[var(--muted)]">{x.description||x.lessonTitle}</p>{x.type==="text"&&x.content&&<p className="text-sm mt-3 line-clamp-3">{x.content}</p>}<div className="resource-action">{x.type==="link"&&x.url?<a className="btn secondary small" href={x.url} target="_blank" rel="noreferrer">Open resource ↗</a>:x.type==="document"&&x.filePath?<a className="btn secondary small" href={x.filePath}>Open document</a>:<span className="text-sm text-[var(--muted)]">Available in lesson</span>}</div></article>)}</div>
 {!shown.length&&<div className="soft-card text-center py-12"><h2 className="text-xl font-bold">No matching resources</h2><p className="text-[var(--muted)]">Try another search or filter.</p></div>}</>;
}
