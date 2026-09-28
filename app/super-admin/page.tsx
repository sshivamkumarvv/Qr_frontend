"use client";

import { useCallback, useEffect, useState } from "react";
import { Activity, CircleDollarSign, ClipboardList, RefreshCw, Store, Users } from "lucide-react";
import { AdminDashboardData, AdminRestaurant, AdminUser, api, Order, OrderStatus } from "@/lib/api";
interface SuperAdminOverview {
  dashboard: AdminDashboardData;
  restaurants: AdminRestaurant[];
  orders: Order[];
  customers: AdminUser[];
}

const money = (amount: number | string | null | undefined) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(amount) || 0);

const dateLabel = (value: string) => new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(value));

export default function SuperAdminDashboardPage() {
  const [overview, setOverview] = useState<SuperAdminOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [orderQuery, setOrderQuery] = useState("");
  const [restaurantQuery, setRestaurantQuery] = useState("");
  const [customerQuery, setCustomerQuery] = useState("");

  const fetchOverview = useCallback(async () => {
    try {
      const [dashboard, restaurants, orders, customers] = await Promise.all([
        api.admin.dashboard(),
        api.admin.restaurants(),
        api.admin.orders(),
        api.admin.customers(),
      ]);
      setOverview({ dashboard, restaurants, orders, customers });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load platform data.");
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

  const data = overview?.dashboard;
  const stats = data?.statistics;
  const latestOrders = data?.latestOrders ?? [];
    const managedOrders = [...(overview?.orders ?? latestOrders)]
      .filter((order) => `${order.id} ${order.restaurantName} ${order.customerName}`.toLowerCase().includes(orderQuery.toLowerCase()))
      .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)).slice(0, 30);
    const visibleRestaurants = (overview?.restaurants ?? []).filter((restaurant) =>
      `${restaurant.name} ${restaurant.address}`.toLowerCase().includes(restaurantQuery.toLowerCase()),
    );
    const customers = (overview?.customers ?? [])
      .filter((user) => user.role === "customer" && `${user.fullName ?? ""} ${user.phone}`.toLowerCase().includes(customerQuery.toLowerCase()));
  const topItems = data?.topSellingItems ?? [];
  const branchStats = data?.branches ?? [];
  const maxBranchOrders = Math.max(1, ...branchStats.map((branch) => branch.totalOrders));

  const refreshAfter = async (action: () => Promise<unknown>, errorText: string) => {
    setSaving(true);
    setError("");
    try {
      await action();
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : errorText);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <section className="dashboard-page-head" id="overview">
        <div><p className="dashboard-eyebrow">Platform control</p><h1>Platform overview</h1><p>Live service, order, and restaurant performance.</p></div>
        <button className="dashboard-refresh" onClick={() => void load()} disabled={loading} aria-label="Refresh platform dashboard"><RefreshCw size={15} /> Refresh</button>
      </section>

      {error && <div className="dashboard-error" role="alert">{error}</div>}

      <section className="dashboard-kpis" aria-label="Platform metrics">
        <Metric label="Delivered revenue" value={money(data?.revenue.totalRevenue ?? stats?.revenue)} note={`${data?.revenue.totalOrders ?? 0} completed orders`} icon={<CircleDollarSign size={16} />} />
        <Metric label="Total orders" value={stats?.totalOrders ?? "—"} note={`${stats?.pendingOrders ?? 0} pending right now`} icon={<ClipboardList size={16} />} />
        <Metric label="Active restaurants" value={stats?.restaurants ?? "—"} note={`${stats?.branches ?? 0} active branches`} icon={<Store size={16} />} />
        <Metric label="Active users" value={stats?.customers ?? "—"} note={`${stats?.menuItems ?? 0} available menu items`} icon={<Users size={16} />} />
      </section>

      <section className="dashboard-section" id="orders">
        <div className="dashboard-section-head"><div><h2>Platform orders</h2><p>Search orders and update their status.</p></div><span className="dashboard-section-meta">{data?.orderSummary.total ?? 0} total</span></div>
        <label className="dashboard-search"><span>Find order</span><input value={orderQuery} onChange={(event) => setOrderQuery(event.target.value)} placeholder="Order ID, customer, or restaurant" /></label>
        <div className="dashboard-table-wrap">
          <table className="dashboard-table">
            <thead><tr><th>Order</th><th>Restaurant</th><th>Customer</th><th>Placed</th><th>Status</th><th>Total</th><th>Update</th></tr></thead>
            <tbody>
              {loading && !overview ? <tr><td colSpan={7} className="dashboard-empty">Loading platform activity…</td></tr> : managedOrders.length ? managedOrders.map((order) => <OrderRow key={order.id} order={order} onStatusChange={(status) => void refreshAfter(() => api.admin.updateOrderStatus(order.id, status), "Could not update this order.")} />) : <tr><td colSpan={7} className="dashboard-empty">No orders to show yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <div className="dashboard-data-grid">
        <section className="dashboard-section" id="restaurants">
          <div className="dashboard-section-head"><div><h2>Restaurants</h2><p>Activate or pause restaurants across the platform.</p></div><span className="dashboard-section-meta">{overview?.restaurants.filter((restaurant) => restaurant.isActive).length ?? 0} active · {overview?.restaurants.length ?? 0} total</span></div>
          <label className="dashboard-search"><span>Find restaurant</span><input value={restaurantQuery} onChange={(event) => setRestaurantQuery(event.target.value)} placeholder="Name or address" /></label>
          <div className="dashboard-table-wrap">
            <table className="dashboard-table">
              <thead><tr><th>Name</th><th>Location</th><th>Rating</th><th>Status</th><th>Control</th></tr></thead>
              <tbody>
                {visibleRestaurants.map((restaurant) => <tr key={restaurant.id}><td><strong>{restaurant.name}</strong></td><td>{restaurant.address}</td><td>{Number(restaurant.rating ?? 0).toFixed(1)}</td><td><span className="dashboard-status" data-status={restaurant.isActive ? "DELIVERED" : "CANCELLED"}>{restaurant.isActive ? "Active" : "Paused"}</span></td><td><button className="dashboard-small-button" disabled={saving || loading} onClick={() => void refreshAfter(() => api.admin.setRestaurantStatus(restaurant.id, !restaurant.isActive), "Could not update restaurant status.")}>{restaurant.isActive ? "Pause" : "Activate"}</button></td></tr>)}
                {!loading && visibleRestaurants.length === 0 && <tr><td colSpan={5} className="dashboard-empty">No matching restaurants.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>

        <section className="dashboard-section" id="customers">
          <div className="dashboard-section-head"><div><h2>Customer accounts</h2><p>Manage access for customer accounts.</p></div><span className="dashboard-section-meta">{customers.length} customers</span></div>
          <label className="dashboard-search"><span>Find customer</span><input value={customerQuery} onChange={(event) => setCustomerQuery(event.target.value)} placeholder="Name or phone" /></label>
          <div className="dashboard-table-wrap">
            <table className="dashboard-table">
              <thead><tr><th>Name</th><th>Phone</th><th>Joined</th><th>Status</th><th>Control</th></tr></thead>
              <tbody>
                {customers.map((customer) => <tr key={customer.id}><td><strong>{customer.fullName || "Unnamed customer"}</strong></td><td>{customer.phone}</td><td>{dateLabel(customer.createdAt)}</td><td><span className="dashboard-status" data-status={customer.isActive ? "DELIVERED" : "CANCELLED"}>{customer.isActive ? "Active" : "Disabled"}</span></td><td><button className="dashboard-small-button" disabled={saving || loading} onClick={() => void refreshAfter(() => api.admin.setCustomerStatus(customer.id, !customer.isActive), "Could not update customer status.")}>{customer.isActive ? "Disable" : "Enable"}</button></td></tr>)}
                {!loading && customers.length === 0 && <tr><td colSpan={5} className="dashboard-empty">No customer accounts found.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>

        <section className="dashboard-section" id="performance">
          <div className="dashboard-section-head"><div><h2>Performance</h2><p>Top sellers and branch order volume.</p></div><Activity size={17} color="#718078" /></div>
          <div className="dashboard-list">
            {topItems.slice(0, 5).map((item, index) => <div className="dashboard-list-row" key={item.menuItemId ?? `${item.name}-${index}`}><span className="dashboard-list-rank">{index + 1}</span><span className="dashboard-list-copy"><strong>{item.name}</strong><small>{item.quantity} sold</small></span><span className="dashboard-list-value">{money(item.revenue)}</span></div>)}
            {!loading && topItems.length === 0 && <div className="dashboard-empty">No completed sales yet.</div>}
          </div>
          {!!branchStats.length && <div className="dashboard-bars" style={{ marginTop: 19 }}>
            {branchStats.slice(0, 5).map((branch) => <div className="dashboard-bar-row" key={branch.id}><span title={branch.name}>{branch.name}</span><div className="dashboard-bar-track"><div className="dashboard-bar-fill" style={{ width: `${Math.max(3, (branch.totalOrders / maxBranchOrders) * 100)}%` }} /></div><strong>{branch.totalOrders}</strong></div>)}
          </div>}
        </section>
      </div>
    </>
  );
}

function OrderRow({ order, onStatusChange }: { order: Order; onStatusChange: (status: OrderStatus) => void }) {
  return <tr><td><strong className="dashboard-order-id">#{order.id.slice(0, 8).toUpperCase()}</strong></td><td>{order.restaurantName || "—"}</td><td>{order.customerName || "Customer"}</td><td>{dateLabel(order.createdAt)}</td><td><span className="dashboard-status" data-status={order.status}>{order.status.replaceAll("_", " ").toLowerCase()}</span></td><td><strong>{money(order.totalAmount ?? order.total)}</strong></td><td><select className="dashboard-select" value={order.status} aria-label={`Update order ${order.id.slice(0, 8)} status`} onChange={(event) => onStatusChange(event.target.value as OrderStatus)}><OrderStatusOptions /></select></td></tr>;
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