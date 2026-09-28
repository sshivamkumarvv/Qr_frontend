"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowUpRight,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  MapPinned,
  Store,
  TrendingUp,
  Utensils,
  Users,
} from "lucide-react";
import { api, storage } from "@/lib/api";

type DashboardMode = "restaurant" | "super-admin";

const navigation = {
  restaurant: [
    { label: "Overview", href: "/restaurant#overview", icon: LayoutDashboard },
    { label: "Orders", href: "/restaurant#orders", icon: ClipboardList },
    { label: "Manage", href: "/restaurant#management", icon: Store },
    { label: "Menu", href: "/restaurant#menu", icon: Utensils },
    { label: "Branches", href: "/restaurant#branches", icon: MapPinned },
  ],
  "super-admin": [
    { label: "Overview", href: "/super-admin#overview", icon: LayoutDashboard },
    { label: "Orders", href: "/super-admin#orders", icon: ClipboardList },
    { label: "Restaurants", href: "/super-admin#restaurants", icon: Store },
    { label: "Customers", href: "/super-admin#customers", icon: Users },
    { label: "Performance", href: "/super-admin#performance", icon: TrendingUp },
  ],
};

export default function DashboardShell({
  mode,
  children,
}: {
  mode: DashboardMode;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  const [name, setName] = useState("");
  const isAdmin = mode === "super-admin";

  useEffect(() => {
    let mounted = true;
    const auth = storage.getAuth();
    if (!auth?.accessToken) {
      router.replace("/auth");
      return () => { mounted = false; };
    }

    api.auth.me().then((user) => {
      if (!mounted) return;
      const expectedRole = isAdmin ? "admin" : "restaurant_owner";
      if (user.role !== expectedRole) {
        router.replace(user.role === "admin" ? "/super-admin" : user.role === "restaurant_owner" ? "/restaurant" : "/");
        return;
      }
      setName(user.fullName || (isAdmin ? "Platform admin" : "Restaurant owner"));
      setReady(true);
    }).catch(() => {
      if (!mounted) return;
      storage.clearAuth();
      router.replace("/auth");
    });

    return () => { mounted = false; };
  }, [isAdmin, router]);

  const signOut = () => {
    storage.clearAuth();
    router.replace("/auth");
  };

  if (!ready) {
    return <div className="dashboard-loading">Verifying your workspace…</div>;
  }

  return (
    <div className="dashboard-shell">
      <aside className="dashboard-sidebar">
        <Link href={isAdmin ? "/super-admin" : "/restaurant"} className="dashboard-brand">
          <span className="dashboard-brand-mark">D</span>
          <span><strong>DineIn</strong><small>{isAdmin ? "PLATFORM" : "RESTAURANT"}</small></span>
        </Link>

        <div className="dashboard-nav-label">WORKSPACE</div>
        <nav className="dashboard-nav" aria-label="Dashboard navigation">
          {navigation[mode].map(({ label, href, icon: Icon }) => {
            const active = pathname === (isAdmin ? "/super-admin" : "/restaurant") && label === "Overview";
            return (
              <Link key={label} href={href} className={`dashboard-nav-link${active ? " is-active" : ""}`}>
                <Icon size={17} strokeWidth={1.9} />
                <span>{label}</span>
                {active && <ArrowUpRight size={14} className="dashboard-nav-arrow" />}
              </Link>
            );
          })}
        </nav>

        <div className="dashboard-sidebar-bottom">
          <div className="dashboard-account">
            <span className="dashboard-avatar">{name.slice(0, 1).toUpperCase() || "D"}</span>
            <span className="dashboard-account-copy"><strong>{name}</strong><small>{isAdmin ? "Super admin" : "Restaurant owner"}</small></span>
          </div>
          <button className="dashboard-signout" onClick={signOut}>
            <LogOut size={16} /> Sign out
          </button>
        </div>
      </aside>

      <div className="dashboard-main">
        <header className="dashboard-topbar">
          <div><span className="dashboard-topbar-dot" /> Operations workspace</div>
          <span>{new Intl.DateTimeFormat("en", { weekday: "short", month: "short", day: "numeric" }).format(new Date())}</span>
        </header>
        <main className="dashboard-content">{children}</main>
      </div>
    </div>
  );
}