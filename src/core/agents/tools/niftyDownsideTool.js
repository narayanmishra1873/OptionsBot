/**
 * Tool to calculate expected Nifty50 value based on user input (percentage downfall or direct value)
 * and return the current Nifty50 value from the option chain, as well as up to 9 surrounding strike prices for puts.
 *
 * @param {Object} params
 * @param {Object} params.optionChain - The option chain data (JSON object)
 * @param {number} [params.expectedPercentage] - The expected percentage downfall (e.g., 2 for 2%)
 * @param {number} [params.expectedNiftyValue] - The expected Nifty50 value (if provided directly)
 * @returns {Object} { currentNifty, expectedNifty, surroundingStrikes }
 */
function calculateExpectedNifty({ optionChain, expectedPercentage, expectedNiftyValue }) {
  console.log('[niftyDownsideTool] Called with:', { optionChain, expectedPercentage, expectedNiftyValue });
  // Try to extract current Nifty value from optionChain (commonly in 'records.underlyingValue')
  let currentNifty = null;
  if (optionChain && optionChain.records && typeof optionChain.records.underlyingValue === 'number') {
    currentNifty = optionChain.records.underlyingValue;
  } else if (optionChain && typeof optionChain.underlyingValue === 'number') {
    currentNifty = optionChain.underlyingValue;
  } else {
    console.log('[niftyDownsideTool] Unable to extract current Nifty50 value from option chain');
    throw new Error('Unable to extract current Nifty50 value from option chain');
  }

  let expectedNifty = null;
  if (typeof expectedNiftyValue === 'number' && !isNaN(expectedNiftyValue)) {
    expectedNifty = expectedNiftyValue;
    console.log('[niftyDownsideTool] Using direct expectedNiftyValue:', expectedNifty);
  } else if (typeof expectedPercentage === 'number' && !isNaN(expectedPercentage)) {
    expectedNifty = currentNifty * (1 - expectedPercentage / 100);
    expectedNifty = Math.round(expectedNifty * 100) / 100; // round to 2 decimals
    console.log('[niftyDownsideTool] Calculated expectedNifty from percentage:', expectedNifty);
  } else {
    console.log('[niftyDownsideTool] Neither expectedPercentage nor expectedNiftyValue provided');
    throw new Error('Either expectedPercentage or expectedNiftyValue must be provided');
  }

  // Extract strike prices (prefer optionData for new structure)
  let strikePrices = [];
  if (optionChain && Array.isArray(optionChain.optionData)) {
    strikePrices = Array.from(new Set(optionChain.optionData
      .map(opt => typeof opt.strikePrice === 'number' ? opt.strikePrice : undefined)
      .filter(x => typeof x === 'number')));
  } else if (optionChain && Array.isArray(optionChain.peOptions)) {
    strikePrices = Array.from(new Set(optionChain.peOptions
      .map(opt => typeof opt.strikePrice === 'number' ? opt.strikePrice : undefined)
      .filter(x => typeof x === 'number')));
  } else if (optionChain && optionChain.records && Array.isArray(optionChain.records.strikePrices)) {
    strikePrices = optionChain.records.strikePrices.slice();
  } else if (Array.isArray(optionChain.optionData)) {
    strikePrices = Array.from(new Set(optionChain.optionData
      .map(opt => typeof opt.strikePrice === 'number' ? opt.strikePrice : undefined)
      .filter(x => typeof x === 'number')));
  } else {
    throw new Error('Unable to extract strike prices from option chain');
  }

  // Sort strike prices just in case
  strikePrices.sort((a, b) => a - b);
  console.log('[niftyDownsideTool] Sorted strike prices:', strikePrices);
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
  const end = Math.min(strikePrices.length, closestIdx + 5); // non-inclusive
  const surroundingStrikes = strikePrices.slice(start, end);

  const result = {
    currentNifty,
    expectedNifty,
    surroundingStrikes
  };
  console.log('[niftyDownsideTool] Returning:', result);
  return result;
}

module.exports = { calculateExpectedNifty };
