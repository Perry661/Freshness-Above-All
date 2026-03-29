(function initFreshTrackerPicDessert(global) {
  const DESSERT_CATEGORIES = [
    {
      id: "pudding",
      label: "Pudding and Custard",
      items: [
        { name: "Pudding", variants: ["pudding"] },
        { name: "Custard", variants: ["custard"] },
        { name: "Flan", variants: ["flan"] }
      ]
    },
    {
      id: "jelly",
      label: "Jelly and Mousse",
      items: [
        { name: "Jelly", variants: ["jelly", "jello"] },
        { name: "Mousse", variants: ["mousse"] }
      ]
    }
  ];

  const DESSERT_ITEMS = DESSERT_CATEGORIES.flatMap((category) =>
    category.items.map((item) => ({
      ...item,
      categoryId: category.id,
      categoryLabel: category.label
    }))
  );

  function normalizeDessertOcrText(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/[|]/g, "l")
      .replace(/[®™]/g, " ")
      .replace(/[^\p{L}\p{N}\s'-]/gu, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function consumeDessertMatch(value) {
    const text = ` ${normalizeDessertOcrText(value)} `;
    if (!text.trim()) {
      return null;
    }

    let best = null;
    DESSERT_ITEMS.forEach((item) => {
      item.variants.forEach((variant) => {
        const normalizedVariant = normalizeDessertOcrText(variant);
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

  function extractDessertName(normalizedText) {
    const matched = consumeDessertMatch(normalizedText);
    return matched ? matched.matchedName : "";
  }

  function extractDessertKeywordQuery(normalizedText) {
    return extractDessertName(normalizedText);
  }

  global.FreshTrackerPicDessert = {
    DESSERT_CATEGORIES,
    DESSERT_ITEMS,
    normalizeDessertOcrText,
    consumeDessertMatch,
    extractDessertName,
    extractDessertKeywordQuery
  };
})(window);
