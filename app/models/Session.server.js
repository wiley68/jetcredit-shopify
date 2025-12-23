import prisma from "../db.server";

/**
 * Get current session locale
 * @param {string} shop - Shop domain to identify session
 * @returns {Promise<string>} Locale code (e.g., 'en', 'bg') or 'en' as fallback
 */
export async function getCurrentSessionLocale(shop) {
  try {
    if (!shop) {
      return 'en'; // Default fallback
    }

    const session = await prisma.session.findFirst({
      where: { shop },
      select: { locale: true }
    });

    // Map Shopify locale to our supported languages
    const locale = session?.locale;

    if (!locale) {
      return 'en'; // Default fallback
    }

    // Normalize locale (e.g., 'en-US' -> 'en', 'bg-BG' -> 'bg')
    const normalizedLocale = locale.split('-')[0].toLowerCase();

    // Return supported language or fallback to English
    return ['en', 'bg'].includes(normalizedLocale) ? normalizedLocale : 'en';

  } catch (error) {
    console.error('Error getting session locale:', error);
    return 'en'; // Default fallback
  }
}

/**
 * Get current session info
 * @param {string} shop - Shop domain to identify session
 * @returns {Promise<Object|null>} Session object or null
 */
export async function getCurrentSession(shop) {
  try {
    if (!shop) {
      return null;
    }

    const session = await prisma.session.findFirst({
      where: { shop }
    });

    return session;
  } catch (error) {
    console.error('Error getting session:', error);
    return null;
  }
}

/**
 * Update session locale
 * @param {string} shop - Shop domain
 * @param {string} locale - New locale
 * @returns {Promise<Object>} Updated session object
 */
export async function updateSessionLocale(shop, locale) {
  try {
    const session = await prisma.session.updateMany({
      where: { shop },
      data: { locale }
    });

    return session;
  } catch (error) {
    console.error('Error updating session locale:', error);
    throw new Error('Failed to update session locale');
  }
}
