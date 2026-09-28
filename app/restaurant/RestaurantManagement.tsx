"use client";

import { FormEvent, useState } from "react";
import { Check, Edit2, Plus, Power, Save, X } from "lucide-react";
import {
  api,
  DashboardBranch,
  DashboardCategory,
  DashboardRestaurant,
  MenuAddon,
  MenuItem,
  RestaurantUpdatePayload,
} from "@/lib/api";

interface Props {
  restaurant: DashboardRestaurant;
  menuItems: MenuItem[];
  categories: DashboardCategory[];
  addOns: MenuAddon[];
  branches: DashboardBranch[];
  onRefresh: () => Promise<void>;
}

const money = (amount: number | string) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(amount) || 0);

export default function RestaurantManagement({ restaurant, menuItems, categories, addOns, branches, onRefresh }: Props) {
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingDetails, setEditingDetails] = useState(false);
  const [details, setDetails] = useState({
    name: restaurant.name,
    address: restaurant.address,
    description: restaurant.description ?? "",
    phone: restaurant.phone ?? "",
    baseDeliveryFee: restaurant.baseDeliveryFee == null ? "" : String(restaurant.baseDeliveryFee),
    perKmDeliveryFee: restaurant.perKmDeliveryFee == null ? "" : String(restaurant.perKmDeliveryFee),
    taxPercent: restaurant.taxPercent == null ? "" : String(restaurant.taxPercent),
    dineInDiscountPercent: restaurant.dineInDiscountPercent == null ? "" : String(restaurant.dineInDiscountPercent),
  });
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [itemName, setItemName] = useState("");
  const [itemPrice, setItemPrice] = useState("");
  const [itemDescription, setItemDescription] = useState("");
  const [itemCategoryId, setItemCategoryId] = useState("");
  const [itemIsVeg, setItemIsVeg] = useState(true);
  const [selectedAddOnIds, setSelectedAddOnIds] = useState<string[]>([]);
  const [categoryName, setCategoryName] = useState("");
  const [addOnName, setAddOnName] = useState("");
  const [addOnPrice, setAddOnPrice] = useState("");
  const [showItemForm, setShowItemForm] = useState(false);

  const flashError = (cause: unknown) => {
    setError(cause instanceof Error ? cause.message : "The change could not be saved.");
    setNotice("");
  };

  const runChange = async (action: () => Promise<unknown>, message: string): Promise<boolean> => {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await action();
      await onRefresh();
      setNotice(message);
      return true;
    } catch (cause) {
      flashError(cause);
      return false;
    } finally {
      setSaving(false);
    }
  };

  const saveDetails = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const optionalNumber = (value: string) => value.trim() ? Number(value) : undefined;
    const payload: RestaurantUpdatePayload = {
      name: details.name.trim(),
      address: details.address.trim(),
      description: details.description.trim() || undefined,
      phone: details.phone.trim() || undefined,
      baseDeliveryFee: optionalNumber(details.baseDeliveryFee),
      perKmDeliveryFee: optionalNumber(details.perKmDeliveryFee),
      taxPercent: optionalNumber(details.taxPercent),
      dineInDiscountPercent: optionalNumber(details.dineInDiscountPercent),
    };
    if (await runChange(() => api.restaurants.update(restaurant.id, payload), "Restaurant details saved.")) {
      setEditingDetails(false);
    }
  };

  const openItem = (item?: MenuItem) => {
    setEditingItem(item ?? null);
    setItemName(item?.name ?? "");
    setItemPrice(item ? String(item.price) : "");
    setItemDescription(item?.description ?? "");
    setItemCategoryId(item?.categoryId ?? "");
    setItemIsVeg(item?.isVeg ?? true);
    setSelectedAddOnIds(item?.addOns?.map((addon) => addon.id) ?? []);
    setShowItemForm(true);
  };

  const saveItem = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const payload = {
      name: itemName.trim(),
      price: Number(itemPrice),
      description: itemDescription.trim() || undefined,
      categoryId: itemCategoryId || undefined,
      isVeg: itemIsVeg,
      restaurantId: restaurant.id,
      ...(editingItem?.addOns !== undefined || !editingItem ? { addOnIds: selectedAddOnIds } : {}),
    };
    if (await runChange(async () => {
      if (editingItem) {
        const { restaurantId: _unused, ...updatePayload } = payload;
        await api.menu.update(editingItem.id, updatePayload);
      } else {
        await api.menu.create(payload);
      }
    }, editingItem ? "Menu item updated." : "Menu item added.")) {
      setShowItemForm(false);
    }
  };

  const addCategory = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (await runChange(() => api.categories.create({ name: categoryName.trim(), restaurantId: restaurant.id }), "Category added.")) setCategoryName("");
  };

  const addAddon = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (await runChange(() => api.menuAddons.create({ name: addOnName.trim(), price: Number(addOnPrice), restaurantId: restaurant.id }), "Add-on added.")) {
      setAddOnName("");
      setAddOnPrice("");
    }
  };

  return (
    <section className="dashboard-section" id="management">
      <div className="dashboard-section-head">
        <div><h2>Manage restaurant</h2><p>Keep your restaurant details, menu, extras, and branch availability up to date.</p></div>
      </div>
      {error && <div className="dashboard-error" role="alert">{error}</div>}
      {notice && <div className="dashboard-success" role="status"><Check size={15} />{notice}</div>}

      <div className="dashboard-management-heading">
        <div><h3>Restaurant details</h3><p>{restaurant.address}</p></div>
        <button className="dashboard-small-button" onClick={() => setEditingDetails((open) => !open)}>
          {editingDetails ? <X size={14} /> : <Edit2 size={14} />}{editingDetails ? "Cancel" : "Edit details"}
        </button>
      </div>
      {editingDetails && (
        <form className="dashboard-form" onSubmit={saveDetails}>
          <div className="dashboard-form-grid">
            <Field label="Restaurant name"><input required value={details.name} onChange={(event) => setDetails({ ...details, name: event.target.value })} /></Field>
            <Field label="Phone"><input type="tel" value={details.phone} onChange={(event) => setDetails({ ...details, phone: event.target.value })} /></Field>
            <Field label="Address"><input required value={details.address} onChange={(event) => setDetails({ ...details, address: event.target.value })} /></Field>
            <Field label="Description"><input value={details.description} onChange={(event) => setDetails({ ...details, description: event.target.value })} /></Field>
            <Field label="Base delivery fee"><input type="number" min="0" step="0.01" value={details.baseDeliveryFee} onChange={(event) => setDetails({ ...details, baseDeliveryFee: event.target.value })} /></Field>
            <Field label="Per-kilometer fee"><input type="number" min="0" step="0.01" value={details.perKmDeliveryFee} onChange={(event) => setDetails({ ...details, perKmDeliveryFee: event.target.value })} /></Field>
            <Field label="Tax percent"><input type="number" min="0" max="100" step="0.01" value={details.taxPercent} onChange={(event) => setDetails({ ...details, taxPercent: event.target.value })} /></Field>
            <Field label="Dine-in discount percent"><input type="number" min="0" max="100" step="0.01" value={details.dineInDiscountPercent} onChange={(event) => setDetails({ ...details, dineInDiscountPercent: event.target.value })} /></Field>
          </div>
          <button className="dashboard-primary-button" type="submit" disabled={saving}><Save size={15} /> Save restaurant</button>
        </form>
      )}

      <div className="dashboard-management-heading dashboard-management-divider" id="menu">
        <div><h3>Menu, categories & add-ons</h3><p>{menuItems.length} items · {categories.length} categories · {addOns.length} available add-ons</p></div>
        <button className="dashboard-primary-button" onClick={() => openItem()}><Plus size={15} /> Add item</button>
      </div>
      <div className="dashboard-management-toolbar">
        <form className="dashboard-quick-form" onSubmit={addCategory}>
          <label className="dashboard-quick-label" htmlFor="new-category">New category</label>
          <input id="new-category" required placeholder="e.g. Main course" value={categoryName} onChange={(event) => setCategoryName(event.target.value)} />
          <button className="dashboard-small-button" type="submit" disabled={saving}><Plus size={14} /> Add</button>
        </form>
        <form className="dashboard-quick-form" onSubmit={addAddon}>
          <label className="dashboard-quick-label" htmlFor="new-addon">New add-on</label>
          <input id="new-addon" required placeholder="e.g. Mint dip" value={addOnName} onChange={(event) => setAddOnName(event.target.value)} />
          <input aria-label="Add-on price" required type="number" min="0" step="0.01" placeholder="Price" value={addOnPrice} onChange={(event) => setAddOnPrice(event.target.value)} />
          <button className="dashboard-small-button" type="submit" disabled={saving}><Plus size={14} /> Add</button>
        </form>
      </div>

      {showItemForm && (
        <form className="dashboard-form" onSubmit={saveItem}>
          <div className="dashboard-section-head"><div><h3>{editingItem ? "Edit menu item" : "New menu item"}</h3><p>Choose which reusable add-ons appear with this item.</p></div><button type="button" className="dashboard-icon-button" aria-label="Close item form" onClick={() => setShowItemForm(false)}><X size={16} /></button></div>
          <div className="dashboard-form-grid">
            <Field label="Item name"><input required maxLength={150} value={itemName} onChange={(event) => setItemName(event.target.value)} /></Field>
            <Field label="Price"><input required type="number" min="0" step="0.01" value={itemPrice} onChange={(event) => setItemPrice(event.target.value)} /></Field>
            <Field label="Category"><select value={itemCategoryId} onChange={(event) => setItemCategoryId(event.target.value)}><option value="">Uncategorized</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></Field>
            <Field label="Description"><input maxLength={500} value={itemDescription} onChange={(event) => setItemDescription(event.target.value)} /></Field>
          </div>
          <label className="dashboard-checkbox"><input type="checkbox" checked={itemIsVeg} onChange={(event) => setItemIsVeg(event.target.checked)} /> Vegetarian</label>
          <div className="dashboard-addon-picker">
            <span className="dashboard-quick-label">Available add-ons</span>
            {addOns.length ? addOns.map((addon) => <label className="dashboard-checkbox" key={addon.id}><input type="checkbox" checked={selectedAddOnIds.includes(addon.id)} onChange={() => setSelectedAddOnIds((selected) => selected.includes(addon.id) ? selected.filter((id) => id !== addon.id) : [...selected, addon.id])} />{addon.name}<span>{money(addon.price)}</span></label>) : <span className="dashboard-section-meta">Add an option above to make it available here.</span>}
          </div>
          <div className="dashboard-form-actions"><button className="dashboard-primary-button" type="submit" disabled={saving}><Save size={15} /> {editingItem ? "Save item" : "Create item"}</button><button className="dashboard-small-button" type="button" onClick={() => setShowItemForm(false)}>Cancel</button></div>
        </form>
      )}

      <div className="dashboard-table-wrap">
        <table className="dashboard-table">
          <thead><tr><th>Item</th><th>Category</th><th>Price</th><th>Add-ons</th><th>Availability</th><th>Actions</th></tr></thead>
          <tbody>
            {menuItems.map((item) => (
              <tr key={item.id}>
                <td><strong>{item.name}</strong></td>
                <td>{categories.find((category) => category.id === item.categoryId)?.name ?? "—"}</td>
                <td>{money(item.price)}</td>
                <td>{item.addOns?.map((addon) => addon.name).join(", ") || "—"}</td>
                <td><span className="dashboard-status" data-status={item.isAvailable ? "DELIVERED" : "CANCELLED"}>{item.isAvailable ? "Available" : "Paused"}</span></td>
                <td><div className="dashboard-row-actions"><button className="dashboard-small-button" onClick={() => openItem(item)}><Edit2 size={13} /> Edit</button><button className="dashboard-small-button" disabled={saving} onClick={() => void runChange(() => api.menu.update(item.id, { isAvailable: !item.isAvailable }), item.isAvailable ? "Item paused." : "Item restored.")}><Power size={13} /> {item.isAvailable ? "Pause" : "Restore"}</button></div></td>
              </tr>
            ))}
            {!menuItems.length && <tr><td colSpan={6} className="dashboard-empty">Add your first menu item to get started.</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="dashboard-management-heading dashboard-management-divider" id="branches">
        <div><h3>Branch availability</h3><p>Pause or resume online ordering for a location.</p></div>
      </div>
      <div className="dashboard-branch-grid">
        {branches.map((branch) => <div className="dashboard-branch" key={branch.id}><strong>{branch.name}</strong><span><i className={`dashboard-live-dot${branch.acceptingOrders ? "" : " is-paused"}`} />{branch.acceptingOrders ? "Accepting orders" : "Orders paused"}</span><button className="dashboard-small-button" disabled={saving} onClick={() => void runChange(() => api.branches.update(branch.id, { acceptingOrders: !branch.acceptingOrders }), branch.acceptingOrders ? "Branch orders paused." : "Branch is accepting orders.")}><Power size={13} /> {branch.acceptingOrders ? "Pause orders" : "Resume orders"}</button></div>)}
        {!branches.length && <div className="dashboard-empty">No active branches.</div>}
      </div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="dashboard-field"><span>{label}</span>{children}</label>;
}