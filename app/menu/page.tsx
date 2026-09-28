"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api, storage, MenuItem } from "@/lib/api";
import { useCart } from "@/lib/useCart";
import { SCROLL_OFFSET, isItemCustomizable } from "./components/menuUtils";
import { MenuHeader } from "./components/MenuHeader";
import { CategoryNav } from "./components/CategoryNav";
import { MenuCard } from "./components/MenuCard";
import { InlinePairingStrip } from "./components/InlinePairingStrip";
import { BottomDock } from "./components/BottomDock";
import { ItemDetailSheet } from "./components/ItemDetailSheet";
import { CartSheet } from "./components/CartSheet";
import { SkeletonList } from "./components/SkeletonList";

export default function MenuPage() {
  const router = useRouter();
  const { cart, addItem, removeItem, getQty, totalItems, totalPrice, setCart } = useCart();

  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("ALL");
  const [jumpedCat, setJumpedCat] = useState<string | null>(null);
  const [showCart, setShowCart] = useState(false);
  const [showQuickCart, setShowQuickCart] = useState(false);
  const [showCategoryMenu, setShowCategoryMenu] = useState(false);
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null);
  const [pairingItem, setPairingItem] = useState<MenuItem | null>(null);
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [user, setUser] = useState<{ fullName: string } | null>(null);
  const [cartBump, setCartBump] = useState(false);

  // Always null on SSR; set client-side in useEffect to avoid hydration mismatch
  const [tableInfo, setTableInfo] = useState<ReturnType<typeof storage.getTableInfo>>(null);
  const toastRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const jumpRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const catPillRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const prevTotalItems = useRef(0);
  const activeCategoryRef = useRef<string>("ALL");
  const isModalOpenRef = useRef(false);

  useEffect(() => {
    const auth = storage.getAuth();
    if (auth) {
      setUser(auth.user);
    }

    const info = storage.getTableInfo();
    if (!info) {
      // Check if session has token or use dev default table
      const storedToken = typeof window !== "undefined" ? sessionStorage.getItem("qrToken") : null;
      const token = storedToken || "2374384b7a6b94d88a87437d0200511b";

      api.tables
        .resolve(token)
        .then((res) => {
          if (typeof window !== "undefined") {
            sessionStorage.setItem("qrToken", res.qrToken || token);
            localStorage.setItem("qrToken", res.qrToken || token);
          }
          storage.setTableInfo(res);
          setTableInfo(res);
          return api.menu.list(res.restaurantId, res.branchId);
        })
        .then(setItems)
        .catch(() => {
          const fallback = {
            tableId: "e3046ca3-dfc8-47cb-b047-a54d8b9ed0b9",
            tableNumber: "T1",
            branchId: "ac3454c5-03f2-4015-b6ef-2e80aa3b9bc2",
            branchName: "Koramangala",
            restaurantId: "68e85e16-9389-4628-a0ef-fdddff815016",
            isWithinRange: true,
            distanceMeters: 20,
            qrToken: "2374384b7a6b94d88a87437d0200511b",
          };
          storage.setTableInfo(fallback);
          setTableInfo(fallback);
          return api.menu.list(fallback.restaurantId, fallback.branchId).then(setItems);
        })
        .catch((e) => setError(e.message))
        .finally(() => setLoading(false));
      return;
    }

    setTableInfo(info);

    api.menu
      .list(info.restaurantId, info.branchId)
      .then(setItems)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [router]);

  // Keep active category pill centered in the horizontal strip
  useEffect(() => {
    const pill = catPillRefs.current[activeCategory];
    if (pill) {
      pill.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    }
  }, [activeCategory]);

  // Bump the cart badge with a little pop whenever the item count changes
  useEffect(() => {
    if (totalItems !== prevTotalItems.current) {
      setCartBump(true);
      const t = setTimeout(() => setCartBump(false), 260);
      prevTotalItems.current = totalItems;
      return () => clearTimeout(t);
    }
  }, [totalItems]);

  // Keep ref in sync so the scroll handler always sees fresh value
  useEffect(() => {
    activeCategoryRef.current = activeCategory;
  }, [activeCategory]);

  useEffect(() => {
    isModalOpenRef.current = !!(selectedItem || showCart);
  }, [selectedItem, showCart]);

  // Scroll-spy: highlight whichever category section is at the top of the viewport
  useEffect(() => {
    function onScroll() {
      if (isModalOpenRef.current) return;

      const filterActive =
        activeCategoryRef.current === "VEG" || activeCategoryRef.current === "FEATURED";
      if (!filterActive) {
        const offset = SCROLL_OFFSET + 24;
        let current: string | null = null;
        for (const [catId, el] of Object.entries(sectionRefs.current)) {
          if (!el) continue;
          if (el.getBoundingClientRect().top <= offset) {
            current = catId;
          }
        }
        if (current && current !== activeCategoryRef.current) {
          setActiveCategory(current);
        }
      }
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const showToast = (msg: string, type = "info") => {
    setToast({ msg, type });
    if (toastRef.current) clearTimeout(toastRef.current);
    toastRef.current = setTimeout(() => setToast(null), 2500);
  };

  const handleAdd = (item: MenuItem, portion?: string, instructions?: string, addOnIds?: string[]) => {
    addItem(item, portion, instructions, addOnIds);
    showToast(`${item.name}${portion ? ` (${portion})` : ""} added!`, "success");
    setPairingItem(item);
  };

  const handleItemClick = (item: MenuItem) => {
    setPairingItem(item);
    if (isItemCustomizable(item)) {
      setSelectedItem(item);
    } else {
      handleAdd(item);
    }
  };

  const categories = [
    { id: "ALL", name: "All Items" },
    { id: "FEATURED", name: "⭐ Featured" },
    { id: "VEG", name: "🥦 Veg" },
    ...Array.from(
      new Map(
        items
          .filter((i) => i.category)
          .map((i) => [i.categoryId, { id: i.categoryId!, name: i.category!.name }])
      ).values()
    ),
  ];

  const isRealFilter = activeCategory === "VEG" || activeCategory === "FEATURED";

  const filtered = items.filter((item) => {
    if (!item.isAvailable) return false;
    const matchSearch =
      !search || item.name.toLowerCase().includes(search.toLowerCase());
    const matchCat =
      !isRealFilter ||
      (activeCategory === "VEG" && item.isVeg) ||
      (activeCategory === "FEATURED" && item.isFeatured);
    return matchSearch && matchCat;
  });

  const activeCategoryName = categories.find((c) => c.id === activeCategory)?.name ?? "All Items";

  function selectCategory(catId: string) {
    setShowCategoryMenu(false);

    if (catId === "ALL" || catId === "VEG" || catId === "FEATURED") {
      setActiveCategory(catId);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    // Real category: jump there and give it a soft highlight
    setActiveCategory(catId);
    const el = sectionRefs.current[catId];
    if (el) {
      const top = el.getBoundingClientRect().top + window.scrollY - SCROLL_OFFSET;
      window.scrollTo({ top, behavior: "smooth" });
    }
    setJumpedCat(catId);
    if (jumpRef.current) clearTimeout(jumpRef.current);
    jumpRef.current = setTimeout(() => setJumpedCat(null), 1400);
  }

  return (
    <>
      <style>{`
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes popIn { 0% { transform: scale(0.85); opacity: 0; } 60% { transform: scale(1.05); } 100% { transform: scale(1); opacity: 1; } }
        @keyframes badgePop { 0% { transform: scale(1); } 40% { transform: scale(1.28); } 100% { transform: scale(1); } }
        @keyframes glowFlash { 0%, 100% { box-shadow: 0 0 0 0 rgba(255,107,43,0); } 25% { box-shadow: 0 0 0 3px rgba(255,107,43,0.35); } }
        @keyframes pulseGlow { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.5; transform: scale(0.85); } }
        @keyframes slideUp { from { transform: translateY(16px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes slideUpSheet { from { transform: translateY(100%); } to { transform: translateY(0); } }
        @keyframes fadeInBackdrop { from { opacity: 0; } to { opacity: 1; } }
        .anim-fade-up { animation: fadeInUp 0.35s ease both; }
        .anim-pop { animation: popIn 0.28s cubic-bezier(0.34,1.56,0.64,1) both; }
        .anim-badge-pop { animation: badgePop 0.26s ease; }
        .anim-glow-flash { animation: glowFlash 1.4s ease; }
        .item-sheet { animation: slideUpSheet 0.36s cubic-bezier(0.32,0.72,0,1) both; }
        .item-sheet-backdrop { animation: fadeInBackdrop 0.25s ease both; }
        .menu-item-card { transition: transform 0.15s ease, background 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease; cursor: pointer; }
        .menu-item-card:active { transform: scale(0.99); }
        .tap-scale { transition: transform 0.12s ease; }
        .tap-scale:active { transform: scale(0.92); }
        .dock-btn { transition: transform 0.15s ease, background 0.2s ease, box-shadow 0.2s ease; }
        .dock-btn:active { transform: scale(0.96); }
        .cat-sticky-btn { transition: transform 0.12s ease, border-color 0.2s ease; }
        .cat-sticky-btn:active { transform: scale(0.985); }
      `}</style>

      <div
        style={{
          minHeight: "100dvh",
          background: "var(--bg-primary)",
          paddingBottom: "120px",
        }}
      >
        {/* Sticky header with restaurant info banner + search + category nav */}
        <MenuHeader
          tableInfo={tableInfo}
          search={search}
          setSearch={setSearch}
          showOptionsMenu={showOptionsMenu}
          setShowOptionsMenu={setShowOptionsMenu}
          user={user}
        >
          <CategoryNav
            categories={categories}
            activeCategory={activeCategory}
            selectCategory={selectCategory}
            catPillRefs={catPillRefs}
          />
        </MenuHeader>

        {/* Content list */}
        <div style={{ maxWidth: "640px", margin: "0 auto", padding: "12px 16px" }}>
          {isRealFilter && (
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
              <span
                className="anim-pop"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "5px 12px",
                  borderRadius: "100px",
                  background: "rgba(255,107,43,0.12)",
                  border: "1px solid rgba(255,107,43,0.3)",
                  color: "var(--accent)",
                  fontSize: "0.78rem",
                  fontWeight: 600,
                }}
              >
                {activeCategoryName}
                <button
                  onClick={() => setActiveCategory("ALL")}
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--accent)",
                    cursor: "pointer",
                    padding: "0",
                    fontSize: "0.85rem",
                    lineHeight: 1,
                    marginLeft: "2px",
                  }}
                  aria-label="Clear category filter"
                >
                  ✕
                </button>
              </span>
              <span style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>
                {filtered.length} item{filtered.length !== 1 ? "s" : ""}
              </span>
            </div>
          )}

          {loading && <SkeletonList />}

          {error && (
            <div
              style={{
                padding: "20px",
                borderRadius: "16px",
                background: "rgba(239,68,68,0.08)",
                border: "1px solid rgba(239,68,68,0.2)",
                color: "#ef4444",
                textAlign: "center",
              }}
            >
              {error}
            </div>
          )}

          {!loading && !error && filtered.length === 0 && (
            <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--text-muted)" }}>
              <div style={{ fontSize: "40px", marginBottom: "12px" }}>🔍</div>
              <p>No items found</p>
            </div>
          )}

          {!loading && (() => {
            // Group filtered items by category, preserving order
            const groups: { catId: string; catName: string; items: typeof filtered }[] = [];
            const seenCat = new Map<string, number>();
            let autoIdx = 0;
            for (const item of filtered) {
              const catId = item.categoryId ?? "__none__";
              const catName = item.category?.name ?? "";
              if (!seenCat.has(catId)) {
                seenCat.set(catId, groups.length);
                groups.push({ catId, catName, items: [] });
              }
              groups[seenCat.get(catId)!].items.push(item);
            }

            return (
              <>
                {groups.map((group) => (
                  <div
                    key={group.catId}
                    ref={(el) => { sectionRefs.current[group.catId] = el; }}
                    className={jumpedCat === group.catId ? "anim-glow-flash" : ""}
                    style={{
                      scrollMarginTop: `${SCROLL_OFFSET}px`,
                      marginBottom: "20px",
                    }}
                  >
                    {/* Category section title */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "16px 0 8px",
                        borderBottom: "1px solid rgba(255,255,255,0.06)",
                        marginBottom: "4px",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span
                          style={{
                            width: "4px",
                            height: "18px",
                            borderRadius: "2px",
                            background: "linear-gradient(to bottom, #ff6b2b, #ff9a3c)",
                          }}
                        />
                        <h2
                          style={{
                            fontSize: "1.05rem",
                            fontWeight: 800,
                            margin: 0,
                            color: "var(--text-primary)",
                            letterSpacing: "-0.01em",
                          }}
                        >
                          {group.catName || "Menu Items"}
                        </h2>
                      </div>
                      <span
                        style={{
                          fontSize: "0.72rem",
                          color: "var(--text-muted)",
                          fontWeight: 600,
                          background: "rgba(255,255,255,0.05)",
                          padding: "2px 8px",
                          borderRadius: "100px",
                        }}
                      >
                        {group.items.length} {group.items.length === 1 ? "item" : "items"}
                      </span>
                    </div>

                    {/* Items in this category */}
                    <div style={{ display: "flex", flexDirection: "column" }}>
                      {group.items.map((item, idx) => {
                        const delay = Math.min(autoIdx++ * 0.03, 0.24);
                        const isPairingOpen = pairingItem?.id === item.id;
                        return (
                          <React.Fragment key={item.id}>
                            {idx > 0 && (
                              <div
                                style={{
                                  height: "1px",
                                  background: "var(--border)",
                                  margin: "0",
                                  opacity: 0.5,
                                }}
                              />
                            )}
                            <div style={{ position: "relative" }}>
                              <MenuCard
                                item={item}
                                qty={getQty(item.id)}
                                onAdd={() => {
                                  setPairingItem(item);
                                  if (isItemCustomizable(item)) {
                                    setSelectedItem(item);
                                  } else {
                                    handleAdd(item);
                                  }
                                }}
                                onRemove={() => removeItem(item.id)}
                                onOpenSheet={() => handleItemClick(item)}
                                onCardClick={() => handleItemClick(item)}
                                isSelected={isPairingOpen}
                                delay={delay}
                              />
                              {isPairingOpen && (
                                <div style={{ margin: "2px 0 12px" }}>
                                  <InlinePairingStrip
                                    triggerItem={pairingItem}
                                    allItems={items}
                                    cartItemIds={cart.map((c) => c.item.id)}
                                    onAdd={(p) => {
                                      addItem(p);
                                      showToast(`${p.name} added!`, "success");
                                    }}
                                    onDismiss={() => setPairingItem(null)}
                                  />
                                </div>
                              )}
                            </div>
                          </React.Fragment>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </>
            );
          })()}
        </div>
      </div>

      {/* Unified Bottom Dock */}
      <BottomDock
        totalItems={totalItems}
        totalPrice={totalPrice}
        tableInfo={tableInfo}
        cartBump={cartBump}
        showCategoryMenu={showCategoryMenu}
        setShowCategoryMenu={setShowCategoryMenu}
        categories={categories}
        activeCategory={activeCategory}
        selectCategory={selectCategory}
        isRealFilter={isRealFilter}
        items={items}
      />

      {/* Item Detail Sheet (Customization only - no recommended items inside) */}
      {selectedItem && (
        <ItemDetailSheet
          key={selectedItem.id}
          item={selectedItem}
          qty={getQty(selectedItem.id)}
          onAdd={(portion, instructions, addOnIds) => handleAdd(selectedItem, portion, instructions, addOnIds)}
          onRemove={(portion) => removeItem(selectedItem.id, portion)}
          onClose={() => setSelectedItem(null)}
        />
      )}

      {/* Quick Cart popover for larger screens */}
      {showQuickCart && (
        <div
          className="anim-fade-up"
          style={{
            position: "fixed",
            right: 12,
            bottom: 140,
            zIndex: 60,
            width: 360,
            maxWidth: "calc(100% - 24px)",
            borderRadius: 14,
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
            boxShadow: "0 12px 40px rgba(0,0,0,0.6)",
            overflow: "hidden",
          }}
        >
          <div style={{ padding: 12, borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <strong>Your cart</strong>
            <button onClick={() => setShowQuickCart(false)} style={{ border: "none", background: "none", color: "var(--text-muted)", cursor: "pointer" }} aria-label="Close quick cart">✕</button>
          </div>
          <div style={{ maxHeight: 260, overflow: "auto", padding: 12 }}>
            {cart.length === 0 ? (
              <div style={{ color: "var(--text-muted)", padding: 12 }}>Your cart is empty</div>
            ) : (
              cart.map((c) => (
                <div key={`${c.item.id}-${c.portion}-${(c.addOnIds ?? []).join("-")}`} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "8px 0", alignItems: "center" }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700 }}>{c.item.name}</div>
                    <div style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>₹{c.unitPrice ?? (c.item.dineInPrice ?? c.item.discountedPrice ?? c.item.price)} × {c.quantity}</div>
                  </div>
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <button className="qty-btn tap-scale" onClick={() => { removeItem(c.item.id, c.portion, c.addOnIds); }} aria-label={`Remove one ${c.item.name}`}>−</button>
                    <div style={{ minWidth: 20, textAlign: "center", fontWeight: 700 }}>{c.quantity}</div>
                    <button className="qty-btn tap-scale" onClick={() => { addItem(c.item, c.portion, c.specialInstructions, c.addOnIds); }} aria-label={`Add one ${c.item.name}`}>+</button>
                  </div>
                </div>
              ))
            )}
          </div>
          <div style={{ padding: 12, borderTop: "1px solid var(--border)", display: "flex", justifyContent: "space-between", gap: 12 }}>
            <div>
              <div style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>Subtotal</div>
              <div style={{ fontWeight: 800 }}>₹{totalPrice.toFixed(0)}</div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn-ghost tap-scale" onClick={() => { setShowQuickCart(false); router.push("/checkout"); }}>Open</button>
              <button className="btn-accent tap-scale" onClick={() => { setShowQuickCart(false); router.push("/checkout"); }}>Checkout</button>
            </div>
          </div>
        </div>
      )}

      {/* Cart Sheet */}
      {showCart && (
        <CartSheet
          cart={cart}
          totalItems={totalItems}
          totalPrice={totalPrice}
          tableInfo={tableInfo!}
          user={user}
          setUser={(u) => setUser(u)}
          onClose={() => setShowCart(false)}
          onAdd={(item, portion, instructions, addOnIds) => addItem(item, portion, instructions, addOnIds)}
          onRemove={removeItem}
          setCart={setCart}
          showToast={showToast}
          allItems={items}
        />
      )}

      {/* Toast */}
      {toast && <div className={`toast toast-${toast.type} anim-pop`}>{toast.msg}</div>}
    </>
  );
}