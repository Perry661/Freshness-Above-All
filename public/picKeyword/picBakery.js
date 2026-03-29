(function initFreshTrackerPicBakery(global) {
  const BAKERY_CATEGORIES = [
    {
      id: "bread",
      label: "Bread",
      items: [
        { name: "Bread", variants: ["bread", "loaf"] },
        { name: "Toast", variants: ["toast"] },
        { name: "Bun", variants: ["bun", "buns"] },
        { name: "Bagel", variants: ["bagel", "bagels"] },
        { name: "Baguette", variants: ["baguette", "baguettes"] },
        { name: "Croissant", variants: ["croissant", "croissants"] },
        { name: "Muffin", variants: ["muffin", "muffins"] }
      ]
    },
    {
      id: "cake",
      label: "Cake and Pastry",
      items: [
        { name: "Cake", variants: ["cake", "cakes"] },
        { name: "Cupcake", variants: ["cupcake", "cupcakes"] },
        { name: "Cheesecake", variants: ["cheesecake", "cheesecakes"] },
        { name: "Swiss Roll", variants: ["swiss roll", "cake roll"] },
        { name: "Sponge Cake", variants: ["sponge cake"] },
        { name: "Pound Cake", variants: ["pound cake"] },
        { name: "Red Bean Cake", variants: ["red bean cake", "redbean cake"] },
        { name: "Matcha Cake", variants: ["matcha cake", "matcha red bean cake"] }
      ]
    },
    {
      id: "pastry",
      label: "Pastry",
      items: [
        { name: "Pastry", variants: ["pastry", "pastries"] },
        { name: "Danish", variants: ["danish", "danishes"] },
        { name: "Tart", variants: ["tart", "tarts"] },
        { name: "Pie", variants: ["pie", "pies"] },
        { name: "Donut", variants: ["donut", "donuts", "doughnut", "doughnuts"] },
        { name: "Cookie", variants: ["cookie", "cookies", "biscuit", "biscuits"] }
      ]
    }
  ];

  const BAKERY_ITEMS = BAKERY_CATEGORIES.flatMap((category) =>
    category.items.map((item) => ({
      ...item,
      categoryId: category.id,
      categoryLabel: category.label
    }))
  );

  function normalizeBakeryOcrText(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/[|]/g, "l")
      .replace(/[®™]/g, " ")
      .replace(/\bcroissart\b/g, "croissant")
      .replace(/\bmuffln\b/g, "muffin")
      .replace(/\bbage1\b/g, "bagel")
      .replace(/\bcheesecak[e]?\b/g, "cheesecake")
      .replace(/\bswissroll\b/g, "swiss roll")
      .replace(/\bcakeroll\b/g, "cake roll")
      .replace(/\bredbeancake\b/g, "red bean cake")
      .replace(/\bmatchacake\b/g, "matcha cake")
      .replace(/\bmatcharedbeancake\b/g, "matcha red bean cake")
      .replace(/\bdoughnut[s]?\b/g, "donut")
      .replace(/[^\p{L}\p{N}\s'-]/gu, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function extractBakeryName(normalizedText) {
    const matched = consumeBakeryMatch(normalizedText);
    return matched ? matched.matchedName : "";
  }

  function extractBakeryKeywordQuery(normalizedText) {
    return extractBakeryName(normalizedText);
  }

  function consumeBakeryMatch(value) {
    const text = normalizeBakeryOcrText(value);
    if (!text.trim()) {
      return null;
    }

    let best = null;
    BAKERY_ITEMS.forEach((item) => {
      item.variants.forEach((variant) => {
        const match = findBestPhraseMatch(text, variant, normalizeBakeryOcrText);
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

  global.FreshTrackerPicBakery = {
    BAKERY_CATEGORIES,
    BAKERY_ITEMS,
    normalizeBakeryOcrText,
    consumeBakeryMatch,
    extractBakeryName,
    extractBakeryKeywordQuery
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
    return String(value || "").replace(/[\s'-]+/g, "");
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
