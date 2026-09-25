/**
 * i18n.js
 * -------
 * Single translation dictionary for the customer Mini App.
 * Supported: English (en), Amharic (am), Oromo (om / Afaan Oromoo).
 *
 * SINGLE SOURCE OF TRUTH (Task 3):
 * Every screen pulls the active language from LangContext — never from a
 * per-screen default. getT(code) takes an EXPLICIT language code only and
 * never peeks at the URL or localStorage itself; LangContext owns resolution:
 *
 *   1. URL ?lang= (set by the bot's language buttons / Menu Button)
 *   2. Telegram user.language_code
 *   3. English
 *
 * The bot persists the user's language against their Telegram ID in the
 * `user_langs` table and appends ?lang= to every Mini App URL it sends
 * (language buttons, Menu Button), so first paint is already correct.
 */

const translations = {
  en: {
    // Intro (Frame 0)
    introTitle: 'Welcome to Selam Cafe',
    introSubtitle: 'Fresh. Warm. Made with love.',
    introPrompt: 'How would you like your order?',
    introTapHint: 'Tap anywhere to continue',
    // Service choice (Frame 1)
    serviceTitle: 'How would you like to enjoy?',
    serviceSubtitle: 'Choose a service to begin your order',
    chooseNow: 'Choose now',
    dineIn: 'Dine In',
    dineInDesc: 'Sit back and enjoy your meal here',
    takeaway: 'Takeaway',
    takeawayDesc: 'Grab it hot and ready to go',
    delivery: 'Delivery',
    deliveryDesc: 'We bring it to your doorstep',
    // Main menu (Frame 2)
    menuRoot: 'menu',
    foods: 'Foods',
    drinks: 'Drinks',
    all: 'All',
    breakfast: 'Breakfast',
    lunch: 'Lunch',
    dinner: 'Dinner',
    snacks: 'Snacks',
    tapToSelect: 'Tap again to select',
    infoTitle: 'How to order',
    infoSubtitle: 'Your fresh order in 4 quick taps',
    infoStep1: '1. Pick a meal time',
    infoStep2: '2. Tap a category to expand',
    infoStep3: '3. Tap again to select',
    infoStep4: '4. Add items to your cart',
    noItemsForMeal: 'Nothing on the menu for this meal time.',
    // Category menu (Frame 3)
    items: 'items',
    item: 'item',
    outOfStock: 'Out of stock',
    back: '← Back',
    next: 'Next ✓',
    pickCategoryFirst: 'Please pick a category first.',
    // Cart review (Frame 4)
    yourOrder: 'Your Order',
    reviewBeforeConfirming: 'review before confirming',
    cartEmpty: 'Your cart is empty. Add some items first!',
    addMore: '← Add More',
    allDone: 'All Done ✓',
    total: 'Total',
    // Confirm (Frame 5)
    confirmTitle: 'Confirm Your Order',
    confirmCartEmpty: 'Your cart is empty.',
    each: 'each',
    cancel: '← Cancel',
    decreaseQty: 'Decrease',
    increaseQty: 'Increase',
    // Payment (Frame 6)
    payment: 'Payment',
    chooseHowToPay: "Choose how you'd like to pay",
    orderTotal: 'Order total',
    payFull: 'Pay Full Amount',
    payFullDesc: 'Pay the full amount now',
    payDeposit: 'Pay {n} Br Deposit',
    payDepositDesc: 'Reserve your order with a small deposit',
    payCounter: 'Pay at Counter',
    payTable: 'Pay at Table',
    payCounterDesc: 'Pay in person when you arrive',
    payUpfront: 'Pay {n} Br Upfront',
    payUpfrontDesc: 'Pay a small deposit now, the rest on arrival',
    payOnDelivery: 'Pay on Delivery',
    payOnDeliveryDesc: 'Pay the full amount when your order arrives',
    trustLockedHint: '🔒 Complete your first payment to unlock more options.',
    trustProgress: "✓ You've made {n} successful payment{s}. More options unlock as you order.",
    paymentProcessing: 'Processing your payment…',
    paymentSuccess: 'Payment Successful!',
    paymentFailed: 'Payment Failed',
    paymentErrorDefault: 'Something went wrong. Please try again.',
    paymentInitFailed: 'Payment initialization failed.',
    paymentNotCompleted: 'Payment was not completed.',
    continue: 'Continue →',
    cancelOrder: 'Cancel Order',
    dineInShort: 'Dine in',
    takeawayShort: 'Takeaway',
    deliveryShort: 'Delivery',
    // Location / name (Frame 7)
    almostThere: 'Almost There!',
    deliveryWhere: 'Where should we bring your order?',
    nameOnly: 'Just need your name to finish up',
    yourName: 'Your name',
    namePlaceholder: 'e.g. Selam or Abebe',
    deliveryLocation: 'Delivery location',
    shareLocation: '📍 Share my location',
    locating: '📍 Locating…',
    locationCaptured: '✓ Location captured',
    addressPlaceholder: 'Or enter your address manually (e.g. Bole Rd, Friendship Bldg)',
    geolocationUnavailable: 'Geolocation is not available on this device.',
    geolocationFailed: 'Could not get your location. Please enter your address manually.',
    placeDeliveryOrder: '🚗 Place Delivery Order',
    placeOrder: '✓ Place Order',
    placingOrder: 'Placing order…',
    byConfirming: 'By placing this order you confirm the details above.',
    // Order submission
    orderReceivedTitle: 'Order received!',
    yourTicketIs: 'Your ticket is {n}.',
    checkChat: 'Check the chat for your receipt.',
    orderSavedWarning: 'Order saved, but the bot could not message you. Open the bot and press Start once, then check your ticket there.',
    submitFailed: 'Something went wrong. Please try again.',
    // Blocked user (Task 4)
    blockedTitle: '⛔ Order Restricted',
    blockedMessage: "You can't place orders right now. Your account has been restricted by the cafe. If you think this is a mistake, please contact support.",
    contactSupport: 'Close',
  },

  am: {
    // Intro
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
    // Main menu
    menuRoot: 'ምናሌ',
    foods: 'ምግብ',
    drinks: 'መጠጥ',
    all: 'ሁሉም',
    breakfast: 'ቁርስ',
    lunch: 'ምሳ',
    dinner: 'የምሽት ምግብ',
    snacks: 'መክሰስያ',
    tapToSelect: 'ለመምረጥ ድጋሚ ይንኩ',
    infoTitle: 'እንዴት ይዘዙ',
    infoSubtitle: 'በ4 ፍጥነት ቅንብር ያድርጉ',
    infoStep1: '1. የምግብ ጊዜ ይምረጡ',
    infoStep2: '2. ምድብ ለመድረት ይንኩ',
    infoStep3: '3. ለመምረጥ ድጋሚ ይንኩ',
    infoStep4: '4. እቃዎችን ወደ ጋሪ ይጨምሩ',
    noItemsForMeal: 'ለዚህ የምግብ ሰዓት ምንም የለም።',
    // Category menu
    items: 'እቃዎች',
    item: 'እቃ',
    outOfStock: 'አልቧል',
    back: '← ተመለስ',
    next: 'ቀጥል ✓',
    pickCategoryFirst: 'እባክዎ መጀመሪያ ምድብ ይምረጡ።',
    // Cart review
    yourOrder: 'ትዕዛዝዎ',
    reviewBeforeConfirming: 'ከማረጋገጥ በፊት ይመልከቱ',
    cartEmpty: 'ጋሪዎ ባዶ ነው። መጀመሪያ እቃ ይጨምሩ!',
    addMore: '← ጨምር',
    allDone: 'ተጠናቋል ✓',
    total: 'ጠቅላላ',
    // Confirm
    confirmTitle: 'ትዕዛዝዎን ያረጋግጡ',
    confirmCartEmpty: 'ጋሪዎ ባዶ ነው።',
    each: 'ለአንዱ',
    cancel: '← ሰርዝ',
    decreaseQty: 'ቀንስ',
    increaseQty: 'ጨምር',
    // Payment
    payment: 'ክፍያ',
    chooseHowToPay: 'እንዴት መክፈል ይፈልጋሉ',
    orderTotal: 'የትዕዛዝ ጠቅላላ',
    payFull: 'ሙሉውን ይክፈሉ',
    payFullDesc: 'ሙሉውን አሁን ይክፈሉ',
    payDeposit: 'የ{n} ብር ማስቀመጫ ይክፈሉ',
    payDepositDesc: 'ትዕዛዝዎን በአነስተኛ ማስቀመጫ ያስይዙ',
    payCounter: 'በካውንተር ይክፈሉ',
    payTable: 'በጠረጴዛ ይክፈሉ',
    payCounterDesc: 'ሲደርሱ በራስዎ ይክፈሉ',
    payUpfront: 'የ{n} ብር ይክፈሉ',
    payUpfrontDesc: 'አነስተኛ ማስቀመጫ አሁን፣ ቀሪው ሲደርስ',
    payOnDelivery: 'ሲደርስ ይክፈሉ',
    payOnDeliveryDesc: 'ሙሉውን ሲደርስ ትዕዛዝዎ ይክፈሉ',
    trustLockedHint: '🔒 ተጨማሪ አማራጮችን ለመክፈት የመጀመሪያውን ክፍያ ይጠናቀቁ።',
    trustProgress: '✓ {n} የበለጠ ክፍያ አድርገዋል።',
    paymentProcessing: 'ክፍያዎ በመቀናበር ላይ…',
    paymentSuccess: 'ክፍያ ተሳክቷል!',
    paymentFailed: 'ክፍያ አልተሳካም',
    paymentErrorDefault: 'የሆነ ስህተት ተከስቷል። እባክዎ እንደገና ይሞክሩ።',
    paymentInitFailed: 'ክፍያ ማስጀመር አልተቻለም።',
    paymentNotCompleted: 'ክፍያ አልተጠናቀቀም።',
    continue: 'ቀጥል →',
    back: '← ተመለስ',
    cancelOrder: 'ትዕዛዝ ሰርዝ',
    dineInShort: 'በስፍራው',
    takeawayShort: 'መውሰድ',
    deliveryShort: 'መላኪያ',
    // Location / name
    almostThere: 'ከመጨረሻው ጥቂት!',
    deliveryWhere: 'ትዕዛዝዎን ወዴት እናመጣለን?',
    nameOnly: 'ስምዎን ብቻ እንፈልጋለን',
    yourName: 'ስምዎ',
    namePlaceholder: 'ለምሳሌ ሰላም ወይም አበበ',
    deliveryLocation: 'የመላኪያ አድራሻ',
    shareLocation: '📍 አድራሻዬን ላክ',
    locating: '📍 በመፈለግ ላይ…',
    locationCaptured: '✓ አድራሻ ተወስዷል',
    addressPlaceholder: 'ወይም አድራሻዎን በእጅ ያስገቡ',
    geolocationUnavailable: 'አድራሻ ማግኘት በዚህ መሣሪያ አይቻልም።',
    geolocationFailed: 'አድራሻዎን ማግኘት አልቻልንም። እባክዎ በእጅ ያስገቡ።',
    placeDeliveryOrder: '🚗 የመላኪያ ትዕዛዝ አዝዝ',
    placeOrder: '✓ ትዕዛዝ አዝዝ',
    placingOrder: 'ትዕዛዝ በመላክ ላይ…',
    byConfirming: 'ትዕዛዝ በማዘዝ ዝርዝሮቹን እንደሚያረጋግጡ ይገባል።',
    // Order submission
    orderReceivedTitle: 'ትዕዛዝዎ ደርሷል!',
    yourTicketIs: 'ትኬትዎ {n} ነው።',
    checkChat: 'ደረሰኙን ከቻት ውስጥ ይመልከቱ።',
    orderSavedWarning: 'ትዕዛዝዎ ተቀምጧል፣ ግን ቦቱ መልእክት መላክ አልቻለም። ቦቱን ክፈት እና አንዴ Start ይንኩ።',
    submitFailed: 'የሆነ ስህተት ተከስቷል። እባክዎ እንደገና ይሞክሩ።',
    // Blocked user
    blockedTitle: '⛔ ትዕዛዝ ተዘግቷል',
    blockedMessage: 'አሁን ትዕዛዝ መላክ አይችሉም። መለያዎ በካፌው ተገድቷል። ስህተት ከሆነ እባክዎ ያግኙን።',
    contactSupport: 'ዝጋ',
  },

  om: {
    // Intro — Afaan Oromoo
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
    takeawayDesc: "Hoo'aa qabatee deemi",
    delivery: 'Dabarsuu',
    deliveryDesc: 'Bira keessaniin nu geessina',
    // Main menu
    menuRoot: 'Minjeecha',
    foods: 'Nyaata',
    drinks: 'Dhiqqata',
    all: 'Hunda',
    breakfast: 'Qura',
    lunch: 'Midhanya',
    dinner: 'Irbaata',
    snacks: 'Qopheeyyii',
    tapToSelect: "Filachuuf irra deebi'i tuqi",
    infoTitle: 'Akkamitti order gochuu',
    infoSubtitle: 'Order keessan tapha 4 keessatti',
    infoStep1: '1. Yeroo nyaata filadhaa',
    infoStep2: '2. Gosa argachuuf tuqi',
    infoStep3: "3. Filachuuf irra deebii tuqi",
    infoStep4: '4. Waan karaa kaartaa iddoo dabalii',
    noItemsForMeal: 'Yeroon nyaataa kanaaf waan hin jiru.',
    // Category menu
    items: 'waanota',
    item: 'waan',
    outOfStock: 'Hin jiru',
    back: '← Gara duubaa',
    next: 'Itti fuf ✓',
    pickCategoryFirst: 'Maaloo jalqaba gosa filadhu.',
    // Cart review
    yourOrder: 'Ajaja kee',
    reviewBeforeConfirming: 'mirkaneessuu dura ilaali',
    cartEmpty: 'Kaartaa kee duwwaa dha. Jalqaba waan dabalii!',
    addMore: '← Dabalii',
    allDone: 'Xumurameera ✓',
    total: 'Waliigala',
    // Confirm
    confirmTitle: 'Ajaja kee mirkaneessi',
    confirmCartEmpty: 'Kaartaa kee duwwaa dha.',
    each: 'tokkoon tokkoon',
    cancel: '← Dhiisi',
    decreaseQty: 'Hir\'i',
    increaseQty: 'Dabali',
    // Payment
    payment: 'Kaffaltaa',
    chooseHowToPay: 'Akkamitti kaffalu barbaadda',
    orderTotal: 'Waliigala ajajaa',
    payFull: 'Waliigala kaffali',
    payFullDesc: 'Waliigala amma kaffali',
    payDeposit: '{n} Qarii kaffali',
    payDepositDesc: 'Ajaja kee qarii xiqqoon eegi',
    payCounter: 'Kaawuntara irratti kaffali',
    payTable: 'Tarsaadoo irratti kaffali',
    payCounterDesc: "Yeroo dhuftu ofiin kaffali",
    payUpfront: '{n} Qarii kaffali',
    payUpfrontDesc: 'Qarii xiqqoo amma, hafe yeroon dhufu',
    payOnDelivery: 'Yeroon dhufu kaffali',
    payOnDeliveryDesc: 'Waliigala yeroon ajajan dhufu kaffali',
    trustLockedHint: '🔒 Filannoo dabalata banuuf kaffaltaa jalqabaa xumuri.',
    trustProgress: "✓ Kaffaltaan {n} milkeeffameera.",
    paymentProcessing: 'Kaffaltaa kee hojjechaa jira…',
    paymentSuccess: 'Kaffaltaan milkeeffameera!',
    paymentFailed: 'Kaffaltaan hin milkoofne',
    paymentErrorDefault: 'Waan tokko dogoggorerra. Maaloo irra deebi\'i yaali.',
    paymentInitFailed: 'Kaffaltaa jalqabuun hin dandeenye.',
    paymentNotCompleted: 'Kaffaltaan hin xumuramne.',
    continue: 'Itti fuf →',
    back: '← Gara duubaa',
    cancelOrder: 'Ajaja haqi',
    dineInShort: 'Achumaa',
    takeawayShort: 'Maqata',
    deliveryShort: 'Dabarsuu',
    // Location / name
    almostThere: 'Xumura dhiyoo!',
    deliveryWhere: 'Eessa geessu barbaadda?',
    nameOnly: 'Maqaa kee qofa barbaanna',
    yourName: 'Maqaa kee',
    namePlaceholder: 'fkn Selam ykn Abebe',
    deliveryLocation: 'Iddoo dabarsuu',
    shareLocation: '📍 Iddoo koo ergi',
    locating: '📍 Barbaadaa jira…',
    locationCaptured: '✓ Iddoon qabameera',
    addressPlaceholder: 'Ykn teessoo kee ofiin barreessi',
    geolocationUnavailable: 'Iddoo argachuun meeshaa kana irratti hin danda\'amu.',
    geolocationFailed: 'Iddoo kee arguun hin dandeenye. Maaloo ofiin barreessi.',
    placeDeliveryOrder: '🚗 Ajaja dabarsuu ergi',
    placeOrder: '✓ Ajaja ergi',
    placingOrder: 'Ajaja ergaa jira…',
    byConfirming: 'Ajaja erguun wantoota armaan olitti mirkaneessita.',
    // Order submission
    orderReceivedTitle: 'Ajajni kee dhufeeera!',
    yourTicketIs: 'Tikkeetiin kee {n} dha.',
    checkChat: 'Rasiisaa caatii keessatti ilaali.',
    orderSavedWarning: 'Ajajni kee qabameera, garuu botin akkaana hin erginee. Boti banittii yimmoo Start tuqi.',
    submitFailed: "Waan tokko dogoggorerra. Maaloo irra deebi'i yaali.",
    // Blocked user
    blockedTitle: '⛔ Ajaja dhorkameera',
    blockedMessage: "Amma ajaja erguu hin dandeessu. Herregaan kee kafeen dhorkameera. Dogoggoro yoo ta'e maaloo nu qunnamsiisi.",
    contactSupport: 'Cufi',
  },
}

/**
 * Build a translation function for an explicit language code.
 * Falls back to English for unknown keys / unknown languages.
 * NOTE: takes an explicit code — URL/localStorage resolution lives in
 * LangContext (single source of truth).
 */
export function getT(langCode) {
  const lang = normalizeLang(langCode)
  const dict = translations[lang] || translations.en
  return (key) => dict[key] || translations.en[key] || key
}

/**
 * Normalize Telegram / URL language codes to our supported languages.
 * Handles 'en-US', 'am-ET', etc.
 *   - 'or' → 'om' (Telegram uses 'or' for Afaan Oromoo in some clients)
 *   - 'am'/'amh' → 'am', 'om' → 'om'
 *   - anything else → 'en'
 */
export function normalizeLang(code) {
  const base = (code || '').toLowerCase().split('-')[0]
  if (base === 'or') return 'om'
  if (base in translations) return base
  return 'en'
}

export const SUPPORTED_LANGS = Object.keys(translations)
