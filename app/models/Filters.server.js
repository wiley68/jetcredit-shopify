import prisma from "../db.server";

/**
 * Get all filters from database
 * @returns {Promise<Array>} Array of filter objects
 */
export async function getFilters() {
  try {
    return await prisma.filters.findMany({
      orderBy: { createdAt: "desc" },
    });
  } catch (error) {
    console.error("Error fetching filters:", error);
    throw new Error("Failed to fetch filters");
  }
}

/**
 * Get filter by ID
 * @param {number|string} id - Filter ID
 * @returns {Promise<Object|null>} Filter object or null
 */
export async function getFilterById(id) {
  try {
    return await prisma.filters.findUnique({
      where: { id: Number.parseInt(id, 10) },
    });
  } catch (error) {
    console.error("Error fetching filter:", error);
    throw new Error("Failed to fetch filter");
  }
}

/**
 * Create new filter
 * NOTE: expects Date objects for jetProductStart/jetProductEnd
 * @param {Object} filterData - Filter data
 * @returns {Promise<Object>} Created filter object
 */
export async function createFilter(filterData) {
  try {
    // No extra conversion needed if action sends Date objects
    return await prisma.filters.create({
      data: filterData,
    });
  } catch (error) {
    console.error("Error creating filter:", error);
    throw new Error("Failed to create filter");
  }
}

/**
 * Update filter by ID
 * @param {number|string} id - Filter ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object>} Updated filter object
 */
export async function updateFilter(id, updates) {
  try {
    // If updates contain date strings, convert them safely; if already Date, keep them.
    const processedUpdates = { ...updates };

    if (typeof processedUpdates.jetProductStart === "string") {
      processedUpdates.jetProductStart = new Date(processedUpdates.jetProductStart);
    }
    if (typeof processedUpdates.jetProductEnd === "string") {
      processedUpdates.jetProductEnd = new Date(processedUpdates.jetProductEnd);
    }

    return await prisma.filters.update({
      where: { id: Number.parseInt(id, 10) },
      data: processedUpdates,
    });
  } catch (error) {
    console.error("Error updating filter:", error);
    throw new Error("Failed to update filter");
  }
}

/**
 * Delete filter by ID
 * @param {number|string} id - Filter ID
 * @returns {Promise<Object>} Deleted filter object
 */
export async function deleteFilter(id) {
  try {
    return await prisma.filters.delete({
      where: { id: Number.parseInt(id, 10) },
    });
  } catch (error) {
    console.error("Error deleting filter:", error);
    throw new Error("Failed to delete filter");
  }
}

/**
 * Get active filters (within date range and matching criteria)
 * - includes "*" filters when jetProductId is provided
 * @param {Object} criteria - Search criteria
 * @param {string=} criteria.jetProductId
 * @param {number=} criteria.price
 * @returns {Promise<Array>} Array of active filters
 */
export async function getActiveFilters(criteria = {}) {
  try {
    const now = new Date();

    const andConditions = [
      { jetProductStart: { lte: now } },
      { jetProductEnd: { gte: now } },
    ];

    if (criteria.jetProductId) {
      andConditions.push({
        jetProductId: { in: [criteria.jetProductId, "*"] },
      });
    }

    if (typeof criteria.price === "number" && Number.isFinite(criteria.price)) {
      andConditions.push({
        jetProductPrice: { lte: criteria.price },
      });
    }

    return await prisma.filters.findMany({
      where: { AND: andConditions },
      orderBy: [{ jetProductId: "asc" }, { createdAt: "desc" }],
    });
  } catch (error) {
    console.error("Error fetching active filters:", error);
    throw new Error("Failed to fetch active filters");
  }
}
