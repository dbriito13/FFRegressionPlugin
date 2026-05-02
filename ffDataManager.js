/**
 * Fama-French Data Manager
 * Handles fetching, caching, and managing FF factor data
 */

class FFDataManager {
  // Regional factor data URLs (monthly)
  static FACTOR_URLS = {
    'north_america': 'https://mba.tuck.dartmouth.edu/pages/faculty/ken.french/ftp/F-F_Research_Data_5_Factors_2x3_CSV.zip',
    'developed': 'https://mba.tuck.dartmouth.edu/pages/faculty/ken.french/ftp/Developed_5_Factors_CSV.zip',
    'developed_ex_us': 'https://mba.tuck.dartmouth.edu/pages/faculty/ken.french/ftp/Developed_ex_US_5_Factors_CSV.zip',
    'europe': 'https://mba.tuck.dartmouth.edu/pages/faculty/ken.french/ftp/Europe_5_Factors_CSV.zip',
    'asia_pacific': 'https://mba.tuck.dartmouth.edu/pages/faculty/ken.french/ftp/Asia_Pacific_ex_Japan_5_Factors_CSV.zip',
    'japan': 'https://mba.tuck.dartmouth.edu/pages/faculty/ken.french/ftp/Japan_5_Factors_CSV.zip'
    // Note: Using monthly data to match F4RATK default and Portfolio Visualizer
  };

  static CACHE_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

  /**
   * Determine region from ticker exchange suffix
   * @param {string} ticker - Ticker symbol with exchange suffix
   * @returns {string} Region identifier
   */
  static getRegionFromTicker(ticker) {
    if (!ticker.includes('.')) {
      return 'north_america'; // US stocks (no suffix)
    }

    const suffix = ticker.split('.').pop().toUpperCase();

    // Map exchange suffixes to regions
    const exchangeToRegion = {
      // Europe
      'DE': 'europe',     // Germany (XETRA)
      'L': 'europe',      // London
      'PA': 'europe',     // Paris
      'AS': 'europe',     // Amsterdam
      'MI': 'europe',     // Milan
      'SW': 'europe',     // Switzerland
      'BR': 'europe',     // Brussels
      'MC': 'europe',     // Madrid
      'LS': 'europe',     // Lisbon
      'VI': 'europe',     // Vienna
      'CO': 'europe',     // Copenhagen
      'ST': 'europe',     // Stockholm
      'HE': 'europe',     // Helsinki
      'OL': 'europe',     // Oslo

      // Asia Pacific (ex Japan)
      'HK': 'asia_pacific', // Hong Kong
      'SI': 'asia_pacific', // Singapore
      'AX': 'asia_pacific', // Australia
      'NZ': 'asia_pacific', // New Zealand
      'KS': 'asia_pacific', // Korea
      'KQ': 'asia_pacific', // Korea KOSDAQ

      // Japan
      'T': 'japan',       // Tokyo

      // North America
      'TO': 'north_america', // Toronto
      'V': 'north_america',  // Vancouver
    };

    return exchangeToRegion[suffix] || 'developed'; // Default to developed markets if unknown
  }

  /**
   * Fetch and cache Fama-French data for a specific region
   * @param {string} region - Region identifier
   * @returns {Promise<string>} CSV text data
   */
  static async fetchAndCacheFFData(region = 'north_america') {
    const url = this.FACTOR_URLS[region];
    if (!url) {
      throw new Error(`Unknown region: ${region}`);
    }

    const cacheKey = `ff_5_factor_monthly_${region}`;
    const timestampKey = `ff_5_factor_monthly_${region}_timestamp`;

    try {
      console.log(`Fetching FF data from ${url}`);

      // Fetch the zip file
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch FF data: ${response.status}`);
      }

      const arrayBuffer = await response.arrayBuffer();

      // Unzip using JSZip
      const zip = await JSZip.loadAsync(arrayBuffer);

      // Get the CSV file (should be only one file in the zip)
      const csvFileName = Object.keys(zip.files)[0];
      if (!csvFileName) {
        throw new Error('No CSV file found in zip');
      }

      const csvText = await zip.files[csvFileName].async('text');

      // Cache the data
      await this.cacheData(cacheKey, csvText, timestampKey);

      console.log(`Successfully fetched and cached FF data (${csvText.length} bytes)`);

      return csvText;

    } catch (error) {
      console.error('Error fetching FF data:', error);
      throw error;
    }
  }

  /**
   * Get FF data from cache or fetch if needed
   * @param {string} region - Region identifier
   * @param {boolean} forceRefresh - Force refresh even if cache is valid
   * @returns {Promise<string>} CSV text data
   */
  static async getFFData(region = 'north_america', forceRefresh = false) {
    const cacheKey = `ff_5_factor_monthly_${region}`;
    const timestampKey = `ff_5_factor_monthly_${region}_timestamp`;

    if (!forceRefresh) {
      // Check cache first
      const cachedData = await this.getCachedData(cacheKey, timestampKey);
      if (cachedData) {
        console.log(`Using cached FF data for ${region}`);
        return cachedData;
      }
    }

    // Cache miss or force refresh - fetch new data
    console.log(`Cache miss or force refresh - fetching new FF data for ${region}`);
    return await this.fetchAndCacheFFData(region);
  }

  /**
   * Check if cached data is still valid
   * @param {string} timestampKey
   * @returns {Promise<boolean>}
   */
  static async isCacheValid(timestampKey) {
    try {
      const result = await chrome.storage.local.get(timestampKey);
      const timestamp = result[timestampKey];

      if (!timestamp) {
        return false;
      }

      const now = Date.now();
      const age = now - timestamp;

      return age < this.CACHE_DURATION_MS;
    } catch (error) {
      console.error('Error checking cache validity:', error);
      return false;
    }
  }

  /**
   * Get cached data if valid
   * @param {string} cacheKey
   * @param {string} timestampKey
   * @returns {Promise<string|null>}
   */
  static async getCachedData(cacheKey, timestampKey) {
    try {
      const isValid = await this.isCacheValid(timestampKey);
      if (!isValid) {
        return null;
      }

      const result = await chrome.storage.local.get(cacheKey);
      return result[cacheKey] || null;

    } catch (error) {
      console.error('Error getting cached data:', error);
      return null;
    }
  }

  /**
   * Cache data in Chrome storage
   * @param {string} cacheKey
   * @param {string} data
   * @param {string} timestampKey
   */
  static async cacheData(cacheKey, data, timestampKey) {
    try {
      const storageData = {
        [cacheKey]: data,
        [timestampKey]: Date.now()
      };

      await chrome.storage.local.set(storageData);
      console.log('Successfully cached FF data');

    } catch (error) {
      console.error('Error caching data:', error);
      throw error;
    }
  }

  /**
   * Clear cached FF data for all regions
   */
  static async clearCache() {
    try {
      const regions = Object.keys(this.FACTOR_URLS);
      const keysToRemove = [];

      regions.forEach(region => {
        keysToRemove.push(`ff_5_factor_${region}`);
        keysToRemove.push(`ff_5_factor_${region}_timestamp`);
      });

      await chrome.storage.local.remove(keysToRemove);
      console.log('Cache cleared for all regions');
    } catch (error) {
      console.error('Error clearing cache:', error);
    }
  }

  /**
   * Get cache status for all regions
   * @returns {Promise<Object>} Cache status info
   */
  static async getCacheStatus() {
    const status = {};
    const regions = Object.keys(this.FACTOR_URLS);

    try {
      for (const region of regions) {
        const cacheKey = `ff_5_factor_${region}`;
        const timestampKey = `ff_5_factor_${region}_timestamp`;

        const result = await chrome.storage.local.get([cacheKey, timestampKey]);

        status[region] = {
          cached: false,
          timestamp: null,
          age: null,
          valid: false
        };

        if (result[cacheKey]) {
          status[region].cached = true;
          status[region].timestamp = result[timestampKey];
          status[region].age = Date.now() - result[timestampKey];
          status[region].valid = status[region].age < this.CACHE_DURATION_MS;
        }
      }

      return status;

    } catch (error) {
      console.error('Error getting cache status:', error);
      return status;
    }
  }

  /**
   * Get user-friendly region name
   */
  static getRegionDisplayName(region) {
    const names = {
      'north_america': 'North America',
      'developed': 'Developed Markets',
      'developed_ex_us': 'Developed ex US',
      'europe': 'Europe',
      'asia_pacific': 'Asia Pacific',
      'japan': 'Japan'
    };
    return names[region] || region;
  }
}

// Export for use in Chrome extension
if (typeof module !== 'undefined' && module.exports) {
  module.exports = FFDataManager;
}
