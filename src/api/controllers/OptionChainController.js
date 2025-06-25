const AgentManager = require('../../core/agents/AgentManager');

class OptionChainController {
  constructor() {
    this.agentManager = new AgentManager();
  }

  /**
   * Get option chain data for a symbol
   */
  async getOptionChain(req, res) {
    try {
      const symbol = req.params.symbol || 'NIFTY';
      console.log(`Direct API request for ${symbol} option chain...`);
      
      // Get the OptionsAgent to fetch data
      const optionsAgent = this.agentManager.getAgent('OptionsAgent');
      
      if (!optionsAgent) {
        return res.status(500).json({
          success: false,
          error: 'Options agent not available'
        });
      }

      const optionData = await optionsAgent.getOptionChain(symbol.toUpperCase());
      
      res.json({
        success: true,
        symbol: symbol.toUpperCase(),
        data: optionData,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Option chain API error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch option chain data',
        message: error.message
      });
    }
  }

  /**
   * Get supported symbols
   */
  async getSupportedSymbols(req, res) {
    try {
      const supportedSymbols = [
        { symbol: 'NIFTY', name: 'Nifty 50' },
        { symbol: 'BANKNIFTY', name: 'Bank Nifty' },
        { symbol: 'FINNIFTY', name: 'Fin Nifty' }
      ];

      res.json({
        success: true,
        symbols: supportedSymbols
      });
    } catch (error) {
      console.error('Get supported symbols error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get supported symbols'
      });
    }
  }
}

module.exports = OptionChainController;
