(function initFreshTrackerPicMeat(global) {
  const MEAT_CATEGORIES = [
    {
      id: "fresh-meat",
      label: "Fresh Meat",
      items: [
        { name: "Pork", variants: ["pork"] },
        { name: "Beef", variants: ["beef"] },
        { name: "Chicken", variants: ["chicken"] },
        { name: "Lamb", variants: ["lamb"] },
        { name: "Mutton", variants: ["mutton"] },
        { name: "Duck", variants: ["duck"] },
        { name: "Turkey", variants: ["turkey"] },
        { name: "Goose", variants: ["goose"] },
        { name: "Rabbit", variants: ["rabbit"] },
        { name: "Venison", variants: ["venison"] },
        { name: "Horse Meat", variants: ["horse meat", "horsemeat"] }
      ]
    },
    {
      id: "processed-meat",
      label: "Processed Meat",
      items: [
        { name: "Sausage", variants: ["sausage", "sausages"] },
        { name: "Bacon", variants: ["bacon"] },
        { name: "Ham", variants: ["ham"] },
        { name: "Steak", variants: ["steak", "steaks"] },
        { name: "Ground Meat", variants: ["ground meat", "ground meats", "minced meat", "mince meat", "minced meats"] }
      ]
    }
  ];

  const MEAT_ITEMS = MEAT_CATEGORIES.flatMap((category) =>
    category.items.map((item) => ({
      ...item,
      categoryId: category.id,
      categoryLabel: category.label
    }))
  );

  function normalizeMeatOcrText(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/[|]/g, "l")
      .replace(/[®™]/g, " ")
      .replace(/\bch1cken\b/g, "chicken")
      .replace(/\bturk3y\b/g, "turkey")
      .replace(/\bsausage[s]?\b/g, "sausage")
      .replace(/\bbac0n\b/g, "bacon")
      .replace(/\bst3ak[s]?\b/g, "steak")
      .replace(/\bhorsemeat\b/g, "horse meat")
      .replace(/\bgroundmeat[s]?\b/g, "ground meat")
      .replace(/\bmincedmeat[s]?\b/g, "minced meat")
      .replace(/\bmincemeat[s]?\b/g, "minced meat")
      .replace(/[^\p{L}\p{N}\s'-]/gu, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function extractMeatName(normalizedText) {
    const text = ` ${String(normalizedText || "").toLowerCase()} `;
    if (!text.trim()) {
      return "";
    }

    const matched = MEAT_ITEMS.find((item) =>
      item.variants.some((variant) => text.includes(` ${variant.toLowerCase()} `))
    );

    return matched ? matched.name : "";
  }

  function extractMeatKeywordQuery(normalizedText) {
    return extractMeatName(normalizedText);
  }

  global.FreshTrackerPicMeat = {
    MEAT_CATEGORIES,
    MEAT_ITEMS,
    normalizeMeatOcrText,
    extractMeatName,
    extractMeatKeywordQuery
  };
})(window);
