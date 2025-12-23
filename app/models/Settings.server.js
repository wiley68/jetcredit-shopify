import prisma from "../db.server";

/**
 * Get default settings from database
 * @returns {Promise<Object>} Settings object or default values
 */
export async function getSettings() {
  try {
    const settings = await prisma.settings.findUnique({
      where: { id: 'default' }
    });

    return settings || {
      id: 'default',
      jetStatusIn: true,
      jetEmail: 'online.shop@pbpf.bg',
      jetId: '',
      jetPurcent: 1.40,
      jetVnoskiDefault: 12,
      jetCardIn: true,
      jetPurcentCard: 1.00,
      jetCount: '',
      jetMinprice: 150,
      jetEur: 0,
    };
  } catch (error) {
    console.error('Error fetching settings:', error);
    throw new Error('Failed to fetch settings');
  }
}

/**
 * Update settings in database
 * @param {Object} updates - Object with fields to update
 * @returns {Promise<Object>} Updated settings object
 */
export async function updateSettings(updates) {
  try {
    const updatedSettings = await prisma.settings.update({
      where: { id: 'default' },
      data: updates
    });

    return updatedSettings;
  } catch (error) {
    console.error('Error updating settings:', error);
    throw new Error('Failed to update settings');
  }
}

/**
 * Toggle module status (jetStatusIn)
 * @param {boolean} status - New status value
 * @returns {Promise<Object>} Updated settings object
 */
export async function toggleModuleStatus(status) {
  try {
    const updatedSettings = await updateSettings({ jetStatusIn: status });
    return updatedSettings;
  } catch (error) {
    console.error('Error toggling module status:', error);
    throw new Error('Failed to toggle module status');
  }
}

/**
 * Get module status (jetStatusIn)
 * @returns {Promise<boolean>} Current module status
 */
export async function getModuleStatus() {
  try {
    const settings = await getSettings();
    return settings.jetStatusIn;
  } catch (error) {
    console.error('Error getting module status:', error);
    return true; // Default fallback
  }
}

/**
 * Reset settings to defaults
 * @returns {Promise<Object>} Reset settings object
 */
export async function resetSettingsToDefaults() {
  try {
    const defaultSettings = {
      jetStatusIn: true,
      jetEmail: 'online.shop@pbpf.bg',
      jetId: '',
      jetPurcent: 1.40,
      jetVnoskiDefault: 12,
      jetCardIn: true,
      jetPurcentCard: 1.00,
      jetCount: '',
      jetMinprice: 150,
      jetEur: 0,
    };

    const updatedSettings = await updateSettings(defaultSettings);
    return updatedSettings;
  } catch (error) {
    console.error('Error resetting settings:', error);
    throw new Error('Failed to reset settings');
  }
}
