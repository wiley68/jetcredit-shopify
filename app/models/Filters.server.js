import prisma from "../db.server";

/**
 * Get all filters from database
 * @returns {Promise<Array>} Array of filter objects
 */
export async function getFilters() {
  try {
    const filters = await prisma.filters.findMany({
      orderBy: { createdAt: 'desc' }
    });
    return filters;
  } catch (error) {
    console.error('Error fetching filters:', error);
    throw new Error('Failed to fetch filters');
  }
}

/**
 * Get filter by ID
 * @param {number} id - Filter ID
 * @returns {Promise<Object|null>} Filter object or null
 */
export async function getFilterById(id) {
  try {
    const filter = await prisma.filters.findUnique({
      where: { id: parseInt(id) }
    });
    return filter;
  } catch (error) {
    console.error('Error fetching filter:', error);
    throw new Error('Failed to fetch filter');
  }
}

/**
 * Create new filter
 * @param {Object} filterData - Filter data
 * @returns {Promise<Object>} Created filter object
 */
export async function createFilter(filterData) {
  try {
    const filter = await prisma.filters.create({
      data: filterData
    });
    return filter;
  } catch (error) {
    console.error('Error creating filter:', error);
    throw new Error('Failed to create filter');
  }
}

/**
 * Update filter by ID
 * @param {number} id - Filter ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object>} Updated filter object
 */
export async function updateFilter(id, updates) {
  try {
    const filter = await prisma.filters.update({
      where: { id: parseInt(id) },
      data: updates
    });
    return filter;
  } catch (error) {
    console.error('Error updating filter:', error);
    throw new Error('Failed to update filter');
  }
}

/**
 * Delete filter by ID
 * @param {number} id - Filter ID
 * @returns {Promise<Object>} Deleted filter object
 */
export async function deleteFilter(id) {
  try {
    const filter = await prisma.filters.delete({
      where: { id: parseInt(id) }
    });
    return filter;
  } catch (error) {
    console.error('Error deleting filter:', error);
    throw new Error('Failed to delete filter');
  }
}

/**
 * Get active filters (within date range and matching criteria)
 * @param {Object} criteria - Search criteria
 * @returns {Promise<Array>} Array of active filters
 */
export async function getActiveFilters(criteria = {}) {
  try {
    const now = new Date();
    const filters = await prisma.filters.findMany({
      where: {
        AND: [
          { jetProductStart: { lte: now } },
          { jetProductEnd: { gte: now } },
          criteria.jetProductId ? { jetProductId: criteria.jetProductId } : {},
          criteria.price ? { jetProductPrice: { lte: criteria.price } } : {}
        ]
      },
      orderBy: { createdAt: 'desc' }
    });
    return filters;
  } catch (error) {
    console.error('Error fetching active filters:', error);
    throw new Error('Failed to fetch active filters');
  }
}
