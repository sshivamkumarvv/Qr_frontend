import DashboardShell from "../dashboard/DashboardShell";
import "../dashboard/dashboard.css";

export default function RestaurantDashboardLayout({ children }: { children: React.ReactNode }) {
  return <DashboardShell mode="restaurant">{children}</DashboardShell>;
}