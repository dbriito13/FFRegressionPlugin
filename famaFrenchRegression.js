/**
 * Fama-French Regression Calculator
 * Performs OLS regression for 3-factor or 5-factor models
 */

class FamaFrenchRegression {
  /**
   * Perform 3-factor regression: R - Rf = α + β1(MKT-RF) + β2(SMB) + β3(HML) + ε
   * @param {Array<number>} excessReturns - Stock returns minus risk-free rate
   * @param {Array<Array<number>>} factors - [MKT-RF, SMB, HML] for each period
   * @returns {Object} Regression results
   */
  static threeFactorRegression(excessReturns, factors) {
    if (excessReturns.length !== factors.length) {
      throw new Error('Returns and factors must have same length');
    }

    const n = excessReturns.length;

    // Build design matrix X with intercept column
    const X = factors.map(row => [1, ...row]);
    const y = excessReturns;

    // Calculate (X'X)^-1 * X'y
    const coefficients = this.olsRegression(X, y);

    // Calculate fitted values and residuals
    const fitted = X.map(row =>
      row.reduce((sum, val, i) => sum + val * coefficients[i], 0)
    );
    const residuals = y.map((val, i) => val - fitted[i]);

    // Calculate R-squared
    const yMean = y.reduce((a, b) => a + b, 0) / n;
    const sst = y.reduce((sum, val) => sum + Math.pow(val - yMean, 2), 0);
    const sse = residuals.reduce((sum, val) => sum + Math.pow(val, 2), 0);
    const rSquared = 1 - (sse / sst);
    const adjustedRSquared = 1 - ((1 - rSquared) * (n - 1) / (n - coefficients.length));

    // Calculate standard errors
    const mse = sse / (n - coefficients.length);
    const XtX_inv = this.matrixInverse(this.matrixMultiply(this.transpose(X), X));
    const standardErrors = XtX_inv.map(row => Math.sqrt(mse * row[XtX_inv.indexOf(row)]));

    // Calculate t-statistics and p-values
    const degreesOfFreedom = n - coefficients.length;
    const tStats = coefficients.map((coef, i) => coef / standardErrors[i]);
    const pValues = tStats.map(t => this.tTestPValue(t, degreesOfFreedom));

    return {
      alpha: coefficients[0],
      betaMKT: coefficients[1],
      betaSMB: coefficients[2],
      betaHML: coefficients[3],
      rSquared: rSquared,
      adjustedRSquared: adjustedRSquared,
      standardErrors: {
        alpha: standardErrors[0],
        betaMKT: standardErrors[1],
        betaSMB: standardErrors[2],
        betaHML: standardErrors[3]
      },
      tStats: {
        alpha: tStats[0],
        betaMKT: tStats[1],
        betaSMB: tStats[2],
        betaHML: tStats[3]
      },
      pValues: {
        alpha: pValues[0],
        betaMKT: pValues[1],
        betaSMB: pValues[2],
        betaHML: pValues[3]
      },
      significance: {
        alpha: this.getSignificanceLevel(pValues[0]),
        betaMKT: this.getSignificanceLevel(pValues[1]),
        betaSMB: this.getSignificanceLevel(pValues[2]),
        betaHML: this.getSignificanceLevel(pValues[3])
      },
      observations: n,
      degreesOfFreedom: degreesOfFreedom,
      residuals: residuals
    };
  }

  /**
   * Perform 5-factor regression: R - Rf = α + β1(MKT-RF) + β2(SMB) + β3(HML) + β4(RMW) + β5(CMA) + ε
   * @param {Array<number>} excessReturns - Stock returns minus risk-free rate
   * @param {Array<Array<number>>} factors - [MKT-RF, SMB, HML, RMW, CMA] for each period
   * @returns {Object} Regression results
   */
  static fiveFactorRegression(excessReturns, factors) {
    if (excessReturns.length !== factors.length) {
      throw new Error('Returns and factors must have same length');
    }

    const n = excessReturns.length;

    const X = factors.map(row => [1, ...row]);
    const y = excessReturns;

    const coefficients = this.olsRegression(X, y);

    const fitted = X.map(row =>
      row.reduce((sum, val, i) => sum + val * coefficients[i], 0)
    );
    const residuals = y.map((val, i) => val - fitted[i]);

    const yMean = y.reduce((a, b) => a + b, 0) / n;
    const sst = y.reduce((sum, val) => sum + Math.pow(val - yMean, 2), 0);
    const sse = residuals.reduce((sum, val) => sum + Math.pow(val, 2), 0);
    const rSquared = 1 - (sse / sst);
    const adjustedRSquared = 1 - ((1 - rSquared) * (n - 1) / (n - coefficients.length));

    const mse = sse / (n - coefficients.length);
    const XtX_inv = this.matrixInverse(this.matrixMultiply(this.transpose(X), X));
    const standardErrors = XtX_inv.map(row => Math.sqrt(mse * row[XtX_inv.indexOf(row)]));

    const degreesOfFreedom = n - coefficients.length;
    const tStats = coefficients.map((coef, i) => coef / standardErrors[i]);
    const pValues = tStats.map(t => this.tTestPValue(t, degreesOfFreedom));

    return {
      alpha: coefficients[0],
      betaMKT: coefficients[1],
      betaSMB: coefficients[2],
      betaHML: coefficients[3],
      betaRMW: coefficients[4],
      betaCMA: coefficients[5],
      rSquared: rSquared,
      adjustedRSquared: adjustedRSquared,
      standardErrors: {
        alpha: standardErrors[0],
        betaMKT: standardErrors[1],
        betaSMB: standardErrors[2],
        betaHML: standardErrors[3],
        betaRMW: standardErrors[4],
        betaCMA: standardErrors[5]
      },
      tStats: {
        alpha: tStats[0],
        betaMKT: tStats[1],
        betaSMB: tStats[2],
        betaHML: tStats[3],
        betaRMW: tStats[4],
        betaCMA: tStats[5]
      },
      pValues: {
        alpha: pValues[0],
        betaMKT: pValues[1],
        betaSMB: pValues[2],
        betaHML: pValues[3],
        betaRMW: pValues[4],
        betaCMA: pValues[5]
      },
      significance: {
        alpha: this.getSignificanceLevel(pValues[0]),
        betaMKT: this.getSignificanceLevel(pValues[1]),
        betaSMB: this.getSignificanceLevel(pValues[2]),
        betaHML: this.getSignificanceLevel(pValues[3]),
        betaRMW: this.getSignificanceLevel(pValues[4]),
        betaCMA: this.getSignificanceLevel(pValues[5])
      },
      observations: n,
      degreesOfFreedom: degreesOfFreedom,
      residuals: residuals
    };
  }

  /**
   * Ordinary Least Squares regression
   * @param {Array<Array<number>>} X - Design matrix
   * @param {Array<number>} y - Response vector
   * @returns {Array<number>} Coefficient estimates
   */
  static olsRegression(X, y) {
    // β = (X'X)^-1 * X'y
    const Xt = this.transpose(X);
    const XtX = this.matrixMultiply(Xt, X);
    const XtX_inv = this.matrixInverse(XtX);
    const Xty = this.matrixVectorMultiply(Xt, y);
    const beta = this.matrixVectorMultiply(XtX_inv, Xty);

    return beta;
  }

  /**
   * Matrix transpose
   */
  static transpose(matrix) {
    return matrix[0].map((_, colIndex) => matrix.map(row => row[colIndex]));
  }

  /**
   * Matrix multiplication
   */
  static matrixMultiply(A, B) {
    const result = [];
    for (let i = 0; i < A.length; i++) {
      result[i] = [];
      for (let j = 0; j < B[0].length; j++) {
        let sum = 0;
        for (let k = 0; k < A[0].length; k++) {
          sum += A[i][k] * B[k][j];
        }
        result[i][j] = sum;
      }
    }
    return result;
  }

  /**
   * Matrix-vector multiplication
   */
  static matrixVectorMultiply(matrix, vector) {
    return matrix.map(row =>
      row.reduce((sum, val, i) => sum + val * vector[i], 0)
    );
  }

  /**
   * Matrix inverse using Gauss-Jordan elimination
   */
  static matrixInverse(matrix) {
    const n = matrix.length;
    const augmented = matrix.map((row, i) =>
      [...row, ...Array(n).fill(0).map((_, j) => i === j ? 1 : 0)]
    );

    // Forward elimination
    for (let i = 0; i < n; i++) {
      // Find pivot
      let maxRow = i;
      for (let k = i + 1; k < n; k++) {
        if (Math.abs(augmented[k][i]) > Math.abs(augmented[maxRow][i])) {
          maxRow = k;
        }
      }
      [augmented[i], augmented[maxRow]] = [augmented[maxRow], augmented[i]];

      // Make all rows below this one 0 in current column
      for (let k = i + 1; k < n; k++) {
        const factor = augmented[k][i] / augmented[i][i];
        for (let j = i; j < 2 * n; j++) {
          augmented[k][j] -= factor * augmented[i][j];
        }
      }
    }

    // Back substitution
    for (let i = n - 1; i >= 0; i--) {
      const divisor = augmented[i][i];
      for (let j = 0; j < 2 * n; j++) {
        augmented[i][j] /= divisor;
      }
      for (let k = i - 1; k >= 0; k--) {
        const factor = augmented[k][i];
        for (let j = 0; j < 2 * n; j++) {
          augmented[k][j] -= factor * augmented[i][j];
        }
      }
    }

    return augmented.map(row => row.slice(n));
  }

  /**
   * Calculate two-tailed p-value for t-statistic
   * @param {number} t - t-statistic
   * @param {number} df - degrees of freedom
   * @returns {number} p-value
   */
  static tTestPValue(t, df) {
    const absT = Math.abs(t);

    // Use Student's t-distribution CDF approximation
    const x = df / (df + absT * absT);
    const beta = this.betaIncomplete(df / 2, 0.5, x);

    return beta;
  }

  /**
   * Regularized incomplete beta function
   * Used for calculating t-distribution p-values
   */
  static betaIncomplete(a, b, x) {
    if (x <= 0) return 0;
    if (x >= 1) return 1;

    // Use continued fraction approximation
    const lbeta = this.logBeta(a, b);
    const front = Math.exp(Math.log(x) * a + Math.log(1 - x) * b - lbeta) / a;

    const f = this.betaContinuedFraction(a, b, x);

    return front * f;
  }

  /**
   * Log of beta function
   */
  static logBeta(a, b) {
    return this.logGamma(a) + this.logGamma(b) - this.logGamma(a + b);
  }

  /**
   * Log gamma function (Lanczos approximation)
   */
  static logGamma(z) {
    const g = 7;
    const coef = [
      0.99999999999980993,
      676.5203681218851,
      -1259.1392167224028,
      771.32342877765313,
      -176.61502916214059,
      12.507343278686905,
      -0.13857109526572012,
      9.9843695780195716e-6,
      1.5056327351493116e-7
    ];

    if (z < 0.5) {
      return Math.log(Math.PI) - Math.log(Math.sin(Math.PI * z)) - this.logGamma(1 - z);
    }

    z -= 1;
    let x = coef[0];
    for (let i = 1; i < g + 2; i++) {
      x += coef[i] / (z + i);
    }

    const t = z + g + 0.5;
    return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
  }

  /**
   * Continued fraction for incomplete beta function
   */
  static betaContinuedFraction(a, b, x, maxIterations = 200, epsilon = 1e-10) {
    const qab = a + b;
    const qap = a + 1;
    const qam = a - 1;
    let c = 1;
    let d = 1 - qab * x / qap;

    if (Math.abs(d) < 1e-30) d = 1e-30;
    d = 1 / d;
    let h = d;

    for (let m = 1; m <= maxIterations; m++) {
      const m2 = 2 * m;
      let aa = m * (b - m) * x / ((qam + m2) * (a + m2));
      d = 1 + aa * d;
      if (Math.abs(d) < 1e-30) d = 1e-30;
      c = 1 + aa / c;
      if (Math.abs(c) < 1e-30) c = 1e-30;
      d = 1 / d;
      h *= d * c;

      aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
      d = 1 + aa * d;
      if (Math.abs(d) < 1e-30) d = 1e-30;
      c = 1 + aa / c;
      if (Math.abs(c) < 1e-30) c = 1e-30;
      d = 1 / d;
      const del = d * c;
      h *= del;

      if (Math.abs(del - 1) < epsilon) break;
    }

    return h;
  }

  /**
   * Get significance level string from p-value
   * @param {number} pValue
   * @returns {string} Significance level ('***' for p<0.01, '**' for p<0.05, '*' for p<0.1, '' otherwise)
   */
  static getSignificanceLevel(pValue) {
    if (pValue < 0.01) return '***';
    if (pValue < 0.05) return '**';
    if (pValue < 0.10) return '*';
    return '';
  }
}

// Export for use in Chrome extension
if (typeof module !== 'undefined' && module.exports) {
  module.exports = FamaFrenchRegression;
}
