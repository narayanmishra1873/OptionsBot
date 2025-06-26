const OptionChainService = require('../../../services/optionChain/OptionChainService');

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
  const optionChainService = new OptionChainService();
  // Fetch option chain for latest expiry
  const optionChain = await optionChainService.getOptionChain(symbol || 'NIFTY');
  let currentNifty = optionChain.underlyingValue;

  let expectedNifty = null;
  if (typeof expectedNiftyValue === 'number' && !isNaN(expectedNiftyValue)) {
    expectedNifty = expectedNiftyValue;
  } else if (typeof expectedPercentage === 'number' && !isNaN(expectedPercentage)) {
    expectedNifty = currentNifty * (1 - expectedPercentage / 100);
    expectedNifty = Math.round(expectedNifty * 100) / 100;
  } else {
    throw new Error('Either expectedPercentage or expectedNiftyValue must be provided');
  }

  // Extract strike prices from optionData
  let strikePrices = [];
  if (optionChain && Array.isArray(optionChain.optionData)) {
    strikePrices = Array.from(new Set(optionChain.optionData
      .map(opt => typeof opt.strikePrice === 'number' ? opt.strikePrice : undefined)
      .filter(x => typeof x === 'number')));
  } else {
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

  // Get put option data for these strikes
  let putOptions = [];
  if (optionChain && Array.isArray(optionChain.optionData)) {
    putOptions = optionChain.optionData
      .filter(opt => surroundingStrikes.includes(opt.strikePrice))
      .map(opt => ({
        strikePrice: opt.strikePrice,
        ...opt.put
      }));
  }

  return {
    currentNifty,
    expectedNifty,
    surroundingStrikes,
    putOptions
  };
}

module.exports = { calculateExpectedNifty };
