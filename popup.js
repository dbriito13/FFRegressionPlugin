document.addEventListener('DOMContentLoaded', async function() {
    const runRegressionBtn = document.getElementById('runRegressionBtn');
    const tickerInput = document.getElementById('ticker');
    const periodSelect = document.getElementById('period');
    const regionSelect = document.getElementById('region');
    const statusDiv = document.getElementById('status');
    const regressionResultsDiv = document.getElementById('regressionResults');

    const cacheStatusText = document.getElementById('cacheStatus');
    const downloadFFBtn = document.getElementById('downloadFFBtn');
    const clearCacheBtn = document.getElementById('clearCacheBtn');

    let ffDataCache = {}; // Cache by region

    // Tab switching
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabButtons.forEach(button => {
        button.addEventListener('click', function() {
            const tabName = this.getAttribute('data-tab');

            // Remove active class from all buttons and contents
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));

            // Add active class to clicked button and corresponding content
            this.classList.add('active');
            document.getElementById(`${tabName}-tab`).classList.add('active');
        });
    });

    // Check cache status on load
    await updateCacheStatus();

    // Download FF data button (downloads all regions)
    downloadFFBtn.addEventListener('click', async function() {
        downloadFFBtn.disabled = true;
        const originalText = downloadFFBtn.textContent;

        try {
            const regions = ['north_america', 'developed', 'developed_ex_us', 'europe', 'asia_pacific', 'japan'];
            let downloaded = 0;

            for (const region of regions) {
                downloadFFBtn.textContent = `Downloading ${FFDataManager.getRegionDisplayName(region)}...`;
                await FFDataManager.getFFData(region, true); // Force refresh
                downloaded++;
            }

            await updateCacheStatus();
            alert(`✓ Downloaded factor data for all ${downloaded} regions!`);

        } catch (error) {
            console.error('Error downloading FF data:', error);
            alert('Error downloading FF data: ' + error.message);
        } finally {
            downloadFFBtn.disabled = false;
            downloadFFBtn.textContent = originalText;
        }
    });

    // Clear cache button
    clearCacheBtn.addEventListener('click', async function() {
        if (!confirm('Are you sure you want to clear the cache for all regions?')) {
            return;
        }

        await FFDataManager.clearCache();
        ffDataCache = {};
        await updateCacheStatus();
        alert('Cache cleared for all regions');
    });

    // Run regression
    runRegressionBtn.addEventListener('click', async function() {
        const ticker = tickerInput.value.trim().toUpperCase();
        const period = periodSelect.value;
        let selectedRegion = regionSelect.value;

        if (!ticker) {
            showStatus('Please enter a ticker symbol', 'error');
            return;
        }

        runRegressionBtn.disabled = true;
        showStatus(`Preparing data for ${ticker}...`, 'loading');
        regressionResultsDiv.classList.remove('show');
        regressionResultsDiv.innerHTML = '';

        try {
            // First fetch stock data to detect region if auto
            showStatus(`Fetching stock data for ${ticker}...`, 'loading');
            const stockDataPreview = await DataFetcher.fetchYahooFinanceData(ticker, period);

            let region, regionSource;
            if (selectedRegion === 'auto') {
                region = FFDataManager.getRegionFromTicker(stockDataPreview.ticker);
                regionSource = 'auto-detected';
                console.log(`Auto-detected region: ${region}`);

                // Update the select to show the detected region (but keep it on 'auto')
                // This helps user see what was detected
            } else {
                region = selectedRegion;
                regionSource = 'user-selected';
                console.log(`User-selected region: ${region}`);
            }

            const regionName = FFDataManager.getRegionDisplayName(region);

            // Check cache validity for this region
            const cacheStatus = await FFDataManager.getCacheStatus();
            const needsRefresh = !cacheStatus[region] || !cacheStatus[region].cached || !cacheStatus[region].valid;

            // Check if FF data is available or stale for this region
            if (!ffDataCache[region] || needsRefresh) {
                if (needsRefresh && cacheStatus[region]?.cached) {
                    showStatus(`Refreshing ${regionName} factor data...`, 'loading');
                } else {
                    showStatus(`Downloading ${regionName} factor data...`, 'loading');
                }
                ffDataCache[region] = await FFDataManager.getFFData(region, needsRefresh);
                await updateCacheStatus();
            }

            showStatus(`Running regression for ${ticker} (${regionName})...`, 'loading');

            // Fetch and prepare data
            const preparedData = await DataFetcher.fetchAndPrepare(
                ticker,
                ffDataCache[region],
                period,
                true, // Use 5-factor model
                region
            );

            console.log('Prepared data:', preparedData);

            if (preparedData.dataPoints === 0) {
                throw new Error('No matching data points found. The date ranges may not overlap.');
            }

            // Run 5-factor regression
            const results = FamaFrenchRegression.fiveFactorRegression(
                preparedData.excessReturns,
                preparedData.factors
            );

            console.log('Regression results:', results);

            // Hide status and display results
            statusDiv.classList.remove('show');

            // Display results
            displayRegressionResults(preparedData.ticker, period, preparedData.dataPoints, preparedData.currencyNote, preparedData.region, regionSource, results);

        } catch (error) {
            console.error('Error running regression:', error);
            showStatus(`Error: ${error.message}`, 'error');
        } finally {
            runRegressionBtn.disabled = false;
        }
    });

    async function updateCacheStatus() {
        const status = await FFDataManager.getCacheStatus();
        const regions = Object.keys(status);

        let cachedCount = 0;
        let validCount = 0;
        let oldestAge = 0;

        regions.forEach(region => {
            if (status[region].cached) {
                cachedCount++;
                if (status[region].valid) {
                    validCount++;
                    if (status[region].age > oldestAge) {
                        oldestAge = status[region].age;
                    }
                }
            }
        });

        if (cachedCount === 0) {
            cacheStatusText.textContent = 'No data cached. Will download on first run.';
            cacheStatusText.classList.remove('loaded');
        } else if (validCount === cachedCount) {
            const ageInDays = Math.floor(oldestAge / (1000 * 60 * 60 * 24));
            cacheStatusText.textContent = `✓ ${cachedCount} region(s) cached (oldest: ${ageInDays} days)`;
            cacheStatusText.classList.add('loaded');
        } else {
            cacheStatusText.textContent = `⚠ ${cachedCount} region(s) cached, ${cachedCount - validCount} stale`;
            cacheStatusText.classList.remove('loaded');
        }
    }

    function showStatus(message, type) {
        statusDiv.textContent = message;
        statusDiv.className = `status show ${type}`;
    }

    function displayRegressionResults(ticker, period, dataPoints, currencyNote, region, regionSource, results) {
        const regionName = FFDataManager.getRegionDisplayName(region);
        const regionDisplay = regionSource === 'auto-detected' ? `${regionName} (auto)` : regionName;
        const factors = [
            { name: 'Alpha (α)', key: 'alpha', desc: 'Excess return (intercept)' },
            { name: 'Market (MKT-RF)', key: 'betaMKT', desc: 'Market factor' },
            { name: 'Size (SMB)', key: 'betaSMB', desc: 'Small minus big' },
            { name: 'Value (HML)', key: 'betaHML', desc: 'High minus low' },
            { name: 'Profitability (RMW)', key: 'betaRMW', desc: 'Robust minus weak' },
            { name: 'Investment (CMA)', key: 'betaCMA', desc: 'Conservative minus aggressive' }
        ];

        let tableHTML = `
            <h3>Fama-French 5-Factor Regression: ${ticker}${currencyNote}</h3>
            <p style="font-size: 12px; color: #666; margin: 5px 0 10px 0;">
                Region: ${regionDisplay} | Period: ${period} | Observations: ${dataPoints}
            </p>
            <table class="regression-table">
                <thead>
                    <tr>
                        <th>Factor</th>
                        <th>Coefficient</th>
                        <th>t-Stat</th>
                        <th>p-Value</th>
                        <th>Sig</th>
                    </tr>
                </thead>
                <tbody>
        `;

        factors.forEach(factor => {
            const coef = results[factor.key];
            const tStat = results.tStats[factor.key];
            const pVal = results.pValues[factor.key];
            const sig = results.significance[factor.key];

            const coefClass = coef > 0 ? 'positive' : 'negative';

            tableHTML += `
                <tr>
                    <td title="${factor.desc}">${factor.name}</td>
                    <td class="${coefClass}">${coef.toFixed(4)}</td>
                    <td>${tStat.toFixed(2)}</td>
                    <td>${pVal.toFixed(4)}</td>
                    <td class="sig-stars">${sig}</td>
                </tr>
            `;
        });

        tableHTML += `
                </tbody>
            </table>
        `;

        const statsHTML = `
            <div class="model-stats">
                <p><strong>Model Statistics</strong></p>
                <p>R²: ${(results.rSquared * 100).toFixed(2)}% | Adjusted R²: ${(results.adjustedRSquared * 100).toFixed(2)}%</p>
                <p>Degrees of Freedom: ${results.degreesOfFreedom}</p>
            </div>
        `;

        const legendHTML = `
            <div class="sig-legend">
                <p><strong>Significance Levels:</strong></p>
                <p>*** p < 0.01 (1%) | ** p < 0.05 (5%) | * p < 0.10 (10%)</p>
            </div>
        `;

        regressionResultsDiv.innerHTML = tableHTML + statsHTML + legendHTML;
        regressionResultsDiv.classList.add('show');
    }
});
