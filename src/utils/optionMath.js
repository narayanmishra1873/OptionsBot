// optionMath.js
// Utility functions for option greeks and bear put spread metrics

const jStat = require('jstat');

// Black-Scholes Greeks for European options
function calculateGreeks({ type, S, K, T, r, v }) {
    // S: spot, K: strike, T: time to expiry (in years), r: risk-free rate, v: volatility (decimal)
    if (!S || !K || !T || !v) return {};
    const d1 = (Math.log(S / K) + (r + 0.5 * v * v) * T) / (v * Math.sqrt(T));
    const d2 = d1 - v * Math.sqrt(T);
    const Nd1 = jStat.normal.cdf(type === 'call' ? d1 : -d1, 0, 1);
    const Nd2 = jStat.normal.cdf(type === 'call' ? d2 : -d2, 0, 1);
    const pdfD1 = jStat.normal.pdf(d1, 0, 1);
    return {
        delta: type === 'call' ? Nd1 : Nd1 - 1,
        gamma: pdfD1 / (S * v * Math.sqrt(T)),
        theta: type === 'call'
            ? (-S * pdfD1 * v / (2 * Math.sqrt(T)) - r * K * Math.exp(-r * T) * Nd2) / 365
            : (-S * pdfD1 * v / (2 * Math.sqrt(T)) + r * K * Math.exp(-r * T) * Nd2) / 365,
        vega: S * pdfD1 * Math.sqrt(T) / 100,
        rho: type === 'call'
            ? K * T * Math.exp(-r * T) * Nd2 / 100
            : -K * T * Math.exp(-r * T) * Nd2 / 100
    };
}

// Calculate bear put spread metrics per lot
function calculateBearPutSpreadMetrics(longPut, shortPut, lotSize) {
    // Buy higher strike, sell lower strike
    const netPremium = (longPut.lastPrice - shortPut.lastPrice) * lotSize;
    const strikeDiff = longPut.strikePrice - shortPut.strikePrice;
    const maxProfit = (strikeDiff * lotSize) - netPremium;
    const maxLoss = netPremium;
    const breakeven = longPut.strikePrice - netPremium / lotSize;
    const riskReward = maxProfit / (maxLoss || 1);
    return {
        netPremium,
        maxProfit,
        maxLoss,
        breakeven,
        riskReward,
        longGreeks: longPut.greeks,
        shortGreeks: shortPut.greeks
    };
}

/**
 * Calculate option metrics (greeks and price) for a list of options.
 * @param {Array} options - Array of option objects with fields: type, S, K, T, r, v, lastPrice, strikePrice, etc.
 * @returns {Array} Array of objects: { strikePrice, type, lastPrice, greeks: { delta, gamma, theta, vega, rho }, ... }
 */
function calculateOptionMetrics(options) {
    if (!Array.isArray(options)) return [];
    return options.map(opt => {
        const { type, S, K, T, r, v, lastPrice, strikePrice, ...rest } = opt;
        const greeks = calculateGreeks({ type, S, K, T, r, v });
        return {
            strikePrice: strikePrice || K,
            type,
            lastPrice,
            greeks,
            ...rest
        };
    });
}

module.exports = { calculateGreeks, calculateBearPutSpreadMetrics, calculateOptionMetrics };
