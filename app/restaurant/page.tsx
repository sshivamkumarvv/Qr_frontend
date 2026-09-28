"use client";

import { useCallback, useEffect, useState } from "react";
import { Boxes, ClipboardList, RefreshCw, ShoppingBag } from "lucide-react";
import { api, DashboardBranch, DashboardCategory, DashboardRestaurant, MenuAddon, MenuItem, Order, OrderStatus } from "@/lib/api";
import RestaurantManagement from "./RestaurantManagement";

interface RestaurantOverview {
  restaurant: DashboardRestaurant;
  orders: Order[];
  branches: DashboardBranch[];
  menuItems: MenuItem[];
  categories: DashboardCategory[];
  addOns: MenuAddon[];
}

const money = (amount: number | string | null | undefined) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(amount) || 0);

const dateLabel = (value: string) => new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(value));

export default function RestaurantDashboardPage() {
  const [overview, setOverview] = useState<RestaurantOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchOverview = useCallback(async () => {
    try {
      const restaurant = await api.restaurants.ownerMe();
      const [orders, branches, availableMenuItems, addOns] = await Promise.all([
        api.orders.byRestaurant(restaurant.id),
        api.branches.ownerMe(),
        api.menu.list(restaurant.id),
        api.menuAddons.list(restaurant.id),
      ]);
      const categories = restaurant.categories ?? [];
      const availableById = new Map(availableMenuItems.map((item) => [item.id, item]));
      const menuItems = (restaurant.menuItems ?? []).map((item) => ({
        ...item,
        ...availableById.get(item.id),
        categoryId: item.categoryId,
        category: categories.find((category) => category.id === item.categoryId) ?? null,
      }));
      setOverview({ restaurant, orders, branches, menuItems, categories, addOns });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load restaurant data.");
    } finally {
      setLoading(false);
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    await fetchOverview();
  }, [fetchOverview]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void fetchOverview(); }, 0);
    return () => window.clearTimeout(timer);
  }, [fetchOverview]);

  const today = new Date().toDateString();
  const orders = overview?.orders ?? [];
  const menuItems = overview?.menuItems ?? [];
  const branches = overview?.branches ?? [];
  const activeOrders = orders.filter((order) => ["PENDING", "CONFIRMED", "PREPARING", "READY", "OUT_FOR_DELIVERY"].includes(order.status));
  const todaysRevenue = orders.filter((order) => order.status === "DELIVERED" && new Date(order.createdAt).toDateString() === today)
    .reduce((sum, order) => sum + Number(order.totalAmount ?? order.total ?? 0), 0);
  const latestOrders = [...orders].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)).slice(0, 8);
  const availableItems = menuItems.filter((item) => item.isAvailable);

  const changeOrderStatus = async (id: string, status: OrderStatus) => {
    setError("");
    try {
      await api.orders.updateStatus(id, status);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update this order.");
    }
  };

  return (
    <>
      <section className="dashboard-page-head" id="overview">
        <div>
          <p className="dashboard-eyebrow">Restaurant workspace</p>
          <h1>{overview?.restaurant.name ?? "Restaurant overview"}</h1>
          <p>{overview?.restaurant.address ?? "Your service, orders, and menu at a glance."}</p>
        </div>
        <button className="dashboard-refresh" onClick={() => void load()} disabled={loading} aria-label="Refresh restaurant dashboard">
          <RefreshCw size={15} /> Refresh
        </button>
      </section>

      {error && <div className="dashboard-error" role="alert">{error}</div>}

      <section className="dashboard-kpis" aria-label="Restaurant metrics">
        <Metric label="Orders today" value={orders.filter((order) => new Date(order.createdAt).toDateString() === today).length} note="All order statuses" icon={<ClipboardList size={16} />} />
        <Metric label="In progress" value={activeOrders.length} note="Needs kitchen attention" icon={<ShoppingBag size={16} />} />
        <Metric label="Delivered revenue today" value={money(todaysRevenue)} note="Completed orders only" icon={<span>₹</span>} />
        <Metric label="Live menu items" value={availableItems.length} note={`${branches.length} active branches`} icon={<Boxes size={16} />} />
      </section>

      <section className="dashboard-section" id="orders">
        <div className="dashboard-section-head">
          <div><h2>Recent orders</h2><p>Latest orders placed across your restaurant.</p></div>
          <span className="dashboard-section-meta">{orders.length} total</span>
        </div>
        <div className="dashboard-table-wrap">
          <table className="dashboard-table">
            <thead><tr><th>Order</th><th>Customer</th><th>Branch</th><th>Placed</th><th>Status</th><th>Total</th><th>Update</th></tr></thead>
            <tbody>
              {loading && !overview ? <tr><td colSpan={7} className="dashboard-empty">Loading orders…</td></tr> : latestOrders.length ? latestOrders.map((order) => (
                <tr key={order.id}>
                  <td><strong className="dashboard-order-id">#{order.id.slice(0, 8).toUpperCase()}</strong></td>
                  <td>{order.customerName || "Customer"}</td>
                  <td>{order.branchName || order.branch?.name || "—"}</td>
                  <td>{dateLabel(order.createdAt)}</td>
                  <td><span className="dashboard-status" data-status={order.status}>{order.status.replaceAll("_", " ").toLowerCase()}</span></td>
                  <td><strong>{money(order.totalAmount ?? order.total)}</strong></td>
                  <td><select className="dashboard-select" value={order.status} aria-label={`Update order ${order.id.slice(0, 8)} status`} onChange={(event) => void changeOrderStatus(order.id, event.target.value as OrderStatus)}><OrderStatusOptions /></select></td>
                </tr>
              )) : <tr><td colSpan={7} className="dashboard-empty">No orders to show yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      {overview && <RestaurantManagement
        restaurant={overview.restaurant}
        menuItems={menuItems}
        categories={overview.categories}
        addOns={overview.addOns}
        branches={branches}
        onRefresh={load}
      />}
    </>
  );
}

function OrderStatusOptions() {
  return <>
    <option value="PENDING">Pending</option>
    <option value="CONFIRMED">Confirmed</option>
    <option value="PREPARING">Preparing</option>
    <option value="READY">Ready</option>
    <option value="OUT_FOR_DELIVERY">Out for delivery</option>
    <option value="DELIVERED">Delivered</option>
    <option value="CANCELLED">Cancelled</option>
  </>;
}

function Metric({ label, value, note, icon }: { label: string; value: string | number; note: string; icon: React.ReactNode }) {
  return <div className="dashboard-kpi"><div className="dashboard-kpi-top"><span>{label}</span><span className="dashboard-kpi-icon">{icon}</span></div><div className="dashboard-kpi-value">{value}</div><div className="dashboard-kpi-note">{note}</div></div>;
}