(function initFreshTrackerPicFlavor(global) {
  const FLAVOR_CATEGORIES = [
    {
      id: "sweet",
      label: "Sweet Flavors",
      items: [
        { name: "Vanilla", variants: ["vanilla"] },
        { name: "Chocolate", variants: ["chocolate", "cocoa"] },
        { name: "Strawberry", variants: ["strawberry"] },
        { name: "Cookies & Cream", variants: ["cookies & cream", "cookies and cream"] },
        { name: "Caramel", variants: ["caramel"] },
        { name: "Mint Chocolate Chip", variants: ["mint chocolate chip"] },
        { name: "Mango", variants: ["mango"] },
        { name: "Blueberry", variants: ["blueberry"] },
        { name: "Matcha", variants: ["matcha", "green tea"] },
        { name: "Red Bean", variants: ["red bean", "adzuki", "azuki"] },
        { name: "Coffee", variants: ["coffee", "mocha"] },
        { name: "Berry Mix", variants: ["berry mix", "mixed berry", "mixed berries"] }
      ]
    },
    {
      id: "savory",
      label: "Savory Flavors",
      items: [
        { name: "Barbecue", variants: ["barbecue", "bbq"] },
        { name: "Spicy", variants: ["spicy", "chili", "chilli", "hot"] },
        { name: "Garlic", variants: ["garlic"] },
        { name: "Cheese", variants: ["cheese", "cheesy"] },
        { name: "Smoky", variants: ["smoky", "smoked"] },
        { name: "Herb", variants: ["herb", "herbal", "rosemary", "basil"] },
        { name: "Umami", variants: ["umami", "savory", "meaty"] }
      ]
    },
    {
      id: "drink",
      label: "Drink Flavors",
      items: [
        { name: "Cola", variants: ["cola"] },
        { name: "Lemon", variants: ["lemon"] },
        { name: "Fruit Punch", variants: ["fruit punch"] },
        { name: "Orange", variants: ["orange"] }
      ]
    }
  ];

  const FLAVOR_ITEMS = FLAVOR_CATEGORIES.flatMap((category) =>
    category.items.map((item) => ({
      ...item,
      categoryId: category.id,
      categoryLabel: category.label
    }))
  );

  function normalizeFlavorOcrText(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/[|]/g, "l")
      .replace(/[®™]/g, " ")
      .replace(/\bcookiesandcream\b/g, "cookies and cream")
      .replace(/\bmintchocolatechip\b/g, "mint chocolate chip")
      .replace(/\bfruitpunch\b/g, "fruit punch")
      .replace(/\bberrymix\b/g, "berry mix")
      .replace(/[^\p{L}\p{N}\s&'-]/gu, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function extractFlavorName(normalizedText) {
    const matched = consumeFlavorMatch(normalizedText);
    return matched ? matched.matchedName : "";
  }

  function extractFlavorKeywordQuery(normalizedText) {
    return extractFlavorName(normalizedText);
  }

  function consumeFlavorMatch(value) {
    const text = normalizeFlavorOcrText(value);
    if (!text.trim()) {
      return null;
    }

    let best = null;
    FLAVOR_ITEMS.forEach((item) => {
      item.variants.forEach((variant) => {
        const match = findBestPhraseMatch(text, variant, normalizeFlavorOcrText);
        if (!match) {
          return;
        }
        if (!best || match.score > best.score) {
          best = {
            matchedName: item.name,
            matchedVariant: match.matchedVariant,
            remainingText: match.remainingText,
            score: match.score
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

  global.FreshTrackerPicFlavor = {
    FLAVOR_CATEGORIES,
    FLAVOR_ITEMS,
    normalizeFlavorOcrText,
    consumeFlavorMatch,
    extractFlavorName,
    extractFlavorKeywordQuery
  };

  function findBestPhraseMatch(text, variant, normalizer) {
    const normalizedText = String(normalizer(text) || "").trim();
    const normalizedVariant = String(normalizer(variant) || "").trim();
    if (!normalizedText || !normalizedVariant) {
      return null;
    }

    const exact = findExactPhraseMatch(normalizedText, normalizedVariant);
    if (exact) {
      return { ...exact, score: normalizedVariant.length + 20 };
    }

    return findFuzzyPhraseMatch(normalizedText, normalizedVariant);
  }

  function findExactPhraseMatch(text, variant) {
    const padded = ` ${text} `;
    const escapedVariant = variant.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(`(^|[^\\p{L}\\p{N}])(${escapedVariant})(?=[^\\p{L}\\p{N}]|$)`, "u");
    const match = pattern.exec(padded);
    if (!match) {
      return null;
    }

    const prefix = match[1] || "";
    const matchedVariant = match[2] || variant;
    const start = match.index + prefix.length;
    const end = start + matchedVariant.length;
    const remainingText = `${padded.slice(0, start)} ${padded.slice(end)}`.replace(/\s+/g, " ").trim();
    return {
      matchedVariant,
      remainingText
    };
  }

  function findFuzzyPhraseMatch(text, variant) {
    const textTokens = text.split(/\s+/).filter(Boolean);
    const variantTokens = variant.split(/\s+/).filter(Boolean);
    if (!textTokens.length || !variantTokens.length) {
      return null;
    }

    const variantCompact = compactText(variant);
    const minWindow = Math.max(1, variantTokens.length - 1);
    const maxWindow = Math.min(textTokens.length, variantTokens.length + 1);
    let best = null;

    for (let size = minWindow; size <= maxWindow; size += 1) {
      for (let start = 0; start <= textTokens.length - size; start += 1) {
        const windowTokens = textTokens.slice(start, start + size);
        const windowText = windowTokens.join(" ");
        const distance = levenshteinDistance(compactText(windowText), variantCompact);
        const allowedDistance = getAllowedDistance(variantCompact.length);
        if (distance > allowedDistance) {
          continue;
        }

        const remainingText = [...textTokens.slice(0, start), ...textTokens.slice(start + size)].join(" ").trim();
        const score = variantCompact.length - distance * 2 - Math.abs(size - variantTokens.length);
        if (!best || score > best.score) {
          best = {
            matchedVariant: windowText,
            remainingText,
            score
          };
        }
      }
    }

    return best;
  }

  function compactText(value) {
    return String(value || "").replace(/[\s&'-]+/g, "");
  }

  function getAllowedDistance(length) {
    if (length <= 5) {
      return 1;
    }
    if (length <= 10) {
      return 2;
    }
    return 3;
  }

  function levenshteinDistance(a, b) {
    const rows = a.length + 1;
    const cols = b.length + 1;
    const matrix = Array.from({ length: rows }, () => Array(cols).fill(0));

    for (let row = 0; row < rows; row += 1) {
      matrix[row][0] = row;
    }
    for (let col = 0; col < cols; col += 1) {
      matrix[0][col] = col;
    }

    for (let row = 1; row < rows; row += 1) {
      for (let col = 1; col < cols; col += 1) {
        const cost = a[row - 1] === b[col - 1] ? 0 : 1;
        matrix[row][col] = Math.min(
          matrix[row - 1][col] + 1,
          matrix[row][col - 1] + 1,
          matrix[row - 1][col - 1] + cost
        );
      }
    }

    return matrix[rows - 1][cols - 1];
  }
})(window);
