import { MenuItem } from "@/lib/api";

// Height of the sticky search bar plus category pills nav, used as scroll-jump offset.
export const SCROLL_OFFSET = 96;

export const getCategoryIcon = (name: string) => {
  const n = name.toLowerCase();
  if (n.includes("all")) return "🍽️";
  if (n.includes("veg") || n.includes("salad")) return "🥦";
  if (n.includes("starter") || n.includes("snack") || n.includes("appetizer")) return "🥟";
  if (n.includes("main") || n.includes("curry") || n.includes("gravy")) return "🍛";
  if (n.includes("biryani") || n.includes("rice") || n.includes("pulao")) return "🍚";
  if (n.includes("bread") || n.includes("roti") || n.includes("naan")) return "🫓";
  if (n.includes("pizza")) return "🍕";
  if (n.includes("burger") || n.includes("sandwich")) return "🍔";
  if (n.includes("pasta") || n.includes("noodle") || n.includes("chinese")) return "🍜";
  if (n.includes("beverage") || n.includes("drink") || n.includes("juice") || n.includes("shake")) return "🍹";
  if (n.includes("tea") || n.includes("coffee") || n.includes("chai")) return "☕";
  if (n.includes("dessert") || n.includes("sweet") || n.includes("ice cream") || n.includes("cake")) return "🍰";
  if (n.includes("featured") || n.includes("special") || n.includes("popular") || n.includes("chef")) return "⭐";
  return "🍲";
};

/**
 * Determines whether an item has customization options (e.g. Half/Full portions,
 * cooking instructions, custom spice levels).
 * Prepared food dishes (curries, biryanis, starters, breads, pizzas, pastas, etc.)
 * are customizable.
 * Packaged beverages, bottled water, canned sodas, etc. are NOT customizable.
 */
export function isItemCustomizable(item: MenuItem): boolean {
  if (item.addOns?.length) return true;
  if (typeof (item as any).isCustomizable === "boolean") {
    return (item as any).isCustomizable;
  }
  const name = item.name.toLowerCase();
  const cat = (item.category?.name || "").toLowerCase();

  const nonCustomizableTerms = [
    "water",
    "mineral water",
    "coke",
    "coca cola",
    "pepsi",
    "sprite",
    "fanta",
    "limca",
    "thums up",
    "soda",
    "cold drink",
    "packaged",
    "can ",
    "bottle",
    "red bull",
    "juice box",
    "soft drink",
    "ready to drink",
  ];

  for (const term of nonCustomizableTerms) {
    if (name.includes(term) || cat.includes(term)) {
      return false;
    }
  }

  if (item.description) {
    const desc = item.description.toLowerCase();
    if (
      desc.includes("packaged") ||
      desc.includes("canned") ||
      desc.includes("sealed bottle") ||
      desc.includes("ready to drink")
    ) {
      return false;
    }
  }

  return true;
}

/**
 * Smart pairing logic — maps category keywords to complementary category keywords.
 * Falls back to featured items when no strong category match is found.
 */
export function getPairingLabel(item: MenuItem): string {
  const name = (item.category?.name ?? item.name).toLowerCase();
  if (/beverage|drink|juice|lassi|soda|water|tea|coffee|shake|smoothie/.test(name)) return "🍽️ Goes great with";
  if (/burger|sandwich|wrap|roll|sub/.test(name)) return "🥤 Add a drink?";
  if (/pizza|pasta|noodle|biryani|rice|meal|thali|main/.test(name)) return "🥗 Complete your meal";
  if (/starter|appetizer|snack|fry|tikka|kebab|wings/.test(name)) return "🍽️ Add a main course?";
  if (/dessert|sweet|ice.?cream|cake|brownie|halwa|kheer/.test(name)) return "☕ Finish with a drink?";
  return "✨ Pairs well with";
}

export function getPairingItems(triggerItem: MenuItem, allItems: MenuItem[], cartItemIds: string[]): MenuItem[] {
  const catName = (triggerItem.category?.name ?? "").toLowerCase();
  const itemName = triggerItem.name.toLowerCase();

  let preferredKeywords: string[] = [];
  if (/beverage|drink|juice|lassi|soda|water|tea|coffee|shake|smoothie/.test(catName + itemName)) {
    preferredKeywords = ["starter", "snack", "burger", "pizza", "main", "meal"];
  } else if (/starter|appetizer|snack|fry|tikka|kebab|wings/.test(catName + itemName)) {
    preferredKeywords = ["beverage", "drink", "main", "meal", "biryani", "rice"];
  } else if (/dessert|sweet|ice.?cream|cake|brownie/.test(catName + itemName)) {
    preferredKeywords = ["beverage", "drink", "coffee", "tea"];
  } else if (/main|meal|biryani|rice|thali|pasta|pizza|noodle/.test(catName + itemName)) {
    preferredKeywords = ["beverage", "drink", "dessert", "sweet", "bread", "roti", "naan", "starter"];
  } else {
    preferredKeywords = ["beverage", "drink", "dessert"];
  }

  const alreadyInCart = new Set([...cartItemIds, triggerItem.id]);

  const candidates = allItems.filter(
    (i) => i.isAvailable && !alreadyInCart.has(i.id) && i.categoryId !== triggerItem.categoryId
  );

  const scored = candidates.map((item) => {
    const itemCat = (item.category?.name ?? "").toLowerCase();
    const itemN = item.name.toLowerCase();
    let score = 0;
    preferredKeywords.forEach((kw, idx) => {
      if (itemCat.includes(kw) || itemN.includes(kw)) {
        score += (preferredKeywords.length - idx) * 10;
      }
    });
    if (item.isFeatured) score += 5;
    if (triggerItem.isVeg && item.isVeg) score += 3;
    return { item, score };
  });

  scored.sort((a, b) => b.score - a.score);

  const top = scored.slice(0, 8).map((x) => x.item);
  if (top.length === 0) {
    const fallbackNotCart = allItems.filter(
      (i) => i.isAvailable && !alreadyInCart.has(i.id)
    );
    if (fallbackNotCart.length > 0) {
      return fallbackNotCart.slice(0, 6);
    }
    return allItems
      .filter((i) => i.isAvailable && i.id !== triggerItem.id)
      .slice(0, 6);
  }
  return top;
}
