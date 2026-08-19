"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

interface NavbarProps {
  user?: { name: string; role: string } | null;
}

const studentLinks = [
  ["/dashboard", "⌂", "Dashboard"],
  ["/dashboard#course", "▣", "My Course"],
  ["/resources", "□", "Resources"],
  ["/account", "○", "Account"],
] as const;
const adminLinks = [
  ["/admin", "⌂", "Overview"],
  ["/admin/students", "♙", "Students"],
  ["/admin/lessons", "▣", "Lessons"],
  ["/admin/resources", "□", "Resources"],
] as const;

export default function Navbar({ user }: NavbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    const saved = localStorage.getItem("storysprint-sidebar") === "collapsed";
    const timer = window.setTimeout(() => setCollapsed(saved), 0);
    return () => window.clearTimeout(timer);
  }, []);
  function toggleSidebar() {
    setCollapsed((current) => {
      const next = !current;
      localStorage.setItem("storysprint-sidebar", next ? "collapsed" : "open");
      return next;
    });
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/"); router.refresh();
  }

  if (!user) {
    return <header className="public-header"><nav className="public-nav">
      <Link href="/" className="brand-mark"><span className="brand-glyph">✦</span><span>AI StorySprint<br/><small>Editing</small></span></Link>
      <div className="flex gap-2 items-center"><Link href="/enroll" className="nav-quiet">Enroll</Link><Link href="/login" className="nav-quiet">Login</Link></div>
    </nav></header>;
  }

  const links = user.role === "admin" ? adminLinks : studentLinks;
  const home = user.role === "admin" ? "/admin" : "/dashboard";
  const isActive = (href: string) => href.split("#")[0] === pathname || (href !== home && pathname.startsWith(href.split("#")[0] + "/"));

  return <>
    <header className="mobile-app-header authenticated-shell">
      <Link href={home} className="brand-mark"><span className="brand-glyph">✦</span><span>AI StorySprint<br/><small>Editing</small></span></Link>
      <span className="mobile-user-dot">{user.name.slice(0,1).toUpperCase()}</span>
    </header>
    <aside className={`app-sidebar authenticated-shell ${collapsed ? "collapsed" : ""}`}>
      <div className="sidebar-brand-row"><Link href={home} className="sidebar-brand"><span className="brand-glyph">✦</span><span className="sidebar-label">AI StorySprint<br/><small>{user.role === "admin" ? "Editing Admin" : "Editing"}</small></span></Link><button type="button" onClick={toggleSidebar} className="sidebar-toggle" aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} title={collapsed ? "Expand sidebar" : "Collapse sidebar"}>{collapsed ? "›" : "‹"}</button></div>
      <nav className="sidebar-links">{links.map(([href, icon, label]) => <Link key={href} href={href} title={collapsed ? label : undefined} className={isActive(href) ? "active" : ""}><span>{icon}</span><span className="sidebar-label">{label}</span></Link>)}</nav>
      <div className="sidebar-encouragement"><strong>{user.role === "admin" ? "Course control" : "Keep going! ✨"}</strong><p>{user.role === "admin" ? "Manage learning with confidence." : "You’re doing great."}</p><div className="rocket">🚀</div></div>
      <button onClick={handleLogout} className="sidebar-logout" title={collapsed ? "Logout" : undefined}>↪ <span className="sidebar-label">Logout</span></button>
    </aside>
    <nav className="mobile-bottom-nav">{links.map(([href, icon, label]) => <Link key={href} href={href} className={isActive(href) ? "active" : ""}><span>{icon}</span><small>{label.replace("My ", "")}</small></Link>)}<button onClick={handleLogout}><span>↪</span><small>Logout</small></button></nav>
  </>;
}
