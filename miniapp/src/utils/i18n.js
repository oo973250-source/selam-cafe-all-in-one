/**
 * i18n.js
 * -------
 * Lightweight internationalization for the cafe mini app.
 * Supports: English (en), Amharic (am), Oromo (om).
 * Falls back to English for any unknown language.
 *
 * Language is detected from the Telegram user's language_code
 * (available via useTelegram().userLanguage), which reflects the
 * language the user selected in their Telegram app when they
 * started the bot.
 *
 * For testing in a browser without the Telegram SDK, you can
 * append ?lang=am (or ?lang=om) to the URL to force a language.
 */

const translations = {
  en: {
    // Intro
    introTitle: 'Welcome to Selam Cafe',
    introSubtitle: 'Fresh. Warm. Made with love.',
    introPrompt: 'How would you like your order?',
    introTapHint: 'Tap anywhere to continue',
    // Service choice
    serviceTitle: 'How would you like to enjoy?',
    serviceSubtitle: 'Choose a service to begin your order',
    chooseNow: 'Choose now',
    dineIn: 'Dine In',
    dineInDesc: 'Sit back and enjoy your meal here',
    takeaway: 'Takeaway',
    takeawayDesc: 'Grab it hot and ready to go',
    delivery: 'Delivery',
    deliveryDesc: 'We bring it to your doorstep',
    // Main menu (Frame 3)
    menuRoot: 'menu',
    foods: 'Foods',
    drinks: 'Drinks',
    all: 'All',
    breakfast: 'Breakfast',
    lunch: 'Lunch',
    dinner: 'Dinner',
    snacks: 'Snacks',
    tapToSelect: 'Tap again to select',
    // Info box (Frame 2) — guidance card above the owner
    infoTitle: 'How to order',
    infoSubtitle: 'Your fresh order in 4 quick taps',
    infoStep1: '1. Pick a meal time',
    infoStep2: '2. Tap a category to expand',
    infoStep3: '3. Tap again to select',
    infoStep4: '4. Add items to your cart',
  },

  am: {
    // Intro — Amharic
    introTitle: 'ሰላም ካፌ እንኳን ደህና መጡ',
    introSubtitle: 'ትኩስ። ሞቅ። በፍቅር የተሰራ።',
    introPrompt: 'ትዕዛዝዎን እንዴት ይፈልጋሉ?',
    introTapHint: 'ለመቀጠል የትኛውንም ቦታ ይንኩ',
    // Service choice
    serviceTitle: 'እንዴት እንደሚደሰቱ ይፈልጋሉ?',
    serviceSubtitle: 'ትዕዛዝዎን ለመጀመር አገልግሎት ይምረጡ',
    chooseNow: 'አሁን ይምረጡ',
    dineIn: 'በውስጥ መብላት',
    dineInDesc: 'እዚህ ተቀምጠው ምግብዎን ይደሰቱ',
    takeaway: 'መውሰድ',
    takeawayDesc: 'ሞቅ ብሎ ዝግጁ ሆኖ ይውሰዱት',
    delivery: 'መላኪያ',
    deliveryDesc: 'እስከ በርዎ እናመጣለን',
    // Main menu (Frame 3)
    menuRoot: 'ምናሌ',
    foods: 'ምግብ',
    drinks: 'መጠጥ',
    all: 'ሁሉም',
    breakfast: 'ቁርስ',
    lunch: 'ምሳ',
    dinner: 'የምሽት ምግብ',
    snacks: 'መክሰስያ',
    tapToSelect: 'ለመምረጥ ድጋሚ ይንኩ',
    // Info box (Frame 2)
    infoTitle: 'እንዴት ይዘዙ',
    infoSubtitle: 'በ4 ፍጥነት ቅንብር ያድርጉ',
    infoStep1: '1. የምግብ ጊዜ ይምረጡ',
    infoStep2: '2. ምድብ ለመድረት ይንኩ',
    infoStep3: '3. ለመምረጥ ድጋሚ ይንኩ',
    infoStep4: '4. እቃዎችን ወደ ጋሪ ይጨምሩ',
  },

  om: {
    // Intro — Oromo (Afaan Oromoo)
    introTitle: 'Baga nagaan dhuftaan Kafeessa Selam',
    introSubtitle: "Haaraa. Hoo'a. Jaalalaan hojjate.",
    introPrompt: 'Rakoo keessan akkamitti barbaadduu?',
    introTapHint: 'Itti fufuuf bakka kamiyyuu tuqi',
    // Service choice
    serviceTitle: 'Akkamitti gammaduu barbaadda?',
    serviceSubtitle: 'Rakoo jalqabuuf tajaajila filadhaa',
    chooseNow: 'Amma filadhaa',
    dineIn: 'Keessatti nyaachuu',
    dineInDesc: "As taa'anii nyaata keessan qabadhaa",
    takeaway: 'Maqata',
    takeawayDesc: 'Hoo\'aa qabatee deemi',
    delivery: 'Dabarsuu',
    deliveryDesc: 'Bira keessaniin nu geessina',
    // Main menu (Frame 3)
    menuRoot: 'Minjeecha',
    foods: 'Nyaata',
    drinks: 'Dhiqqata',
    all: 'Hunda',
    breakfast: 'Qura',
    lunch: 'Midhanya',
    dinner: 'Irbaata',
    snacks: 'Qopheeyyii',
    tapToSelect: 'Filachuuf irra deebi\'i tuqi',
    // Info box (Frame 2)
    infoTitle: 'Akkamitti order gochuu',
    infoSubtitle: 'Order keessan tapha 4 keessatti',
    infoStep1: '1. Yeroo nyaata filadhaa',
    infoStep2: '2. Gosa argachuuf tuqi',
    infoStep3: '3. Filachuuf irra deebii tuqi',
    infoStep4: '4. Dhibbeentaa gara kaartaa iddoo',
  },
}

/**
 * Get the translation function for a given language code.
 * @param {string} langCode — Telegram user.language_code ('en', 'am', 'om', 'ru', ...)
 * @returns {(key: string) => string}
 *
 * Language priority:
 *   1. URL ?lang=xx (for browser testing)
 *   2. Telegram user.language_code (from useTelegram)
 *   3. English fallback
 */
export function getT(langCode) {
  const lang = normalizeLang(langCode)
  const dict = translations[lang] || translations.en
  return (key) => dict[key] || translations.en[key] || key
}

/**
 * Normalize Telegram language codes to our supported languages.
 * Handles 'en-US', 'am-ET', etc.
 *
 * Special cases:
 *   - 'om' or 'or' → Oromo (Telegram uses 'or' for Afaan Oromoo in some clients)
 *   - 'am' or 'amh' → Amharic
 */
function normalizeLang(code) {
  if (!code) return 'en'
  // Allow URL ?lang=xx override for browser testing
  try {
    const urlLang = new URLSearchParams(window.location.search).get('lang')
    if (urlLang) {
      const base = urlLang.toLowerCase().split('-')[0]
      if (base === 'or') return 'om'
      if (base in translations) return base
    }
  } catch (_) {
    /* not in a browser */
  }
  const base = (code || '').toLowerCase().split('-')[0]
  if (base === 'or') return 'om'  // Telegram sometimes uses 'or' for Afaan Oromoo
  if (base in translations) return base
  return 'en'
}

export const SUPPORTED_LANGS = Object.keys(translations)
