const OptionChainService = require('../../../services/optionChain/OptionChainService');
const optionMath = require('../../../utils/optionMath');

/**
 * Tool to calculate expected Nifty50 value based on user input (percentage downfall or direct value),
 * fetch the option chain, and return the current Nifty50 value, relevant strike prices, and put option chain for those strikes.
 *
 * @param {Object} params
 * @param {string} params.symbol - The symbol for the option chain (e.g., NIFTY, BANKNIFTY)
 * @param {number} [params.expectedPercentage] - The expected percentage downfall (e.g., 2 for 2%)
 * @param {number} [params.expectedNiftyValue] - The expected Nifty50 value (if provided directly)
 * @returns {Promise<Object>} { currentNifty, expectedNifty, surroundingStrikes, putOptions }
 */
async function calculateExpectedNifty({ symbol, expectedPercentage, expectedNiftyValue }) {
  console.log(`[niftyDownsideTool] Called with symbol=${symbol}, expectedPercentage=${expectedPercentage}, expectedNiftyValue=${expectedNiftyValue}`);
  const optionChainService = new OptionChainService();
  // Fetch option chain for latest expiry
  const optionChain = await optionChainService.getOptionChain(symbol || 'NIFTY');
  console.log(`[niftyDownsideTool] Fetched option chain for ${symbol || 'NIFTY'}. Underlying value: ${optionChain.underlyingValue}`);
  let currentNifty = optionChain.underlyingValue;

  let expectedNifty = null;
  if (typeof expectedNiftyValue === 'number' && !isNaN(expectedNiftyValue)) {
    expectedNifty = expectedNiftyValue;
    console.log(`[niftyDownsideTool] Using provided expectedNiftyValue: ${expectedNifty}`);
  } else if (typeof expectedPercentage === 'number' && !isNaN(expectedPercentage)) {
    expectedNifty = currentNifty * (1 - expectedPercentage / 100);
    expectedNifty = Math.round(expectedNifty * 100) / 100;
    console.log(`[niftyDownsideTool] Calculated expectedNifty from percentage: ${expectedNifty}`);
  } else {
    console.error('[niftyDownsideTool] Error: Either expectedPercentage or expectedNiftyValue must be provided');
    throw new Error('Either expectedPercentage or expectedNiftyValue must be provided');
  }

  // Extract strike prices from optionData
  let strikePrices = [];
  if (optionChain && Array.isArray(optionChain.optionData)) {
    strikePrices = Array.from(new Set(optionChain.optionData
      .map(opt => typeof opt.strikePrice === 'number' ? opt.strikePrice : undefined)
      .filter(x => typeof x === 'number')));
    console.log(`[niftyDownsideTool] Extracted ${strikePrices.length} strike prices.`);
  } else {
    console.error('[niftyDownsideTool] Unable to extract strike prices from option chain');
    throw new Error('Unable to extract strike prices from option chain');
  }
  strikePrices.sort((a, b) => a - b);

  // Find the index of the strike closest to expectedNifty
  let closestIdx = 0;
  let minDiff = Math.abs(strikePrices[0] - expectedNifty);
  for (let i = 1; i < strikePrices.length; i++) {
    const diff = Math.abs(strikePrices[i] - expectedNifty);
    if (diff < minDiff) {
      minDiff = diff;
      closestIdx = i;
    }
  }
  // Select up to 9 strikes: 4 below, the closest, 4 above (handle edges)
  const start = Math.max(0, closestIdx - 4);
  const end = Math.min(strikePrices.length, closestIdx + 5);
  const surroundingStrikes = strikePrices.slice(start, end);
  console.log(`[niftyDownsideTool] Selected surrounding strikes: ${surroundingStrikes.join(', ')}`);

  // Get put option data for these strikes, including greeks
  let putOptions = [];
  if (optionChain && Array.isArray(optionChain.optionData)) {
    putOptions = optionChain.optionData
      .filter(opt => surroundingStrikes.includes(opt.strikePrice))
      .map(opt => {
        const put = opt.put || {};
        // Calculate greeks for each put option
        const greeks = optionMath.calculateGreeks({
          type: 'put',
          S: currentNifty,
          K: opt.strikePrice,
          T: put.daysToExpiry ? put.daysToExpiry / 365 : (optionChain.daysToExpiry ? optionChain.daysToExpiry / 365 : 0.02),
          r: 0.06, // Assume 6% risk-free rate (can be parameterized)
          v: put.impliedVolatility ? put.impliedVolatility / 100 : 0.18 // Use IV if available, else 18% default
        });
        console.log(`[niftyDownsideTool] Put option for strike ${opt.strikePrice}: LTP=${put.lastPrice}, OI=${put.openInterest}, IV=${put.impliedVolatility}, Greeks=`, greeks);
        return {
          strikePrice: opt.strikePrice,
          ...put,
          greeks
        };
      });
    console.log(`[niftyDownsideTool] Compiled put options for selected strikes. Count: ${putOptions.length}`);
  }

  result = {
    currentNifty,
    expectedNifty,
    surroundingStrikes,
    putOptions
  };
  console.log(`[niftyDownsideTool] Result:`, result);
  return result;
}

module.exports = { calculateExpectedNifty };
