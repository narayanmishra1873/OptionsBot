/**
 * Analyze an array of bear put spreads and calculate all relevant metrics for each.
 * Each spread should have: longPut (strike, premium, delta, volume, oi, iv, greeks), shortPut (same fields), and spread meta (if any).
 * Returns an array of spreads with calculated metrics.
 */

function analyzeBearPutSpreads(spreads, capital = 100000) {
  console.log('[analyzeBearPutSpreads] Called with spreads:', JSON.stringify(spreads, null, 2));
  console.log('[analyzeBearPutSpreads] Capital for risk calculations:', capital);
  const results = spreads.map((spread, idx) => {
    const { longPut, shortPut } = spread;
    const lotSize = longPut.lotSize || 75; // default lot size
    const strikeDiff = Number((longPut.strike - shortPut.strike).toFixed(2));
    const netDebit = Number(((longPut.premium - shortPut.premium) * lotSize).toFixed(2));
    const maxProfit = Number(((strikeDiff * lotSize) - netDebit).toFixed(2));
    const maxLoss = Number(netDebit.toFixed(2));
    const breakeven = Number((longPut.strike - (netDebit / lotSize)).toFixed(2));
    const riskReward = maxProfit > 0 && maxLoss > 0 ? Number((maxProfit / maxLoss).toFixed(2)) : null;
    // Liquidity/quality metrics
    const liquidityScore =
      (longPut.volume > 500 && shortPut.volume > 500 ? 1 : 0) +
      (longPut.oi > 10000 && shortPut.oi > 10000 ? 1 : 0) +
      (Math.abs(longPut.premium - shortPut.premium) < 10 ? 1 : 0);
    // Greeks/IV
    const deltaOk = longPut.delta <= -0.3 && longPut.delta >= -0.7;
    const gammaOk = longPut.gamma >= 0.0001 && longPut.gamma <= 0.0005;
    const thetaOk = longPut.theta > -20; // avoid high theta decay
    const ivOk = longPut.iv < 40; // avoid very high IV
    // Risk as % of capital
    const riskPct = Number(((maxLoss / capital) * 100).toFixed(2));
    const metrics = {
      netDebit,
      maxProfit,
      maxLoss,
      breakeven,
      riskReward,
      liquidityScore,
      deltaOk,
      gammaOk,
      thetaOk,
      ivOk,
      riskPct,
      lotSize,
      strikeDiff
    };
    console.log(`[analyzeBearPutSpreads] Spread #${idx + 1} metrics:`, metrics);
    return {
      ...spread,
      metrics
    };
  });
  console.log('[analyzeBearPutSpreads] Final results:', JSON.stringify(results, null, 2));
  return results;
}

module.exports = { analyzeBearPutSpreads };
