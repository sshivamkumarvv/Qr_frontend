"use client";

import { useState, useEffect, useCallback } from "react";
import { storage, MenuItem, CartItem } from "@/lib/api";

export function useCart() {
  const [cart, setCartState] = useState<CartItem[]>([]);

  useEffect(() => {
    setCartState(storage.getCart());
  }, []);

  const setCart = useCallback((updater: CartItem[] | ((prev: CartItem[]) => CartItem[])) => {
    setCartState((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      storage.setCart(next);
      return next;
    });
  }, []);

  const addItem = useCallback(
    (item: MenuItem, portion?: string, specialInstructions?: string, addOnIds: string[] = []) => {
      setCart((prev) => {
        const itemPortion = portion || "Full";
        const selectedAddOnIds = [...addOnIds].sort();
        const idx = prev.findIndex(
          (c) =>
            c.item.id === item.id &&
            (c.portion || "Full") === itemPortion &&
            [...(c.addOnIds ?? [])].sort().join(",") === selectedAddOnIds.join(",")
        );
        const basePrice = item.dineInPrice ?? item.discountedPrice ?? item.price;
        const portionPrice =
          itemPortion.toLowerCase() === "half" ? Math.round(basePrice * 0.6) : basePrice;
        const addOnPrice = (item.addOns ?? [])
          .filter((addon) => selectedAddOnIds.includes(addon.id))
          .reduce((sum, addon) => sum + Number(addon.price), 0);
        const unitPrice = Number(portionPrice) + addOnPrice;

        if (idx >= 0) {
          const next = [...prev];
          next[idx] = {
            ...next[idx],
            quantity: next[idx].quantity + 1,
            specialInstructions: specialInstructions || next[idx].specialInstructions,
          };
          return next;
        }
        return [
          ...prev,
          {
            item,
            quantity: 1,
            portion: itemPortion,
            specialInstructions: specialInstructions || undefined,
            addOnIds: selectedAddOnIds,
            unitPrice,
          },
        ];
      });
    },
    [setCart]
  );

  const removeItem = useCallback(
    (itemId: string, portion?: string, addOnIds?: string[]) => {
      setCart((prev) => {
        const idx = prev.findIndex(
          (c) =>
            c.item.id === itemId &&
            (!portion || (c.portion || "Full") === portion) &&
            (addOnIds === undefined ||
              [...(c.addOnIds ?? [])].sort().join(",") === [...addOnIds].sort().join(","))
        );
        if (idx < 0) return prev;
        const next = [...prev];
        if (next[idx].quantity === 1) {
          next.splice(idx, 1);
        } else {
          next[idx] = { ...next[idx], quantity: next[idx].quantity - 1 };
        }
        return next;
      });
    },
    [setCart]
  );

  const getQty = useCallback(
    (itemId: string, portion?: string) => {
      if (portion) {
        return cart.find((c) => c.item.id === itemId && (c.portion || "Full") === portion)?.quantity ?? 0;
      }
      return cart
        .filter((c) => c.item.id === itemId)
        .reduce((sum, c) => sum + c.quantity, 0);
    },
    [cart]
  );

  const totalItems = cart.reduce((s, c) => s + c.quantity, 0);
  const totalPrice = cart.reduce((s, c) => {
    const itemPortion = c.portion || "Full";
    const basePrice = c.item.dineInPrice ?? c.item.discountedPrice ?? c.item.price;
    const price = c.unitPrice ?? (itemPortion.toLowerCase() === "half" ? Math.round(basePrice * 0.6) : basePrice);
    return s + price * c.quantity;
  }, 0);

  return { cart, addItem, removeItem, getQty, totalItems, totalPrice, setCart };
}
