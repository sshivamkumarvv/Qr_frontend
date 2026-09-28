import DashboardShell from "../dashboard/DashboardShell";
import "../dashboard/dashboard.css";

export default function SuperAdminDashboardLayout({ children }: { children: React.ReactNode }) {
  return <DashboardShell mode="super-admin">{children}</DashboardShell>;
}