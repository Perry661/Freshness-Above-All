(function initFreshTrackerAddPic(global) {
  const PACKAGED_BRANDS = [
    { variants: ["lays", "lays", "lay"], label: "Lay's" },
    { variants: ["doritos", "dorito", "dorritos", "dorrito"], label: "Doritos" },
    { variants: ["cheetos", "cheeto"], label: "Cheetos" },
    { variants: ["ruffles", "ruffle"], label: "Ruffles" },
    { variants: ["pringles", "pringle"], label: "Pringles" },
    { variants: ["oreo"], label: "Oreo" },
    { variants: ["ferrero rocher", "ferrerorocher", "ferrero", "rocher"], label: "Ferrero Rocher" },
    { variants: ["horizon organic", "horizonorganic", "horizon"], label: "Horizon Organic" },
    { variants: ["fairlife"], label: "Fairlife" },
    { variants: ["organic valley", "organicvalley"], label: "Organic Valley" },
    { variants: ["silk"], label: "Silk" },
    { variants: ["oatly"], label: "Oatly" },
    { variants: ["almondbreeze", "breeze"], label: "Almond Breeze" },
    { variants: ["hershey", "hersheys"], label: "Hershey's" },
    { variants: ["kitkat", "kit kat"], label: "KitKat" },
    { variants: ["snickers"], label: "Snickers" },
    { variants: ["twix"], label: "Twix" },
    { variants: ["mms", "mm", "mnm", "mandm", "mandms"], label: "M&M's" },
    { variants: ["skittles", "skittle", "skitles"], label: "Skittles" },
    { variants: ["mars"], label: "Mars" },
    { variants: ["milka"], label: "Milka" },
    { variants: ["lindt"], label: "Lindt" },
    { variants: ["cadbury"], label: "Cadbury" },
    { variants: ["toblerone"], label: "Toblerone" },
    { variants: ["coca cola", "cocacola", "coke"], label: "Coca-Cola" },
    { variants: ["pepsi"], label: "Pepsi" },
    { variants: ["sprite"], label: "Sprite" },
    { variants: ["fanta"], label: "Fanta" },
    { variants: ["gatorade"], label: "Gatorade" },
    { variants: ["powerade"], label: "Powerade" },
    { variants: ["monster"], label: "Monster" },
    { variants: ["red bull", "redbull"], label: "Red Bull" },
    { variants: ["dr pepper", "drpepper"], label: "Dr Pepper" },
    { variants: ["7up"], label: "7UP" },
    { variants: ["mountain dew", "mountaindew"], label: "Mountain Dew" },
    { variants: ["旺旺", "旺仔", "wangwang", "wangzai"], label: "旺旺" },
    { variants: ["徐福记", "xufuji", "hsufuchi"], label: "徐福记" },
    { variants: ["盼盼", "panpan"], label: "盼盼" },
    { variants: ["卫龙", "weilong"], label: "卫龙" },
    { variants: ["洽洽", "qiaqia", "恰恰"], label: "洽洽" },
    { variants: ["劲仔", "jinzai"], label: "劲仔" },
    { variants: ["无穷", "无穷食品", "wuqiong"], label: "无穷食品" }
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
    { pattern: /\bgrape\b/, label: "Grape" },
    { pattern: /雪饼/, label: "雪饼" },
    { pattern: /仙贝/, label: "仙贝" },
    { pattern: /旺仔牛奶/, label: "旺仔牛奶" },
    { pattern: /辣条/, label: "辣条" },
    { pattern: /魔芋爽/, label: "魔芋爽" },
    { pattern: /卤蛋/, label: "卤蛋" },
    { pattern: /小鱼干/, label: "小鱼干" }
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
    { pattern: /\btea\b/, label: "Tea" },
    { pattern: /\bcookie[s]?\b|\bbiscuit[s]?\b/, label: "Cookies" },
    { pattern: /\bcandy\b|糖果/, label: "Candy" },
    { pattern: /年货/, label: "年货" },
    { pattern: /\bbread\b|面包/, label: "Bread" },
    { pattern: /\bcake\b|\bpastr(y|ies)\b|糕点/, label: "Pastry" },
    { pattern: /雪饼/, label: "雪饼" },
    { pattern: /仙贝/, label: "仙贝" },
    { pattern: /旺仔牛奶|牛奶/, label: "Milk" },
    { pattern: /辣条/, label: "辣条" },
    { pattern: /魔芋爽|魔芋/, label: "魔芋爽" },
    { pattern: /瓜子/, label: "瓜子" },
    { pattern: /坚果/, label: "坚果" },
    { pattern: /小鱼干/, label: "小鱼干" },
    { pattern: /肉类零食|肉干|鸡肉/, label: "肉类零食" },
    { pattern: /卤蛋/, label: "卤蛋" },
    { pattern: /零食/, label: "Snack" }
  ];

  function normalizeOcrText(value) {
    return String(value || "")
      .replace(/[|]/g, "I")
      .replace(/[®™]/g, " ")
      .replace(/\bclossic\b/gi, "classic")
      .replace(/\bc[l|i]assic\b/gi, "classic")
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
      .replace(/\bdorritos\b/gi, "doritos")
      .replace(/\bdorrito'?s\b/gi, "doritos")
      .replace(/\bskitles\b/gi, "skittles")
      .replace(/\bskittel'?s\b/gi, "skittles")
      .replace(/\bm\s*&\s*m'?s?\b/gi, "mms")
      .replace(/\bm\s+and\s+m'?s?\b/gi, "mms")
      .replace(/\bmnm'?s?\b/gi, "mms")
      .replace(/\bm\s*m'?s?\b/gi, "mms")
      .replace(/旺\s*旺/g, "旺旺")
      .replace(/旺\s*仔\s*牛\s*奶/g, "旺仔牛奶")
      .replace(/徐\s*福\s*记/g, "徐福记")
      .replace(/盼\s*盼/g, "盼盼")
      .replace(/卫\s*龙/g, "卫龙")
      .replace(/洽\s*洽|恰\s*恰/g, "洽洽")
      .replace(/劲\s*仔/g, "劲仔")
      .replace(/无\s*穷(\s*食\s*品)?/g, "无穷食品")
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
      .replace(/[^\p{L}\p{N}\s'-]/gu, " ")
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

    if (matchedBrand.label === "旺旺") {
      if (text.includes("旺仔牛奶")) {
        return "旺旺 旺仔牛奶";
      }
      if (text.includes("雪饼")) {
        return "旺旺 雪饼";
      }
      if (text.includes("仙贝")) {
        return "旺旺 仙贝";
      }
    }

    if (matchedBrand.label === "徐福记") {
      if (text.includes("糖果")) {
        return "徐福记 糖果";
      }
      if (text.includes("年货")) {
        return "徐福记 年货";
      }
    }

    if (matchedBrand.label === "盼盼") {
      if (matchedType?.label === "Bread") {
        return "盼盼 面包";
      }
      if (matchedType?.label === "Pastry") {
        return "盼盼 糕点";
      }
    }

    if (matchedBrand.label === "卫龙") {
      if (text.includes("魔芋爽")) {
        return "卫龙 魔芋爽";
      }
      if (text.includes("辣条")) {
        return "卫龙 辣条";
      }
    }

    if (matchedBrand.label === "洽洽") {
      if (text.includes("瓜子")) {
        return "洽洽 瓜子";
      }
      if (text.includes("坚果")) {
        return "洽洽 坚果";
      }
    }

    if (matchedBrand.label === "劲仔") {
      if (text.includes("小鱼干")) {
        return "劲仔 小鱼干";
      }
      if (matchedType?.label === "肉类零食") {
        return "劲仔 肉类零食";
      }
    }

    if (matchedBrand.label === "无穷食品") {
      if (text.includes("卤蛋")) {
        return "无穷食品 卤蛋";
      }
      if (matchedType?.label === "肉类零食") {
        return "无穷食品 鸡肉类零食";
      }
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
    const tokens = lower.replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter(Boolean);

    const scored = PACKAGED_BRANDS.map((brand) => {
      const directHit = brand.variants.some((variant) => hasVariantMatch(lower, variant));
      const fuzzyHit = brand.variants.reduce((best, variant) => {
        if (variant.length < 5) {
          return best;
        }
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

  function hasVariantMatch(text, variant) {
    const normalizedText = String(text || "").toLowerCase();
    const normalizedVariant = String(variant || "").toLowerCase().trim();
    if (!normalizedText || !normalizedVariant) {
      return false;
    }

    if (/[\u4e00-\u9fff]/.test(normalizedVariant)) {
      return normalizedText.includes(normalizedVariant);
    }

    const escapedVariant = normalizedVariant.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(`(^|[^\\p{L}\\p{N}])${escapedVariant}([^\\p{L}\\p{N}]|$)`, "u");
    return pattern.test(normalizedText);
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
