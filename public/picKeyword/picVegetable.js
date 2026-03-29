(function initFreshTrackerPicVegetable(global) {
  const VEGETABLE_CATEGORIES = [
    {
      id: "leafy",
      label: "Leafy Vegetables",
      items: [
        { name: "Spinach", variants: ["spinach"] },
        { name: "Lettuce", variants: ["lettuce"] },
        { name: "Romaine Lettuce", variants: ["romaine lettuce", "romaine", "chinese lettuce"] },
        { name: "Bok Choy", variants: ["bok choy", "pak choi", "pak choy", "chinese cabbage"] },
        { name: "Water Spinach", variants: ["water spinach", "morning glory"] },
        { name: "Amaranth Greens", variants: ["amaranth greens", "amaranth"] }
      ]
    },
    {
      id: "root",
      label: "Root and Tuber Vegetables",
      items: [
        { name: "Carrot", variants: ["carrot", "carrots"] },
        { name: "Daikon Radish", variants: ["daikon radish", "daikon", "radish"] },
        { name: "Potato", variants: ["potato", "potatoes"] },
        { name: "Sweet Potato", variants: ["sweet potato", "sweet potatoes"] },
        { name: "Lotus Root", variants: ["lotus root"] }
      ]
    },
    {
      id: "fruit",
      label: "Fruit Vegetables",
      items: [
        { name: "Tomato", variants: ["tomato", "tomatoes"] },
        { name: "Cucumber", variants: ["cucumber", "cucumbers"] },
        { name: "Eggplant", variants: ["eggplant", "eggplants", "aubergine", "aubergines"] },
        { name: "Bell Pepper", variants: ["bell pepper", "bell peppers", "sweet pepper", "sweet peppers"] },
        { name: "Pumpkin", variants: ["pumpkin", "pumpkins", "squash"] },
        { name: "Bitter Melon", variants: ["bitter melon", "bitter gourd"] }
      ]
    },
    {
      id: "allium",
      label: "Allium Vegetables",
      items: [
        { name: "Garlic", variants: ["garlic"] },
        { name: "Leek", variants: ["leek", "leeks", "green onion", "green onions", "spring onion", "spring onions"] },
        { name: "Ginger", variants: ["ginger"] },
        { name: "Onion", variants: ["onion", "onions"] }
      ]
    },
    {
      id: "legumes",
      label: "Legumes and Sprouts",
      items: [
        { name: "Green Beans", variants: ["green beans", "green bean", "string beans", "string bean"] },
        { name: "Peas", variants: ["peas", "pea"] },
        { name: "Edamame", variants: ["edamame", "young soybeans", "young soybean"] },
        { name: "Soybean Sprouts", variants: ["soybean sprouts", "soybean sprout"] },
        { name: "Mung Bean Sprouts", variants: ["mung bean sprouts", "mung bean sprout"] }
      ]
    },
    {
      id: "mushrooms",
      label: "Mushrooms",
      items: [
        { name: "Shiitake Mushroom", variants: ["shiitake mushroom", "shiitake mushrooms", "shiitake"] },
        { name: "Enoki Mushroom", variants: ["enoki mushroom", "enoki mushrooms", "enoki"] },
        { name: "Oyster Mushroom", variants: ["oyster mushroom", "oyster mushrooms"] },
        { name: "King Oyster Mushroom", variants: ["king oyster mushroom", "king oyster mushrooms"] }
      ]
    },
    {
      id: "flower",
      label: "Flower Vegetables",
      items: [
        { name: "Broccoli", variants: ["broccoli"] },
        { name: "Cauliflower", variants: ["cauliflower"] },
        { name: "Chinese Broccoli", variants: ["chinese broccoli", "gai lan"] }
      ]
    }
  ];

  const VEGETABLE_ITEMS = VEGETABLE_CATEGORIES.flatMap((category) =>
    category.items.map((item) => ({
      ...item,
      categoryId: category.id,
      categoryLabel: category.label
    }))
  );

  function normalizeVegetableOcrText(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/[|]/g, "l")
      .replace(/[®™]/g, " ")
      .replace(/\bauberglne\b/g, "aubergine")
      .replace(/\begg p1ant\b/g, "eggplant")
      .replace(/\bbroccoll\b/g, "broccoli")
      .replace(/\bcaulifl0wer\b/g, "cauliflower")
      .replace(/\bcucurnber\b/g, "cucumber")
      .replace(/\bgingar\b/g, "ginger")
      .replace(/\bspinac[h]?\b/g, "spinach")
      .replace(/\blettucee\b/g, "lettuce")
      .replace(/\bromainee\b/g, "romaine")
      .replace(/\bbokcho[y]?\b/g, "bok choy")
      .replace(/\bpakcho[iy]\b/g, "pak choi")
      .replace(/\bwaterspinach\b/g, "water spinach")
      .replace(/\bmorningglory\b/g, "morning glory")
      .replace(/\bdaikonradish\b/g, "daikon radish")
      .replace(/\bsweetpotato\b/g, "sweet potato")
      .replace(/\blotusroot\b/g, "lotus root")
      .replace(/\bbellpepper[s]?\b/g, "bell pepper")
      .replace(/\bsweetpepper[s]?\b/g, "sweet pepper")
      .replace(/\bbittermelon\b/g, "bitter melon")
      .replace(/\bbittergourd\b/g, "bitter gourd")
      .replace(/\bgreenonion[s]?\b/g, "green onion")
      .replace(/\bspringonion[s]?\b/g, "spring onion")
      .replace(/\bgreenbean[s]?\b/g, "green beans")
      .replace(/\bstringbean[s]?\b/g, "string beans")
      .replace(/\byoungsoybean[s]?\b/g, "young soybeans")
      .replace(/\bsoybeansprout[s]?\b/g, "soybean sprouts")
      .replace(/\bmungbeansprout[s]?\b/g, "mung bean sprouts")
      .replace(/\bshiitak[e]?\b/g, "shiitake")
      .replace(/\benok[i]?\b/g, "enoki")
      .replace(/\boystermushroom[s]?\b/g, "oyster mushroom")
      .replace(/\bkingoystermushroom[s]?\b/g, "king oyster mushroom")
      .replace(/\bchinesebroccoli\b/g, "chinese broccoli")
      .replace(/\bgailan\b/g, "gai lan")
      .replace(/[^\p{L}\p{N}\s'-]/gu, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function extractVegetableName(normalizedText) {
    const text = ` ${String(normalizedText || "").toLowerCase()} `;
    if (!text.trim()) {
      return "";
    }

    const matched = VEGETABLE_ITEMS.find((item) =>
      item.variants.some((variant) => text.includes(` ${variant.toLowerCase()} `))
    );

    return matched ? matched.name : "";
  }

  function extractVegetableKeywordQuery(normalizedText) {
    return extractVegetableName(normalizedText);
  }

  global.FreshTrackerPicVegetable = {
    VEGETABLE_CATEGORIES,
    VEGETABLE_ITEMS,
    normalizeVegetableOcrText,
    extractVegetableName,
    extractVegetableKeywordQuery
  };
})(window);
