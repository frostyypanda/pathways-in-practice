/**
 * DataManager.js
 * Handles fetching of synthesis data from the public /data directory.
 */

const DATA_ROOT = '/data';

export const DataManager = {
  /**
   * Fetches the master index of all syntheses.
   * @returns {Promise<Array>} List of synthesis metadata.
   */
  async getAllSyntheses() {
    try {
      const response = await fetch(`${DATA_ROOT}/index.json`);
      if (!response.ok) throw new Error('Failed to fetch index');
      return await response.json();
    } catch (error) {
      console.error('DataManager: Error fetching index', error);
      return [];
    }
  },

  /**
   * Fetches a specific synthesis by its file path.
   * @param {string} path - Relative path to the JSON file (e.g., /data/alkaloids/koumine.json)
   * @returns {Promise<Object|null>} The synthesis object or null if failed.
   */
  async getSynthesis(path) {
    try {
      // Ensure path starts with /
      const cleanPath = path.startsWith('/') ? path : `/${path}`;
      const response = await fetch(cleanPath);
      if (!response.ok) throw new Error(`Failed to fetch synthesis at ${cleanPath}`);
      return await response.json();
    } catch (error) {
      console.error(`DataManager: Error fetching synthesis at ${path}`, error);
      return null;
    }
  }
};
