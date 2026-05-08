/**
 * Data Fetcher for Stock Prices and Fama-French Factors
 * Uses Yahoo Finance for stock data
 */

class DataFetcher {
  /**
   * Fetch historical stock data from Yahoo Finance
   * @param {string} ticker - Stock ticker symbol
   * @param {string} period - Time period ('1y', '2y', '5y', '10y', 'max')
   * @returns {Promise<Object>} Object with dates and adjusted close prices
   */
  static async fetchYahooFinanceData(ticker, period = '5y') {
    // Common exchange suffixes to try if ticker not found
    const exchangeSuffixes = [
      '',      // Try without suffix first
      '.DE',   // XETRA (Germany)
      '.L',    // London Stock Exchange
      '.PA',   // Paris
      '.AS',   // Amsterdam
      '.MI',   // Milan
      '.TO',   // Toronto
      '.AX',   // Australia
      '.SW',   // Switzerland
      '.HK',   // Hong Kong
      '.T',    // Tokyo
      '.SI',   // Singapore
      '.BR',   // Brussels
    ];

    let lastError = null;

    // Try each suffix until we find the ticker
    for (const suffix of exchangeSuffixes) {
      const tickerWithSuffix = ticker + suffix;
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${tickerWithSuffix}?interval=1mo&range=${period}`;

      try {
        const response = await fetch(url);

        if (!response.ok) {
          if (response.status === 404) {
            lastError = new Error(`Ticker "${ticker}" not found on any supported exchange.`);
            continue; // Try next suffix
          }
          throw new Error(`Unable to fetch data for ${tickerWithSuffix} (Error ${response.status})`);
        }

        const data = await response.json();

        if (data.chart.error) {
          lastError = new Error(`Unable to fetch data: ${data.chart.error.description}`);
          continue; // Try next suffix
        }

        const result = data.chart.result[0];

        // Validate that required data exists
        if (!result.timestamp || !result.indicators || !result.indicators.adjclose) {
          lastError = new Error(`No price data available for ${tickerWithSuffix}`);
          continue; // Try next suffix
        }

        const timestamps = result.timestamp;
        const prices = result.indicators.adjclose[0].adjclose;

        // Convert timestamps to dates and filter out null prices
        // For monthly data: Yahoo returns timestamps at midnight on first day of month
        // But timezone conversion can shift the date backwards. Add 12 hours to avoid this.
        const priceData = timestamps
          .map((ts, i) => {
            // Add 12 hours to avoid timezone issues (43200 seconds = 12 hours)
            const dateObj = new Date((ts + 43200) * 1000);
            const actualDate = dateObj.toISOString().split('T')[0];

            // Normalize to first day of month
            const [y, m, d] = actualDate.split('-');
            const date = `${y}-${m}-01`;
            return {
              date: date,
              price: prices[i]
            };
          })
          .filter(item => item.price !== null);

        // Success! Return the data with the actual ticker used
        return {
          ticker: tickerWithSuffix,
          currency: result.meta.currency,
          instrumentType: result.meta.instrumentType || 'EQUITY',
          longName: result.meta.longName || '',
          data: priceData
        };

      } catch (error) {
        lastError = error;
        // If it's not a 404, don't try other suffixes
        if (!error.message.includes('not found')) {
          throw error;
        }
        // Otherwise continue to next suffix
      }
    }

    // If we get here, none of the suffixes worked
    console.error(`Error fetching data for ${ticker}:`, lastError);
    throw lastError;
  }

  /**
   * Calculate returns from price data
   * @param {Array<Object>} priceData - Array of {date, price}
   * @returns {Array<Object>} Array of {date, return}
   */
  static calculateReturns(priceData) {
    const returns = [];

    for (let i = 1; i < priceData.length; i++) {
      const currentPrice = priceData[i].price;
      const previousPrice = priceData[i - 1].price;
      const returnValue = (currentPrice - previousPrice) / previousPrice;

      returns.push({
        date: priceData[i].date,
        return: returnValue
      });
    }

    return returns;
  }

  /**
   * Parse Fama-French CSV data
   * @param {string} csvText - CSV file content
   * @param {boolean} isDaily - Whether this is daily data (vs monthly)
   * @returns {Array<Object>} Array of {date, factors}
   */
  static parseFamaFrenchCSV(csvText, isDaily = true) {
    const lines = csvText.trim().split('\n');
    const data = [];

    let dataStarted = false;

    for (const line of lines) {
      // Skip until we find the data section
      if (!dataStarted) {
        // Daily files start with a date like "19260701" or have leading comma
        // Monthly files start with a date like "192607"
        const trimmed = line.trim();
        if (isDaily && (/^\d{8}/.test(trimmed) || /^,?\d{8}/.test(trimmed))) {
          dataStarted = true;
        } else if (!isDaily && /^\d{6}/.test(trimmed)) {
          dataStarted = true;
        } else {
          continue;
        }
      }

      // Stop if we hit the end marker or empty line
      if (line.trim() === '' || line.includes('Copyright')) {
        break;
      }

      // Split by comma and/or whitespace, filter empty strings
      const parts = line.trim().split(/[\s,]+/).filter(p => p);

      if (parts.length < 4) continue; // Need at least date + 3 factors

      const dateStr = parts[0];
      let date;

      if (isDaily) {
        // Format: YYYYMMDD
        const year = dateStr.substring(0, 4);
        const month = dateStr.substring(4, 6);
        const day = dateStr.substring(6, 8);
        date = `${year}-${month}-${day}`;
      } else {
        // Format: YYYYMM
        const year = dateStr.substring(0, 4);
        const month = dateStr.substring(4, 6);
        date = `${year}-${month}-01`;
      }

      // Convert percentages to decimals
      const mktRf = parseFloat(parts[1]) / 100;
      const smb = parseFloat(parts[2]) / 100;
      const hml = parseFloat(parts[3]) / 100;

      // Check for 5-factor data (RMW, CMA, RF)
      // 5-factor format: Date, MKT-RF, SMB, HML, RMW, CMA, RF
      // 3-factor format: Date, MKT-RF, SMB, HML, RF
      let rf, rmw, cma;
      if (parts.length >= 7) {
        // 5-factor model: RF is at position 7 (index 6)
        rmw = parseFloat(parts[4]) / 100;
        cma = parseFloat(parts[5]) / 100;
        rf = parseFloat(parts[6]) / 100;
      } else if (parts.length >= 5) {
        // 3-factor model: RF is at position 5 (index 4)
        rf = parseFloat(parts[4]) / 100;
        rmw = null;
        cma = null;
      } else {
        continue; // Not enough data
      }

      data.push({
        date: date,
        mktRf: mktRf,
        smb: smb,
        hml: hml,
        rf: rf,
        rmw: rmw,
        cma: cma
      });
    }

    return data;
  }

  /**
   * Align stock returns with Fama-French factor data
   * @param {Array<Object>} stockReturns - Array of {date, return}
   * @param {Array<Object>} ffData - Array of {date, mktRf, smb, hml, rf, ...}
   * @returns {Object} Aligned data ready for regression
   */
  static alignData(stockReturns, ffData) {
    // Create a map of factor data by date for quick lookup
    const ffMap = new Map();
    ffData.forEach(item => {
      ffMap.set(item.date, item);
    });

    const alignedData = [];

    for (const stockItem of stockReturns) {
      const factors = ffMap.get(stockItem.date);

      if (factors) {
        // Calculate excess return (stock return - risk-free rate)
        const excessReturn = stockItem.return - factors.rf;

        alignedData.push({
          date: stockItem.date,
          excessReturn: excessReturn,
          mktRf: factors.mktRf,
          smb: factors.smb,
          hml: factors.hml,
          rmw: factors.rmw,
          cma: factors.cma,
          rf: factors.rf,
          stockReturn: stockItem.return
        });
      }
    }

    return alignedData;
  }

  /**
   * Prepare data for regression
   * @param {Array<Object>} alignedData - Output from alignData()
   * @param {boolean} fiveFactor - Use 5-factor model (default: false for 3-factor)
   * @returns {Object} {excessReturns, factors}
   */
  static prepareRegressionData(alignedData, fiveFactor = false) {
    const excessReturns = alignedData.map(d => d.excessReturn);

    const factors = alignedData.map(d => {
      if (fiveFactor && d.rmw !== null && d.cma !== null) {
        return [d.mktRf, d.smb, d.hml, d.rmw, d.cma];
      } else {
        return [d.mktRf, d.smb, d.hml];
      }
    });

    return {
      excessReturns: excessReturns,
      factors: factors,
      dates: alignedData.map(d => d.date)
    };
  }

  /**
   * Convert prices to USD if needed
   * @param {Array<Object>} priceData - Array of {date, price}
   * @param {string} currency - Currency code (e.g., 'EUR', 'GBP')
   * @param {string} period - Time period for FX data
   * @returns {Promise<Object>} {data: Array<Object>, conversionFailed: boolean}
   */
  static async convertToUSD(priceData, currency, period) {
    if (currency === 'USD') {
      return { data: priceData, conversionFailed: false }; // Already in USD
    }

    // Map common currencies to Yahoo Finance forex symbols
    const forexSymbol = `${currency}USD=X`;

    try {
      console.log(`Converting ${currency} to USD using ${forexSymbol}`);

      // Fetch FX rates
      const fxData = await this.fetchYahooFinanceData(forexSymbol, period);

      // Create a map of FX rates by date
      const fxMap = new Map();
      fxData.data.forEach(item => {
        fxMap.set(item.date, item.price);
      });

      // Convert prices
      const convertedData = [];
      for (const item of priceData) {
        const fxRate = fxMap.get(item.date);
        if (fxRate) {
          convertedData.push({
            date: item.date,
            price: item.price * fxRate // Convert to USD
          });
        }
      }

      console.log(`Converted ${convertedData.length} prices from ${currency} to USD`);

      return { data: convertedData, conversionFailed: false };

    } catch (error) {
      console.warn(`Failed to convert ${currency} to USD:`, error);
      console.warn('Proceeding with original currency - results may be less accurate');
      return { data: priceData, conversionFailed: true }; // Fall back to original currency
    }
  }

  /**
   * Complete workflow: Fetch stock data and run regression
   * @param {string} ticker - Stock ticker
   * @param {string} ffCSV - Fama-French CSV text (optional, can be fetched automatically)
   * @param {string} period - Time period for stock data
   * @param {boolean} fiveFactor - Use 5-factor model
   * @param {string} region - Region for factor data (optional, auto-detected)
   * @param {boolean} convertToUSD - Whether to convert foreign currencies to USD (default: true)
   * @returns {Promise<Object>} Complete regression results
   */
  static async fetchAndPrepare(ticker, ffCSV, period = '5y', fiveFactor = false, region = null, convertToUSD = true) {
    // Fetch stock data
    const stockData = await this.fetchYahooFinanceData(ticker, period);

    // Auto-detect region if not provided
    if (!region && typeof FFDataManager !== 'undefined') {
      const metadata = {
        instrumentType: stockData.instrumentType,
        longName: stockData.longName
      };
      region = FFDataManager.getRegionFromTicker(stockData.ticker, metadata);
    }

    // Convert to USD if needed and requested
    let priceData = stockData.data;
    let currencyNote = '';
    let conversionFailed = false;
    if (convertToUSD && stockData.currency !== 'USD') {
      const conversionResult = await this.convertToUSD(stockData.data, stockData.currency, period);
      priceData = conversionResult.data;
      conversionFailed = conversionResult.conversionFailed;

      if (conversionFailed) {
        currencyNote = ` (${stockData.currency} - CONVERSION FAILED)`;
      } else {
        currencyNote = ` (converted from ${stockData.currency})`;
      }
    } else if (!convertToUSD && stockData.currency !== 'USD') {
      currencyNote = ` (${stockData.currency}, not converted)`;
    }

    // Calculate returns
    const returns = this.calculateReturns(priceData);

    // Parse FF data (monthly)
    const ffData = this.parseFamaFrenchCSV(ffCSV, false);

    // Align data
    const aligned = this.alignData(returns, ffData);

    // Prepare for regression
    const regressionData = this.prepareRegressionData(aligned, fiveFactor);

    return {
      ticker: stockData.ticker, // Use the actual ticker with exchange suffix
      originalTicker: ticker,    // Keep the original input ticker
      currency: stockData.currency,
      currencyNote: currencyNote,
      region: region,
      period: period,
      dataPoints: aligned.length,
      instrumentType: stockData.instrumentType,
      ...regressionData
    };
  }
}

// Export for use in Chrome extension
if (typeof module !== 'undefined' && module.exports) {
  module.exports = DataFetcher;
}
