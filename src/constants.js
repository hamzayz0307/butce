// Built-in categories and the words quick entry uses to guess them.

export const DEFAULT_CATS = [
  { key: 'groceries', emoji: '🛒', color: '#4E9A6A', type: 'expense' },
  { key: 'food', emoji: '🍽️', color: '#D08A3C', type: 'expense' },
  { key: 'transport', emoji: '🚕', color: '#4C7DBF', type: 'expense' },
  { key: 'rent', emoji: '🏠', color: '#7D5CB0', type: 'expense' },
  { key: 'bills', emoji: '💡', color: '#B8962E', type: 'expense' },
  { key: 'subscriptions', emoji: '🔁', color: '#B65A86', type: 'expense' },
  { key: 'shopping', emoji: '🛍️', color: '#2F95A6', type: 'expense' },
  { key: 'fun', emoji: '🎟️', color: '#8E6CC9', type: 'expense' },
  { key: 'health', emoji: '💊', color: '#5DA0C9', type: 'expense' },
  { key: 'education', emoji: '📚', color: '#7E8C3A', type: 'expense' },
  { key: 'other', emoji: '🧾', color: '#7C8A85', type: 'expense' },
  { key: 'salary', emoji: '💼', color: '#2E9D74', type: 'income' },
  { key: 'scholarship', emoji: '🎓', color: '#2E9D74', type: 'income' },
  { key: 'allowance', emoji: '👪', color: '#2E9D74', type: 'income' },
  { key: 'side', emoji: '🧰', color: '#2E9D74', type: 'income' },
  { key: 'other_income', emoji: '💰', color: '#2E9D74', type: 'income' }
];

// Words that point to a category in quick entry (Turkish letters are folded: ş→s, ı→i, ...)
export const KEYWORDS = {
  salary: ['maas', 'salary', 'wage', 'paycheck'],
  scholarship: ['burs', 'scholarship', 'kyk'],
  allowance: ['harclik', 'allowance', 'pocket money'],
  side: ['ek is', 'freelance', 'side'],
  other_income: ['gelir', 'income', 'iade', 'refund'],
  rent: ['kira', 'rent', 'aidat'],
  bills: ['fatura', 'elektrik', 'su', 'dogalgaz', 'internet', 'telefon faturasi', 'gsm', 'turkcell', 'vodafone', 'turk telekom', 'bill', 'electricity', 'water', 'utilities'],
  subscriptions: ['netflix', 'spotify', 'youtube', 'disney', 'exxen', 'blutv', 'amazon prime', 'icloud', 'apple music', 'chatgpt', 'abonelik', 'uyelik', 'subscription'],
  groceries: ['market', 'migros', 'bim', 'a101', 'sok', 'carrefour', 'bakkal', 'manav', 'kasap', 'firin', 'ekmek', 'grocer', 'supermarket'],
  food: ['yemek', 'yemeksepeti', 'getir', 'kafe', 'kahve', 'cafe', 'coffee', 'starbucks', 'restoran', 'restaurant', 'doner', 'kebap', 'pizza', 'burger', 'lunch', 'dinner', 'breakfast', 'kahvalti', 'ogle', 'simit', 'cay', 'food', 'takeaway'],
  transport: ['taksi', 'taxi', 'uber', 'bitaksi', 'otobus', 'metro', 'metrobus', 'marmaray', 'vapur', 'istanbulkart', 'akbil', 'dolmus', 'benzin', 'yakit', 'akaryakit', 'otopark', 'bus', 'fuel', 'gas', 'parking', 'tren', 'train', 'ucak', 'flight'],
  health: ['eczane', 'ilac', 'doktor', 'hastane', 'dis', 'pharmacy', 'medicine', 'doctor', 'hospital', 'gym', 'spor salonu'],
  education: ['kitap', 'kurs', 'okul', 'universite', 'harci', 'kirtasiye', 'fotokopi', 'book', 'course', 'school', 'tuition'],
  fun: ['sinema', 'cinema', 'film', 'movie', 'konser', 'concert', 'oyun', 'game', 'steam', 'playstation', 'bar', 'bira', 'beer', 'mac', 'tiyatro', 'theatre', 'eglence'],
  shopping: ['alisveris', 'trendyol', 'hepsiburada', 'amazon', 'n11', 'zara', 'lcw', 'kiyafet', 'giyim', 'ayakkabi', 'mont', 'telefon', 'kulaklik', 'laptop', 'bilgisayar', 'shopping', 'clothes', 'shoes', 'phone', 'headphone', 'ikea']
};
export const INCOME_KEYS = ['salary', 'scholarship', 'allowance', 'side', 'other_income'];
export const GOAL_EMOJIS = ['🎯', '💻', '🏖️', '🚗', '🏠', '🎓', '📱', '🛟', '💍', '✈️'];

// Choices when creating or editing a category
export const CAT_EMOJIS = [
  '🛒', '🍽️', '☕', '🍺', '🚕', '🚗', '⛽', '🚌', '✈️', '🏠', '💡', '📱', '🌐', '🔁', '🛍️', '👕',
  '💄', '💇', '🎟️', '🎮', '🎬', '🎵', '💊', '🏋️', '📚', '🎓', '👶', '🐾', '🎁', '❤️', '🔧', '🧾',
  '💼', '💰', '🏦', '📈', '🪙', '🎯'
];
export const CAT_COLORS = ['#4E9A6A', '#2F95A6', '#4C7DBF', '#7D5CB0', '#8E6CC9', '#B65A86', '#C2413A', '#D08A3C', '#B8962E', '#7E8C3A', '#7C8A85'];

// Every entry needs a category, so these two can't be hidden or deleted
export const FALLBACK_KEYS = { expense: 'other', income: 'other_income' };
