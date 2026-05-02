# Fama-French Regression Chrome Extension

A Chrome extension that runs Fama-French 5-factor regression analysis on stocks using monthly data.

## Installation

1. **Load the Extension in Chrome:**
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top right)
   - Click "Load unpacked"
   - Select this folder (`/Users/dbrito/Personal/FFRegression`)

2. **Pin the Extension:**
   - Click the puzzle piece icon in Chrome toolbar
   - Find "Fama-French Regression"
   - Click the pin icon to keep it visible

## Usage

### Running a Regression

1. Click the extension icon in your Chrome toolbar
2. Enter a stock ticker (e.g., AAPL, MSFT, GOOGL, IS3S.DE for international)
3. Select a time period (1M, 3M, 6M, 1Y, 2Y, 5Y, 10Y, 20Y)
4. Select region (Auto-detect, or choose manually)
5. Click "Run Regression"
6. View the results including:
   - R-squared and Adjusted R-squared
   - Factor loadings (Alpha, Market, Size, Value, Profitability, Investment)
   - Statistical significance levels (*, **, ***)
   - Number of observations

## Files

- `manifest.json` - Chrome extension configuration (Manifest V3)
- `popup.html` - Extension popup UI with tabs (Regression, Settings)
- `popup.css` - Styles for the popup
- `popup.js` - UI logic, event handlers, and data orchestration
- `dataFetcher.js` - Stock data fetching, FF parsing, currency conversion, data alignment
- `famaFrenchRegression.js` - OLS regression, matrix operations, p-value calculations
- `ffDataManager.js` - Fama-French data downloading, caching, and region detection
- `jszip.min.js` - ZIP file extraction library

## Features

- [x] Fetch monthly stock price data from Yahoo Finance
- [x] Auto-detect stock exchange and region
- [x] Automatic currency conversion to USD
- [x] Run 5-factor Fama-French regression
- [x] Display factor loadings with t-stats, p-values, and significance stars
- [x] Cache Fama-French factor data (auto-refresh every 30 days)
- [x] Support for multiple regions (N. America, Europe, Developed, Asia Pacific, Japan)
- [ ] Rolling factor loadings over 5Y periods (future enhancement)

## Data Sources

- **Stock Prices:** Yahoo Finance API (monthly adjusted close)
- **Fama-French Factors:** Ken French Data Library (monthly, auto-downloaded and cached)
- **Currency Conversion:** Yahoo Finance forex rates (e.g., EURUSD=X)

## Technical Details

- **Regression Method:** Ordinary Least Squares (OLS)
- **Data Frequency:** Monthly (matches F4RATK default and industry standard)
- **Factor Model:** Fama-French 5-factor (Market, Size, Value, Profitability, Investment)
- **Statistics:** R², Adjusted R², t-statistics, p-values
- **Validation:** Regression math validated against statsmodels and F4RATK

### Why Monthly Data?

Monthly data is the **industry standard** for factor analysis:
- Used by F4RATK, Portfolio Visualizer, and academic literature
- Less noise than daily data (no market microstructure effects)
- More stable factor estimates
- Standard frequency in Fama & French (1993, 2015) papers

**Example Results (AAPL, 5Y):**
- Monthly: R² = 50.16%, 57 observations
- Daily: R² = 60.75%, 1,211 observations (higher but noisier)

## Notes

- Extension requires internet connection to fetch data
- First run downloads and caches Fama-French factors (~500KB per region)
- Cache refreshes automatically after 30 days
- International stocks are automatically converted to USD
- Maximum period is 20 years due to Yahoo Finance API limitations (returns 240 months)
