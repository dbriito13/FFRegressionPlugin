# Fama-French Regression Chrome Extension

Chrome extension for running Fama-French 5-factor regression on stocks and ETFs with automatic global region detection.

## Features

- **5-Factor Regression**: Market, Size, Value, Profitability, Investment
- **Auto Region Detection**: 7 regions (N. America, Europe, Asia Pacific, Japan, Emerging, Developed, Developed ex-US)
- **Smart ETF Detection**: Analyzes fund names (e.g., "MSCI EM" → Emerging Markets)
- **Currency Conversion**: Auto-converts to USD with forex rates
- **Visual Results**: Table + confidence interval chart, copy to markdown
- **Keyboard Shortcut**: Select ticker → Ctrl+J/Cmd+J → instant regression
- **30-Day Cache**: Fama-French factors cached locally

## Quick Start

1. Load extension: `chrome://extensions/` → Developer mode → Load unpacked
2. Click icon or press Ctrl+J/Cmd+J on selected ticker
3. View regression table, factor chart, and model stats

## Data Sources

- Stock prices: Yahoo Finance (monthly adjusted close)
- Factors: Ken French Data Library (Dartmouth)
- Forex: Yahoo Finance currency pairs

## Technical

- **Method**: OLS regression with matrix inversion
- **Frequency**: Monthly (industry standard, matches F4RATK/Portfolio Visualizer)
- **Output**: Coefficients, t-stats, p-values, R², 95% confidence intervals
- **Validation**: Tested against Python statsmodels
