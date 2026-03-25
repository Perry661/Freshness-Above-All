(function initFreshTrackerPicFrozen(global) {
  const FROZEN_CATEGORIES = [
    {
      id: "frozen-dessert",
      label: "Frozen Dessert",
      items: [
        { name: "Ice Cream", variants: ["ice cream", "icecream"] },
        { name: "Gelato", variants: ["gelato"] },
        { name: "Sorbet", variants: ["sorbet"] },
        { name: "Frozen Yogurt", variants: ["frozen yogurt"] }
      ]
    },
    {
      id: "frozen-food",
      label: "Frozen Food",
      items: [
        { name: "Frozen Pizza", variants: ["frozen pizza"] },
        { name: "Frozen Dumplings", variants: ["frozen dumplings", "dumplings"] },
        { name: "Frozen Fries", variants: ["frozen fries", "french fries", "fries"] }
      ]
    }
  ];

  const FROZEN_ITEMS = FROZEN_CATEGORIES.flatMap((category) =>
    category.items.map((item) => ({
      ...item,
      categoryId: category.id,
      categoryLabel: category.label
    }))
  );

  function normalizeFrozenOcrText(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/[|]/g, "l")
      .replace(/[®™]/g, " ")
      .replace(/\bicecream\b/g, "ice cream")
      .replace(/\bfrozenyogurt\b/g, "frozen yogurt")
      .replace(/\bfrozenpizza\b/g, "frozen pizza")
      .replace(/\bfrozendumplings\b/g, "frozen dumplings")
      .replace(/\bfrozenfries\b/g, "frozen fries")
      .replace(/[^\p{L}\p{N}\s'-]/gu, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function consumeFrozenMatch(value) {
    const text = ` ${normalizeFrozenOcrText(value)} `;
    if (!text.trim()) {
      return null;
    }

    let best = null;
    FROZEN_ITEMS.forEach((item) => {
      item.variants.forEach((variant) => {
        const normalizedVariant = normalizeFrozenOcrText(variant);
        const escapedVariant = normalizedVariant.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const pattern = new RegExp(`(^|[^\\p{L}\\p{N}])(${escapedVariant})(?=[^\\p{L}\\p{N}]|$)`, "u");
        const match = pattern.exec(text);
        if (!match) {
          return;
        }

        const prefix = match[1] || "";
        const matchedVariant = match[2] || normalizedVariant;
        const start = match.index + prefix.length;
        const end = start + matchedVariant.length;
        const remainingText = `${text.slice(0, start)} ${text.slice(end)}`
          .replace(/\s+/g, " ")
          .trim();
        const score = normalizedVariant.length;
        if (!best || score > best.score) {
          best = {
            matchedName: item.name,
            matchedVariant,
            remainingText,
            score
          };
        }
      });
    });

    return best ? {
      matchedName: best.matchedName,
      matchedVariant: best.matchedVariant,
      remainingText: best.remainingText
    } : null;
  }

  function extractFrozenName(normalizedText) {
    const matched = consumeFrozenMatch(normalizedText);
    return matched ? matched.matchedName : "";
  }

  function extractFrozenKeywordQuery(normalizedText) {
    return extractFrozenName(normalizedText);
  }

  global.FreshTrackerPicFrozen = {
    FROZEN_CATEGORIES,
    FROZEN_ITEMS,
    normalizeFrozenOcrText,
    consumeFrozenMatch,
    extractFrozenName,
    extractFrozenKeywordQuery
  };
})(window);
