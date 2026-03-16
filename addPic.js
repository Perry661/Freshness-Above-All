(function initFreshTrackerAddPic(global) {
  const PACKAGED_BRANDS = [
    { variants: ["lays", "lays", "lay"], label: "Lay's" },
    { variants: ["doritos", "dorito"], label: "Doritos" },
    { variants: ["cheetos", "cheeto"], label: "Cheetos" },
    { variants: ["ruffles", "ruffle"], label: "Ruffles" },
    { variants: ["pringles", "pringle"], label: "Pringles" },
    { variants: ["ferrero", "rocher", "ferrerorocher"], label: "Ferrero Rocher" },
    { variants: ["horizon", "organic", "horizonorganic"], label: "Horizon Organic" },
    { variants: ["fairlife"], label: "Fairlife" },
    { variants: ["organicvalley", "valley"], label: "Organic Valley" },
    { variants: ["silk"], label: "Silk" },
    { variants: ["oatly"], label: "Oatly" },
    { variants: ["almondbreeze", "breeze"], label: "Almond Breeze" },
    { variants: ["hershey", "hersheys"], label: "Hershey's" },
    { variants: ["kitkat", "kit", "kat"], label: "KitKat" },
    { variants: ["snickers"], label: "Snickers" },
    { variants: ["twix"], label: "Twix" },
    { variants: ["mars"], label: "Mars" },
    { variants: ["milka"], label: "Milka" },
    { variants: ["lindt"], label: "Lindt" },
    { variants: ["cadbury"], label: "Cadbury" },
    { variants: ["toblerone"], label: "Toblerone" },
    { variants: ["cocacola", "coke", "coca"], label: "Coca-Cola" },
    { variants: ["pepsi"], label: "Pepsi" },
    { variants: ["sprite"], label: "Sprite" },
    { variants: ["fanta"], label: "Fanta" },
    { variants: ["gatorade"], label: "Gatorade" },
    { variants: ["powerade"], label: "Powerade" },
    { variants: ["monster"], label: "Monster" },
    { variants: ["redbull", "red", "bull"], label: "Red Bull" },
    { variants: ["drpepper", "pepper"], label: "Dr Pepper" },
    { variants: ["7up"], label: "7UP" },
    { variants: ["mountaindew", "dew"], label: "Mountain Dew" }
  ];

  const PACKAGED_DESCRIPTORS = [
    { pattern: /\bclassic\b/, label: "Classic" },
    { pattern: /\boriginal\b/, label: "Original" },
    { pattern: /\bbarbecue\b|\bbbq\b/, label: "Barbecue" },
    { pattern: /\bsour cream\b|\bsourcream\b/, label: "Sour Cream" },
    { pattern: /\bcheddar\b/, label: "Cheddar" },
    { pattern: /\bcheese\b/, label: "Cheese" },
    { pattern: /\bspicy\b/, label: "Spicy" },
    { pattern: /\bmilk\b/, label: "Milk" },
    { pattern: /\bwhole\b/, label: "Whole" },
    { pattern: /\blowfat\b|\blow fat\b/, label: "Low Fat" },
    { pattern: /\breduced fat\b|\breducedfat\b/, label: "Reduced Fat" },
    { pattern: /\b2%\b|\b2 percent\b/, label: "2%" },
    { pattern: /\b1%\b|\b1 percent\b/, label: "1%" },
    { pattern: /\bomega-?3\b/, label: "Omega-3" },
    { pattern: /\bdha\b/, label: "DHA" },
    { pattern: /\bdark\b/, label: "Dark" },
    { pattern: /\bwhite\b/, label: "White" },
    { pattern: /\bhazelnut\b/, label: "Hazelnut" },
    { pattern: /\balmond\b/, label: "Almond" },
    { pattern: /\bcaramel\b/, label: "Caramel" },
    { pattern: /\bpeanut\b/, label: "Peanut" },
    { pattern: /\bzero sugar\b|\bzerosugar\b/, label: "Zero Sugar" },
    { pattern: /\bdiet\b/, label: "Diet" },
    { pattern: /\blemon\b/, label: "Lemon" },
    { pattern: /\borange\b/, label: "Orange" },
    { pattern: /\bgrape\b/, label: "Grape" }
  ];

  const PACKAGED_PRODUCT_TYPES = [
    { pattern: /\bpotato chips\b|\bpotatochip[s]?\b|\bpotatoes\b/, label: "Potato Chips" },
    { pattern: /\bchips\b/, label: "Chips" },
    { pattern: /\bcrisps\b/, label: "Chips" },
    { pattern: /\bchocolate bar\b|\bchocolatebar\b/, label: "Chocolate Bar" },
    { pattern: /\bchocolate\b/, label: "Chocolate" },
    { pattern: /\bcandy\b/, label: "Candy" },
    { pattern: /\bmilk\b/, label: "Milk" },
    { pattern: /\bdairy milk\b|\bdairymilk\b/, label: "Milk" },
    { pattern: /\bsoda\b/, label: "Soda" },
    { pattern: /\bcola\b/, label: "Cola" },
    { pattern: /\benergy drink\b|\benergydrink\b/, label: "Energy Drink" },
    { pattern: /\bsparkling water\b|\bsparklingwater\b/, label: "Sparkling Water" },
    { pattern: /\bwater\b/, label: "Water" },
    { pattern: /\bjuice\b/, label: "Juice" },
    { pattern: /\btea\b/, label: "Tea" }
  ];

  function normalizeOcrText(value) {
    return String(value || "")
      .replace(/[|]/g, "I")
      .replace(/[®™]/g, " ")
      .replace(/\bclossic\b/gi, "classic")
      .replace(/\bc|assic\b/gi, "classic")
      .replace(/\bclqssic\b/gi, "classic")
      .replace(/\bpototo\b/gi, "potato")
      .replace(/\bpototoes\b/gi, "potatoes")
      .replace(/\broraroes\b/gi, "potatoes")
      .replace(/\bporaroes\b/gi, "potatoes")
      .replace(/\bchlps\b/gi, "chips")
      .replace(/\bchps\b/gi, "chips")
      .replace(/\bchip5\b/gi, "chips")
      .replace(/\blay s\b/gi, "lays")
      .replace(/\blay's\b/gi, "lays")
      .replace(/\bseal\b/gi, "lays")
      .replace(/\br ys\b/gi, "lays")
      .replace(/\brys\b/gi, "lays")
      .replace(/\bdr pepper\b/gi, "drpepper")
      .replace(/\bcoca cola\b/gi, "cocacola")
      .replace(/\bpepsi cola\b/gi, "pepsi")
      .replace(/\bferrera\b/gi, "ferrero")
      .replace(/\bferrerc\b/gi, "ferrero")
      .replace(/\brochar\b/gi, "rocher")
      .replace(/\brochet\b/gi, "rocher")
      .replace(/\bhorlzon\b/gi, "horizon")
      .replace(/\bhorizan\b/gi, "horizon")
      .replace(/\borganlc\b/gi, "organic")
      .replace(/\borgamc\b/gi, "organic")
      .replace(/\bomgea\b/gi, "omega")
      .replace(/\bdh4\b/gi, "dha")
      .replace(/\bhazeinut\b/gi, "hazelnut")
      .replace(/\bhazelrut\b/gi, "hazelnut")
      .replace(/\bchacolate\b/gi, "chocolate")
      .replace(/\bchocalate\b/gi, "chocolate")
      .replace(/[^\w\s'-]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function extractPackagedFoodName(normalizedText) {
    const text = ` ${String(normalizedText || "").toLowerCase()} `;
    if (!text.trim()) {
      return "";
    }

    const matchedBrand = detectPackagedBrand(text);
    if (!matchedBrand) {
      return "";
    }

    const matchedDescriptor = PACKAGED_DESCRIPTORS.find((entry) => entry.pattern.test(text));
    const matchedType = PACKAGED_PRODUCT_TYPES.find((entry) => entry.pattern.test(text));

    if (matchedBrand.label === "Lay's") {
      if (matchedDescriptor?.label === "Classic") {
        return "Lay's Classic Potato Chips";
      }
      if (matchedType?.label === "Potato Chips") {
        return `Lay's ${matchedDescriptor?.label ? `${matchedDescriptor.label} ` : ""}Potato Chips`.trim();
      }
    }

    if (matchedBrand.label === "Ferrero Rocher") {
      const chocolateType = matchedType?.label === "Chocolate Bar" || matchedType?.label === "Chocolate"
        ? matchedType.label
        : "Chocolate";
      if (matchedDescriptor?.label === "Hazelnut") {
        return `Ferrero Rocher Hazelnut ${chocolateType}`.trim();
      }
      if (matchedDescriptor?.label === "Milk") {
        return `Ferrero Rocher Milk ${chocolateType}`.trim();
      }
      return `Ferrero Rocher ${chocolateType}`.trim();
    }

    if (matchedBrand.label === "Horizon Organic") {
      const dairyType = matchedType?.label === "Milk" ? "Milk" : "Milk";
      if (matchedDescriptor?.label === "DHA") {
        return `Horizon Organic DHA ${dairyType}`.trim();
      }
      if (matchedDescriptor?.label === "Omega-3") {
        return `Horizon Organic Omega-3 ${dairyType}`.trim();
      }
      if (matchedDescriptor?.label === "Whole" || matchedDescriptor?.label === "2%" || matchedDescriptor?.label === "1%" || matchedDescriptor?.label === "Low Fat" || matchedDescriptor?.label === "Reduced Fat") {
        return `Horizon Organic ${matchedDescriptor.label} ${dairyType}`.trim();
      }
      return `Horizon Organic ${dairyType}`.trim();
    }

    if (matchedDescriptor && matchedType) {
      return `${matchedBrand.label} ${matchedDescriptor.label} ${matchedType.label}`.trim();
    }

    if (matchedDescriptor) {
      return `${matchedBrand.label} ${matchedDescriptor.label}`.trim();
    }

    if (matchedType) {
      return `${matchedBrand.label} ${matchedType.label}`.trim();
    }

    return matchedBrand.label;
  }

  function extractPackagedFoodKeywordQuery(normalizedText) {
    const text = ` ${String(normalizedText || "").toLowerCase()} `;
    const matchedBrand = detectPackagedBrand(text);
    const matchedDescriptor = PACKAGED_DESCRIPTORS.find((entry) => entry.pattern.test(text));
    const matchedType = PACKAGED_PRODUCT_TYPES.find((entry) => entry.pattern.test(text));

    if (matchedBrand && matchedDescriptor && matchedType) {
      return `${matchedBrand.label} ${matchedDescriptor.label} ${matchedType.label}`;
    }

    if (matchedBrand?.label === "Ferrero Rocher" && matchedDescriptor) {
      return `${matchedBrand.label} ${matchedDescriptor.label} Chocolate`;
    }

    if (matchedBrand?.label === "Horizon Organic" && matchedDescriptor) {
      return `${matchedBrand.label} ${matchedDescriptor.label} Milk`;
    }

    if (matchedBrand && matchedType) {
      return `${matchedBrand.label} ${matchedType.label}`;
    }

    if (matchedDescriptor && matchedType) {
      return `${matchedDescriptor.label} ${matchedType.label}`;
    }

    if (matchedBrand && matchedDescriptor) {
      return `${matchedBrand.label} ${matchedDescriptor.label}`;
    }

    if (matchedBrand) {
      return matchedBrand.label;
    }

    return matchedType?.label || "";
  }

  function detectPackagedBrand(text) {
    const lower = String(text || "").toLowerCase();
    const tokens = lower.replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean);

    const scored = PACKAGED_BRANDS.map((brand) => {
      const directHit = brand.variants.some((variant) => lower.includes(variant));
      const fuzzyHit = brand.variants.reduce((best, variant) => {
        return Math.max(best, ...tokens.map((token) => similarityScore(token, variant)));
      }, 0);

      return {
        label: brand.label,
        score: directHit ? 1 : fuzzyHit
      };
    }).sort((a, b) => b.score - a.score);

    if (!scored.length || scored[0].score < 0.72) {
      return null;
    }

    return scored[0];
  }

  function isLowQualityNameCandidate(value) {
    const text = String(value || "").trim();
    if (!text) {
      return true;
    }

    const words = text.split(/\s+/).filter(Boolean);
    const alphaOnly = text.replace(/[^a-z]/gi, "");
    if (words.length > 6) {
      return true;
    }
    if (/[()]/.test(text) || /\d/.test(text)) {
      return true;
    }
    if (/\b(snipaste|screenshot|image|photo|capture)\b/i.test(text)) {
      return true;
    }
    if (alphaOnly.length && !/[aeiou]/i.test(alphaOnly)) {
      return true;
    }

    return false;
  }

  function similarityScore(a, b) {
    const left = String(a || "");
    const right = String(b || "");
    if (!left || !right) {
      return 0;
    }

    if (left === right) {
      return 1;
    }

    const distance = levenshteinDistance(left, right);
    const maxLength = Math.max(left.length, right.length) || 1;
    return 1 - distance / maxLength;
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

  global.FreshTrackerAddPic = {
    normalizeOcrText,
    extractPackagedFoodName,
    extractPackagedFoodKeywordQuery,
    isLowQualityNameCandidate
  };
})(window);
