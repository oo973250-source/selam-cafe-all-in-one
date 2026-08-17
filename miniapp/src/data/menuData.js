/**
 * menuData.js
 * -----------
 * Static menu for the Ethiopian cafe. Two top-level sections
 * (foods / drinks), each containing 7 categories.
 *
 * The first 4 foods and first 2 drinks have real item data.
 * The remaining categories are placeholders labelled "Category N"
 * (admin will rename + populate later via the admin panel).
 *
 * Every item: { id, nameEn, nameAm, price, available }.
 * Prices are in Ethiopian Birr (ETB / Br).
 */

// Helper to make a placeholder category with N placeholder items.
// Placeholders are visible only in the 'All' meal-time view (mealTimes: ['all'])
// — admin will rename + populate them later via the admin panel.
const placeholder = (id, icon, count) => ({
  id,
  nameEn: `Category ${id.split('-').pop()}`,
  nameAm: `ምድብ ${id.split('-').pop()}`,
  icon,
  placeholder: true,
  mealTimes: ['all'],
  items: Array.from({ length: count }, (_, i) => ({
    id: `${id}-item-${i + 1}`,
    nameEn: `Item ${i + 1}`,
    nameAm: `እቃ ${i + 1}`,
    price: 50 + i * 10,
    available: true,
  })),
})

export const menuData = {
  foods: {
    label: 'Foods',
    labelAm: 'ምግብ',
    categories: [
      {
        id: 'breakfast',
        nameEn: 'Breakfast',
        nameAm: 'ቁርስ',
        icon: '🌅',
        // Served only at breakfast time. Selecting 'Lunch'/'Dinner'/'Snacks'
        // hides this category, satisfying the user's rule: "sambusa is not
        // served at the morning — when the user chooses breakfast the
        // category that had sambusa doesn't appear".
        mealTimes: ['breakfast'],
        items: [
          { id: 'firfir',         nameEn: 'Firfir',         nameAm: 'ፍርፍር',         price: 80, available: true },
          { id: 'fatira',         nameEn: 'Fatira',         nameAm: 'ፋጥራ',         price: 60, available: true },
          { id: 'chechebsa',      nameEn: 'Chechebsa',      nameAm: 'ጨጨብሣ',        price: 70, available: true },
          { id: 'enkulal-firfir', nameEn: 'Enkulal Firfir', nameAm: 'እንክላል ፍርፍር',  price: 90, available: true },
          { id: 'ful',            nameEn: 'Ful',            nameAm: 'ፉል',           price: 55, available: true },
          { id: 'kitcha-fitfit',  nameEn: 'Kitcha Fitfit',  nameAm: 'ኪጫ ፍጥፍጥ',     price: 65, available: true },
        ],
      },
      {
        id: 'lunch',
        nameEn: 'Lunch',
        nameAm: 'ምሳ',
        icon: '☀️',
        mealTimes: ['lunch'],
        items: [
          { id: 'doro-wot',   nameEn: 'Doro Wot',   nameAm: 'ዶሮ ወጥ',   price: 150, available: true },
          { id: 'tibs',       nameEn: 'Tibs',       nameAm: 'ጥብስ',      price: 120, available: true },
          { id: 'kitfo',      nameEn: 'Kitfo',      nameAm: 'ክትፎ',      price: 180, available: true },
          { id: 'shiro-wot',  nameEn: 'Shiro Wot',  nameAm: 'ሽሮ ወጥ',   price: 70,  available: true },
          { id: 'misir-wot',  nameEn: 'Misir Wot',  nameAm: 'ምስር ወጥ',  price: 65,  available: true },
          { id: 'key-wot',    nameEn: 'Key Wot',    nameAm: 'ቀይ ወጥ',   price: 85,  available: true },
          { id: 'gomen',      nameEn: 'Gomen',      nameAm: 'ጎሜን',      price: 55,  available: true },
          { id: 'pasta',      nameEn: 'Pasta',      nameAm: 'ፓስታ',      price: 75,  available: true },
        ],
      },
      {
        id: 'dinner',
        nameEn: 'Dinner',
        nameAm: 'የምሽት ምግብ',
        icon: '🌙',
        mealTimes: ['dinner'],
        items: [
          { id: 'special-tibs',   nameEn: 'Special Tibs',   nameAm: 'ልዩ ጥብስ',     price: 150, available: true },
          { id: 'dulet',          nameEn: 'Dulet',          nameAm: 'ዱሌት',         price: 130, available: true },
          { id: 'kurt',           nameEn: 'Kurt',           nameAm: 'ኩርት',         price: 200, available: true },
          { id: 'quanta-firfir',  nameEn: 'Quanta Firfir',  nameAm: 'ቋንታ ፍርፍር',  price: 110, available: true },
        ],
      },
      {
        id: 'snacks',
        nameEn: 'Snacks',
        nameAm: 'መክሰስያ',
        icon: '🥪',
        // Snacks (incl. sambusa) are NOT served at breakfast — selecting
        // 'Breakfast' hides this category entirely.
        mealTimes: ['snacks'],
        items: [
          { id: 'sambusa',  nameEn: 'Sambusa',  nameAm: 'ሳምቡሳ',  price: 30, available: true },
          { id: 'sandwich', nameEn: 'Sandwich', nameAm: 'ሳንድዊች', price: 50, available: true },
          { id: 'egg-roll', nameEn: 'Egg Roll', nameAm: 'እንቁላል ሮል', price: 40, available: true },
        ],
      },
      // Placeholder categories 5-7 — admin will rename later.
      placeholder('foods-5', '🥗', 4),
      placeholder('foods-6', '🍰', 4),
      placeholder('foods-7', '🥘', 4),
    ],
  },

  drinks: {
    label: 'Drinks',
    labelAm: 'መጠጥ',
    categories: [
      {
        id: 'hot_drinks',
        nameEn: 'Hot Drinks',
        nameAm: 'ሙቅ መጠጥ',
        icon: '☕',
        // Coffee/tea/macchiato are served all day at a cafe — show in
        // every meal-time view.
        mealTimes: ['all', 'breakfast', 'lunch', 'dinner', 'snacks'],
        items: [
          { id: 'buna',        nameEn: 'Buna',        nameAm: 'ቡና',        price: 30, available: true },
          { id: 'macchiato',   nameEn: 'Macchiato',   nameAm: 'ማኪያቶ',     price: 40, available: true },
          { id: 'tea',         nameEn: 'Tea',         nameAm: 'ሻይ',        price: 20, available: true },
          { id: 'spiced-tea',  nameEn: 'Spiced Tea',  nameAm: 'ቅመማ ቅመም ሻይ', price: 25, available: true },
        ],
      },
      {
        id: 'cold_drinks',
        nameEn: 'Cold Drinks',
        nameAm: 'ቀዝቃዛ መጠጥ',
        icon: '🥤',
        // Juices/soda/water are served at lunch, dinner, and snacks —
        // not typically at breakfast. Selecting 'Breakfast' hides this
        // category so the drinks column shows only Hot Drinks.
        mealTimes: ['all', 'lunch', 'dinner', 'snacks'],
        items: [
          { id: 'juice-mixed',   nameEn: 'Juice Mixed',   nameAm: 'ድብልቅ ጭማቂ',  price: 45, available: true },
          { id: 'mango-juice',   nameEn: 'Mango Juice',   nameAm: 'ማንጎ ጭማቂ',   price: 50, available: true },
          { id: 'avocado-juice', nameEn: 'Avocado Juice', nameAm: 'አቮካዶ ጭማቂ', price: 55, available: true },
          { id: 'water',         nameEn: 'Water',         nameAm: 'ውሃ',         price: 15, available: true },
          { id: 'soda',          nameEn: 'Soda',          nameAm: 'ሶዳ',         price: 25, available: true },
        ],
      },
      // Placeholder drink categories 3-7 — admin will rename later.
      placeholder('drinks-3', '🍹', 4),
      placeholder('drinks-4', '🧃', 4),
      placeholder('drinks-5', '🍵', 4),
      placeholder('drinks-6', '🥛', 4),
      placeholder('drinks-7', '🍷', 4),
    ],
  },
}

export function findCategoryById(sectionKey, categoryId) {
  const section = menuData[sectionKey]
  if (!section) return null
  return section.categories.find((c) => c.id === categoryId) || null
}

export function getAllCategoriesFlat() {
  return [
    ...menuData.foods.categories.map((c) => ({ ...c, sectionKey: 'foods' })),
    ...menuData.drinks.categories.map((c) => ({ ...c, sectionKey: 'drinks' })),
  ]
}
