/**
 * Tool to calculate expected Nifty50 value based on user input (percentage downfall or direct value)
 * and return the current Nifty50 value from the option chain.
 *
 * @param {Object} params
 * @param {Object} params.optionChain - The option chain data (JSON object)
 * @param {number} [params.expectedPercentage] - The expected percentage downfall (e.g., 2 for 2%)
 * @param {number} [params.expectedNiftyValue] - The expected Nifty50 value (if provided directly)
 * @returns {Object} { currentNifty, expectedNifty }
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

  const result = {
    currentNifty,
    expectedNifty
  };
  console.log('[niftyDownsideTool] Returning:', result);
  return result;
}

module.exports = { calculateExpectedNifty };
