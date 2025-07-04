const http = require('http');

class OptionChainService {
    constructor() {
        // Flask API base URL
        this.apiBaseUrl = 'http://localhost:5000';
        
        // Request timeout settings
        this.requestTimeout = 30000; // 30 seconds
    }    /**
     * Make HTTP request to Flask API with up to 3 retries on failure
     * @param {string} endpoint - API endpoint path
     * @param {Object} params - Query parameters
     * @returns {Promise<Object>} - API response
     */
    async makeApiRequest(endpoint, params = {}) {
        const maxRetries = 3;
        let attempt = 0;
        let lastError;
        while (attempt < maxRetries) {
            try {
                return await this._makeApiRequestOnce(endpoint, params);
            } catch (err) {
                lastError = err;
                attempt++;
                if (attempt < maxRetries) {
                    console.warn(`API request failed (attempt ${attempt}): ${err.message}. Retrying...`);
                    await new Promise(res => setTimeout(res, 500 * attempt)); // Exponential backoff
                }
            }
        }
        throw new Error(`API request failed after ${maxRetries} attempts: ${lastError.message}`);
    }

    /**
     * Internal single-attempt API request (original logic)
     */
    async _makeApiRequestOnce(endpoint, params = {}) {
        return new Promise((resolve, reject) => {
            // Build URL with query parameters
            const url = new URL(endpoint, this.apiBaseUrl);
            Object.entries(params).forEach(([key, value]) => {
                if (value !== undefined && value !== null) {
                    url.searchParams.append(key, value);
                }
            });

            const options = {
                hostname: url.hostname,
                port: url.port || 5000,
                path: url.pathname + url.search,
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                timeout: this.requestTimeout
            };

            console.log(`Making API request to: ${url.toString()}`);

            const req = http.request(options, (res) => {
                let data = '';

                res.on('data', (chunk) => {
                    data += chunk;
                });

                res.on('end', () => {
                    try {
                        const jsonData = JSON.parse(data);
                        
                        if (res.statusCode >= 200 && res.statusCode < 300) {
                            if (jsonData.success === false) {
                                reject(new Error(jsonData.error || 'API request failed'));
                            } else {
                                resolve(jsonData);
                            }
                        } else {
                            reject(new Error(`HTTP ${res.statusCode}: ${jsonData.error || 'Request failed'}`));
                        }
                    } catch (error) {
                        console.error('Failed to parse API response:', data.substring(0, 200));
                        reject(new Error('Invalid JSON response from API'));
                    }
                });
            });

            req.on('error', (error) => {
                console.error('API request error:', error);
                reject(new Error(`API request failed: ${error.message}`));
            });

            req.on('timeout', () => {
                req.destroy();
                reject(new Error('API request timeout'));
            });

            req.setTimeout(this.requestTimeout);
            req.end();
        });
    }    /**
     * Get NSE expiry dates for a symbol using Flask API
     * @param {string} symbol - The symbol to fetch expiry dates for
     * @returns {Promise<Array>} - Array of expiry dates
     */
    async getNSEExpiryDates(symbol = 'NIFTY') {
        try {
            console.log(`Fetching expiry dates for ${symbol}...`);
            
            const response = await this.makeApiRequest('/api/expiry-dates', { symbol });
            
            if (!response.expiryDates || !Array.isArray(response.expiryDates)) {
                throw new Error('Invalid expiry dates response from API');
            }
            
            console.log(`Found ${response.expiryDates.length} expiry dates for ${symbol}`);
            return response.expiryDates;
        } catch (error) {
            console.error('Error fetching expiry dates:', error.message);
            throw error;
        }
    }

    /**
     * Get option chain data for current expiry (main function to call)
     * @param {string} symbol - The symbol to fetch option chain for (default: NIFTY)
     * @returns {Promise<Object>} - Option chain data with current expiry
     */
    async getOptionChain(symbol = 'NIFTY') {
        try {
            // Step 0: Ensure Flask API server is running
            await this.ensureApiServerRunning();

            // Step 1: Get all expiry dates
            const expiryDates = await this.getNSEExpiryDates(symbol);
            if (!expiryDates || expiryDates.length === 0) {
                throw new Error('No expiry dates found');
            }

            // Step 2: Try to find expiry for 3 months ahead, then 2, then 1, then current month
            const now = new Date();
            let foundExpiry = null;
            let foundMonth = null;
            for (let monthOffset = 3; monthOffset >= 0; monthOffset--) {
                const targetMonth = now.getMonth() + monthOffset;
                const targetYear = now.getFullYear() + Math.floor(targetMonth / 12);
                const normalizedTargetMonth = targetMonth % 12;

                // Parse expiry dates and filter for the target month/year
                const expiryObjs = expiryDates.map(dateStr => {
                    let parts = dateStr.includes('-') ? dateStr.split('-') : [];
                    let dateObj;
                    if (parts.length === 3 && isNaN(parts[0])) {
                        // e.g. 27-JUN-2025
                        dateObj = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
                    } else {
                        dateObj = new Date(dateStr);
                    }
                    return { dateStr, dateObj };
                });

                // Filter for target month/year
                const filtered = expiryObjs.filter(({ dateObj }) =>
                    dateObj.getMonth() === normalizedTargetMonth && dateObj.getFullYear() === targetYear
                );

                if (filtered.length > 0) {
                    // Pick the latest expiry in that month
                    const lastExpiry = filtered.reduce((latest, curr) =>
                        curr.dateObj > latest.dateObj ? curr : latest
                    );
                    foundExpiry = lastExpiry.dateStr;
                    foundMonth = normalizedTargetMonth;
                    break;
                }
            }

            if (!foundExpiry) {
                throw new Error('No expiry found for the next 3 months or earlier');
            }

            // Step 3: Get option chain data for the selected expiry
            const optionData = await this.fetchOptionChainForExpiry(symbol, foundExpiry);

            // Step 4: Find ATM and get relevant strikes
            const atmStrike = this.findATMStrikeFromLists(optionData.ceOptions, optionData.peOptions, optionData.underlyingValue);
            const relevantStrikes = this.getRelevantStrikesFromLists(optionData.ceOptions, optionData.peOptions, atmStrike, 5);

            return {
                symbol: symbol,
                underlyingValue: optionData.underlyingValue,
                currentExpiry: foundExpiry,
                atmStrike: atmStrike,
                timestamp: optionData.timestamp,
                optionData: relevantStrikes,
                marketData: optionData.marketData
            };
        } catch (error) {
            console.error('Error fetching option chain:', error.message);
            throw error;
        }
    }

    /**
     * Check if Flask API is running and healthy
     * @returns {Promise<Object>} - Health check result
     */
    async checkApiHealth() {
        try {
            const response = await this.makeApiRequest('/');
            return {
                healthy: true,
                version: response.version || '1.0.0',
                service: response.service || 'NSE Options API',
                endpoints: response.endpoints || []
            };
        } catch (error) {
            console.error('API health check failed:', error.message);
            return {
                healthy: false,
                error: error.message
            };
        }
    }

    /**
     * Start Flask API server if not running
     * @returns {Promise<boolean>} - True if server is running or was started successfully
     */
    async ensureApiServerRunning() {
        try {
            const health = await this.checkApiHealth();
            if (health.healthy) {
                console.log('✅ Flask API server is running');
                return true;
            }
        } catch (error) {
            // API is not running, provide instructions
            console.error('❌ Flask API server is not running');
            console.log('📝 To start the Flask API server:');
            console.log('   1. Navigate to your Flask API directory');
            console.log('   2. Run: python app.py');
            console.log('   3. Ensure it\'s running on http://localhost:5000');
            throw new Error('Flask API server is not running. Please start it first.');
        }
        return false;
    }

    /**
     * Check if option is valid (has lastPrice > 0)
     * @param {Object} option - Option data
     * @returns {boolean} - True if valid option
     */
    isValidOption(option) {
        // Handle both direct option object and nested structure
        const lastPrice = option?.lastPrice || option?.LTP || 0;
        return option && lastPrice > 0;
    }

    /**
     * Finds the ATM (At The Money) strike price
     * @param {Array} optionData - Array of option data
     * @param {number} underlyingValue - Current underlying price
     * @returns {number} - ATM strike price
     */
    findATMStrike(optionData, underlyingValue) {
        let closestStrike = optionData[0]?.strikePrice || 0;
        let minDiff = Math.abs(underlyingValue - closestStrike);

        optionData.forEach(item => {
            const diff = Math.abs(underlyingValue - item.strikePrice);
            if (diff < minDiff) {
                minDiff = diff;
                closestStrike = item.strikePrice;
            }
        });

        return closestStrike;
    }

    /**
     * Gets relevant strikes around ATM
     * @param {Array} optionData - Array of option data
     * @param {number} atmStrike - ATM strike price
     * @param {number} range - Number of strikes above and below ATM
     * @returns {Array} - Filtered option data
     */
    getRelevantStrikes(optionData, atmStrike, range = 5) {
        // Sort by strike price
        const sortedData = optionData.sort((a, b) => a.strikePrice - b.strikePrice);
        
        // Find ATM index
        const atmIndex = sortedData.findIndex(item => item.strikePrice === atmStrike);
        
        if (atmIndex === -1) return sortedData.slice(0, range * 2 + 1);
        
        // Get strikes around ATM
        const startIndex = Math.max(0, atmIndex - range);
        const endIndex = Math.min(sortedData.length - 1, atmIndex + range);
        
        return sortedData.slice(startIndex, endIndex + 1);
    }    /**
     * Formats option chain data for display in markdown format
     * @param {Object} optionChainData - Raw option chain data
     * @returns {string} - Formatted markdown string for display
     */
    formatOptionChainData(optionChainData) {
        const { symbol, underlyingValue, currentExpiry, atmStrike, optionData } = optionChainData;
        
        // Header with key information
        let formatted = `┌─────────────────────────────────────────────────────────────┐\n`;
        formatted += `│                   📊 ${symbol} OPTION CHAIN                     │\n`;
        formatted += `├─────────────────────────────────────────────────────────────┤\n`;
        formatted += `│ � Underlying Price: ₹${underlyingValue.toLocaleString().padEnd(15)} │\n`;
        formatted += `│ � Expiry Date: ${new Date(currentExpiry).toLocaleDateString('en-GB').padEnd(20)} │\n`;
        formatted += `│ 🎯 ATM Strike: ₹${atmStrike.toLocaleString().padEnd(20)} │\n`;
        formatted += `│ ⏰ Updated: ${new Date().toLocaleTimeString().padEnd(23)} │\n`;
        formatted += `└─────────────────────────────────────────────────────────────┘\n\n`;

        // Option chain table header
        formatted += `┌─────────────────────────────────────────────────────────────────────────────────┐\n`;
        formatted += `│                               OPTION CHAIN DATA                                │\n`;
        formatted += `├──────┬─────────┬──────────┬──────────┬─────────┬──────────┬──────────┬──────┤\n`;
        formatted += `│      │         CALL OPTIONS         │ STRIKE  │         PUT OPTIONS          │\n`;
        formatted += `├──────┼─────────┼──────────┼──────────┼─────────┼──────────┼──────────┼──────┤\n`;
        formatted += `│ TYPE │   LTP   │  VOLUME  │  CHANGE  │  PRICE  │  CHANGE  │  VOLUME  │ LTP  │\n`;
        formatted += `├──────┼─────────┼──────────┼──────────┼─────────┼──────────┼──────────┼──────┤\n`;
        
        // Calculate some analytics
        const totalCallVolume = optionData.reduce((sum, opt) => sum + opt.call.volume, 0);
        const totalPutVolume = optionData.reduce((sum, opt) => sum + opt.put.volume, 0);
        const putCallRatio = totalPutVolume / totalCallVolume;
        
        // Option data rows
        optionData.forEach(option => {
            const { strikePrice, call, put } = option;
            const isATM = strikePrice === atmStrike;
            const isITMCall = strikePrice < underlyingValue;
            const isITMPut = strikePrice > underlyingValue;
            
            // Determine option type indicators
            let callType = '   ';
            let putType = '   ';
            
            if (isATM) {
                callType = 'ATM';
                putType = 'ATM';
            } else if (isITMCall) {
                callType = 'ITM';
            } else {
                callType = 'OTM';
            }
            
            if (isATM) {
                // Already set above
            } else if (isITMPut) {
                putType = 'ITM';
            } else {
                putType = 'OTM';
            }
            
            // Format values with proper padding
            const callLTP = call.lastPrice > 0 ? `₹${call.lastPrice.toFixed(2)}` : '-';
            const putLTP = put.lastPrice > 0 ? `₹${put.lastPrice.toFixed(2)}` : '-';
            const callVol = call.volume > 0 ? call.volume.toLocaleString() : '-';
            const putVol = put.volume > 0 ? put.volume.toLocaleString() : '-';
            const callChange = call.change !== 0 ? `${call.change > 0 ? '+' : ''}${call.change.toFixed(2)}` : '-';
            const putChange = put.change !== 0 ? `${put.change > 0 ? '+' : ''}${put.change.toFixed(2)}` : '-';
            
            // Add ATM indicator
            const atmIndicator = isATM ? '🎯' : '  ';
            
            formatted += `│ ${callType} │${callLTP.padStart(8)} │${callVol.padStart(9)} │${callChange.padStart(9)} │${atmIndicator}${strikePrice.toString().padStart(6)} │${putChange.padStart(9)} │${putVol.padStart(9)} │${putLTP.padStart(5)} │\n`;
        });
        
        formatted += `└──────┴─────────┴──────────┴──────────┴─────────┴──────────┴──────────┴──────┘\n\n`;
        
        // Summary analytics
        formatted += `┌─────────────────────────────────────────────────────────────┐\n`;
        formatted += `│                        📊 ANALYTICS                         │\n`;
        formatted += `├─────────────────────────────────────────────────────────────┤\n`;
        formatted += `│ Total Call Volume: ${totalCallVolume.toLocaleString().padEnd(20)} │\n`;
        formatted += `│ Total Put Volume:  ${totalPutVolume.toLocaleString().padEnd(20)} │\n`;
        formatted += `│ Put-Call Ratio:    ${putCallRatio.toFixed(2).padEnd(20)} │\n`;
        
        // Market sentiment based on PCR
        let sentiment = '';
        if (putCallRatio > 1.2) {
            sentiment = '🔴 Bearish (High Put Activity)';
        } else if (putCallRatio < 0.8) {
            sentiment = '🟢 Bullish (High Call Activity)';
        } else {
            sentiment = '🟡 Neutral (Balanced Activity)';
        }
        formatted += `│ Market Sentiment:  ${sentiment.padEnd(20)} │\n`;
        formatted += `└─────────────────────────────────────────────────────────────┘\n\n`;
        
        // Legend
        formatted += `📝 **Legend:**\n`;
        formatted += `• **ITM** = In The Money (Calls: Strike < Spot, Puts: Strike > Spot)\n`;
        formatted += `• **ATM** = At The Money (Strike ≈ Spot Price) 🎯\n`;
        formatted += `• **OTM** = Out of The Money (Calls: Strike > Spot, Puts: Strike < Spot)\n`;
        formatted += `• **LTP** = Last Traded Price\n`;
        formatted += `• **PCR** = Put Call Ratio (Put Vol ÷ Call Vol)\n\n`;
        
        formatted += `💡 **Quick Analysis:**\n`;
        if (putCallRatio > 1.2) {
            formatted += `• High put activity suggests bearish sentiment or hedging\n`;
            formatted += `• Traders might be expecting a price decline\n`;
        } else if (putCallRatio < 0.8) {
            formatted += `• High call activity suggests bullish sentiment\n`;
            formatted += `• Traders might be expecting a price rise\n`;
        } else {
            formatted += `• Balanced call/put activity suggests neutral market sentiment\n`;
            formatted += `• Market is likely in a consolidation phase\n`;
        }
        
        return formatted;
    }

    /**
     * Format only the first option from the chain (for testing purposes)
     * @param {Object} optionChainData - The complete option chain data
     * @returns {string} - Formatted string with just the first option
     */
    formatFirstOptionOnly(optionChainData) {
        const { symbol, underlyingValue, currentExpiry, atmStrike, optionData } = optionChainData;
        
        if (!optionData || optionData.length === 0) {
            return `No option data available for ${symbol}`;
        }

        // Get the first option from the chain
        const firstOption = optionData[0];
        const { strikePrice, call, put } = firstOption;
        
        // Simple formatted output
        let formatted = `📊 ${symbol} Sample Option Data\n\n`;
        formatted += `💰 Underlying Price: ₹${underlyingValue.toLocaleString()}\n`;
        formatted += `📅 Expiry: ${new Date(currentExpiry).toLocaleDateString('en-GB')}\n`;
        formatted += `🎯 ATM Strike: ₹${atmStrike.toLocaleString()}\n`;
        formatted += `⏰ Updated: ${new Date().toLocaleTimeString()}\n\n`;
        
        formatted += `📈 Strike ₹${strikePrice}:\n`;
        formatted += `• Call: ₹${call.lastPrice?.toFixed(2) || 0} (Vol: ${call.volume?.toLocaleString() || 0})\n`;
        formatted += `• Put: ₹${put.lastPrice?.toFixed(2) || 0} (Vol: ${put.volume?.toLocaleString() || 0})\n\n`;
        
        formatted += `Note: This is sample data for testing. Full chain available in production.\n`;
        
        return formatted;
    }

    /**
     * Checks if the user message is requesting option chain data
     * @param {string} message - User message
     * @returns {Object} - { isOptionChainRequest: boolean, symbol?: string }
     */
    isOptionChainRequest(message) {
        const lowerMessage = message.toLowerCase();
        
        // Keywords that indicate option chain request
        const optionKeywords = [
            'option chain', 'options chain', 'option data', 'options data',
            'call put', 'strikes', 'expiry', 'oi', 'open interest',
            'option prices', 'nifty options', 'banknifty options'
        ];
        
        const isRequest = optionKeywords.some(keyword => lowerMessage.includes(keyword));
        
        if (!isRequest) return { isOptionChainRequest: false };
        
        // Extract symbol if mentioned
        let symbol = 'NIFTY'; // default
        if (lowerMessage.includes('banknifty') || lowerMessage.includes('bank nifty')) {
            symbol = 'BANKNIFTY';
        } else if (lowerMessage.includes('nifty')) {
            symbol = 'NIFTY';
        }
        
        return { isOptionChainRequest: true, symbol };
    }

    /**
     * Finds the ATM strike price from separate CE and PE lists
     * @param {Array} ceOptions - Array of CE options
     * @param {Array} peOptions - Array of PE options
     * @param {number} underlyingValue - Current underlying price
     * @returns {number} - ATM strike price
     */
    findATMStrikeFromLists(ceOptions, peOptions, underlyingValue) {
        // Get unique strike prices from both CE and PE options
        const allStrikes = new Set();
        ceOptions.forEach(option => allStrikes.add(option.strikePrice));
        peOptions.forEach(option => allStrikes.add(option.strikePrice));
        
        const strikeArray = Array.from(allStrikes).sort((a, b) => a - b);
        
        if (strikeArray.length === 0) return 0;
        
        let closestStrike = strikeArray[0];
        let minDiff = Math.abs(underlyingValue - closestStrike);

        strikeArray.forEach(strike => {
            const diff = Math.abs(underlyingValue - strike);
            if (diff < minDiff) {
                minDiff = diff;
                closestStrike = strike;
            }
        });

        return closestStrike;
    }

    /**
     * Gets relevant strikes around ATM from separate CE and PE lists
     * @param {Array} ceOptions - Array of CE options
     * @param {Array} peOptions - Array of PE options
     * @param {number} atmStrike - ATM strike price
     * @param {number} range - Number of strikes above and below ATM
     * @returns {Array} - Combined option data around ATM
     */
    getRelevantStrikesFromLists(ceOptions, peOptions, atmStrike, range = 5) {
        // Get unique strike prices
        const allStrikes = new Set();
        ceOptions.forEach(option => allStrikes.add(option.strikePrice));
        peOptions.forEach(option => allStrikes.add(option.strikePrice));
        
        const sortedStrikes = Array.from(allStrikes).sort((a, b) => a - b);
        
        // Return all strikes, not just a range
        return sortedStrikes.map(strikePrice => {
            const ceOption = ceOptions.find(option => option.strikePrice === strikePrice);
            const peOption = peOptions.find(option => option.strikePrice === strikePrice);
            
            return {
                strikePrice: strikePrice,
                call: {
                    lastPrice: ceOption?.lastPrice || 0,
                    change: ceOption?.change || 0,
                    pChange: ceOption?.pChange || 0,
                    volume: ceOption?.totalTradedVolume || 0,
                    oi: ceOption?.openInterest || 0,
                    impliedVolatility: ceOption?.impliedVolatility || 0
                },
                put: {
                    lastPrice: peOption?.lastPrice || 0,
                    change: peOption?.change || 0,
                    pChange: peOption?.pChange || 0,
                    volume: peOption?.totalTradedVolume || 0,
                    oi: peOption?.openInterest || 0,
                    impliedVolatility: peOption?.impliedVolatility || 0
                }
            };
        });
    }

    /**
     * Fetch option chain data for specific expiry using Flask API
     * @param {string} symbol - The symbol to fetch option chain for
     * @param {string} expiry - The expiry date in DD-MMM-YYYY format
     * @returns {Promise<Object>} - Option chain data with CE and PE arrays
     */
    async fetchOptionChainForExpiry(symbol = 'NIFTY', expiry) {
        try {
            console.log(`Fetching option chain for ${symbol} expiry: ${expiry}`);
            
            const response = await this.makeApiRequest('/api/option-chain', { 
                symbol, 
                expiry 
            });
            
            if (!response.data) {
                throw new Error('Invalid option chain response from API');
            }
            
            const { marketData, ceOptions, peOptions } = response.data;
            const underlyingValue = marketData.underlyingValue || 0;
            
            console.log(`${underlyingValue} is the underlying value for expiry ${expiry}`);
            console.log(`Found ${ceOptions.length} CE options and ${peOptions.length} PE options`);
            
            return {
                symbol: symbol,
                expiry: expiry,
                underlyingValue: underlyingValue,
                timestamp: response.timestamp || new Date().toISOString(),
                ceOptions: ceOptions,
                peOptions: peOptions,
                marketData: marketData
            };
        } catch (error) {
            console.error('Error fetching option chain for expiry:', error.message);
            throw error;
        }
    }

    /**
     * Get current market data for a symbol using Flask API
     * @param {string} symbol - The symbol to fetch market data for
     * @returns {Promise<Object>} - Current market data
     */
    async getCurrentMarketData(symbol = 'NIFTY') {
        try {
            console.log(`Fetching current market data for ${symbol}...`);
            
            const response = await this.makeApiRequest('/api/current-market', { symbol });
            
            if (!response.marketData) {
                throw new Error('Invalid market data response from API');
            }
            
            return {
                symbol: symbol,
                underlyingValue: response.marketData.underlyingValue,
                timestamp: response.timestamp,
                nearestExpiry: response.nearestExpiry,
                totCE: response.marketData.totCE,
                totPE: response.marketData.totPE
            };
        } catch (error) {
            console.error('Error fetching current market data:', error.message);
            throw error;
        }
    }

    /**
     * Get only CE (Call) options for specific expiry using Flask API
     * @param {string} symbol - The symbol to fetch options for
     * @param {string} expiry - The expiry date in DD-MMM-YYYY format
     * @returns {Promise<Object>} - CE options data
     */
    async getCEOptions(symbol = 'NIFTY', expiry) {
        try {
            console.log(`Fetching CE options for ${symbol} expiry: ${expiry}`);
            
            const response = await this.makeApiRequest('/api/option-chain/ce', { 
                symbol, 
                expiry 
            });
            
            if (!response.options) {
                throw new Error('Invalid CE options response from API');
            }
            
            return {
                symbol: symbol,
                expiry: expiry,
                optionType: 'CE',
                marketData: response.marketData,
                options: response.options,
                count: response.count,
                timestamp: response.timestamp
            };
        } catch (error) {
            console.error('Error fetching CE options:', error.message);
            throw error;
        }
    }

    /**
     * Get only PE (Put) options for specific expiry using Flask API
     * @param {string} symbol - The symbol to fetch options for
     * @param {string} expiry - The expiry date in DD-MMM-YYYY format
     * @returns {Promise<Object>} - PE options data
     */
    async getPEOptions(symbol = 'NIFTY', expiry) {
        try {
            console.log(`Fetching PE options for ${symbol} expiry: ${expiry}`);
            
            const response = await this.makeApiRequest('/api/option-chain/pe', { 
                symbol, 
                expiry 
            });
            
            if (!response.options) {
                throw new Error('Invalid PE options response from API');
            }
            
            return {
                symbol: symbol,
                expiry: expiry,
                optionType: 'PE',
                marketData: response.marketData,
                options: response.options,
                count: response.count,
                timestamp: response.timestamp
            };
        } catch (error) {
            console.error('Error fetching PE options:', error.message);
            throw error;
        }
    }

    /**
     * Get option chain data for nearest expiry (convenience method)
     * @param {string} symbol - The symbol to fetch option chain for
     * @returns {Promise<Object>} - Option chain data with nearest expiry
     */
    async getOptionChainNearestExpiry(symbol = 'NIFTY') {
        try {
            await this.ensureApiServerRunning();
            
            const expiryDates = await this.getNSEExpiryDates(symbol);
            if (!expiryDates || expiryDates.length === 0) {
                throw new Error('No expiry dates found');
            }
            
            // Use the first (nearest) expiry
            const nearestExpiry = expiryDates[0];
            const optionData = await this.fetchOptionChainForExpiry(symbol, nearestExpiry);
            
            const atmStrike = this.findATMStrikeFromLists(optionData.ceOptions, optionData.peOptions, optionData.underlyingValue);
            const relevantStrikes = this.getRelevantStrikesFromLists(optionData.ceOptions, optionData.peOptions, atmStrike, 5);
            
            return {
                symbol: symbol,
                underlyingValue: optionData.underlyingValue,
                currentExpiry: nearestExpiry,
                atmStrike: atmStrike,
                timestamp: optionData.timestamp,
                optionData: relevantStrikes,
                marketData: optionData.marketData
            };
        } catch (error) {
            console.error('Error fetching option chain for nearest expiry:', error.message);
            throw error;
        }
    }

    /**
     * Get option chain data for specific expiry (convenience method)
     * @param {string} symbol - The symbol to fetch option chain for
     * @param {string} expiry - The expiry date in DD-MMM-YYYY format
     * @returns {Promise<Object>} - Formatted option chain data
     */
    async getOptionChainForSpecificExpiry(symbol = 'NIFTY', expiry) {
        try {
            await this.ensureApiServerRunning();
            
            const optionData = await this.fetchOptionChainForExpiry(symbol, expiry);
            const atmStrike = this.findATMStrikeFromLists(optionData.ceOptions, optionData.peOptions, optionData.underlyingValue);
            const relevantStrikes = this.getRelevantStrikesFromLists(optionData.ceOptions, optionData.peOptions, atmStrike, 5);
            
            return {
                symbol: symbol,
                underlyingValue: optionData.underlyingValue,
                currentExpiry: expiry,
                atmStrike: atmStrike,
                timestamp: optionData.timestamp,
                optionData: relevantStrikes,
                marketData: optionData.marketData
            };
        } catch (error) {
            console.error('Error fetching option chain for specific expiry:', error.message);
            throw error;
        }
    }

    /**
     * Test Flask API integration (for debugging)
     * @param {string} symbol - The symbol to test with
     * @returns {Promise<Object>} - Test results
     */
    async testFlaskApiIntegration(symbol = 'NIFTY') {
        const testResults = {
            timestamp: new Date().toISOString(),
            symbol: symbol,
            tests: {
                healthCheck: { passed: false, error: null },
                expiryDates: { passed: false, error: null, count: 0 },
                currentMarket: { passed: false, error: null },
                optionChain: { passed: false, error: null }
            }
        };

        try {
            // Test 1: Health Check
            console.log('🧪 Testing Flask API health check...');
            const health = await this.checkApiHealth();
            testResults.tests.healthCheck.passed = health.healthy;
            if (!health.healthy) {
                testResults.tests.healthCheck.error = health.error;
            }

            // Test 2: Expiry Dates
            console.log('🧪 Testing expiry dates endpoint...');
            try {
                const expiries = await this.getNSEExpiryDates(symbol);
                testResults.tests.expiryDates.passed = Array.isArray(expiries) && expiries.length > 0;
                testResults.tests.expiryDates.count = expiries.length;
            } catch (error) {
                testResults.tests.expiryDates.error = error.message;
            }

            // Test 3: Current Market Data
            console.log('🧪 Testing current market data endpoint...');
            try {
                const market = await this.getCurrentMarketData(symbol);
                testResults.tests.currentMarket.passed = market && market.underlyingValue > 0;
            } catch (error) {
                testResults.tests.currentMarket.error = error.message;
            }

            // Test 4: Option Chain (only if expiry dates work)
            if (testResults.tests.expiryDates.passed) {
                console.log('🧪 Testing option chain endpoint...');
                try {
                    const optionData = await this.getOptionChainNearestExpiry(symbol);
                    testResults.tests.optionChain.passed = optionData && optionData.optionData && optionData.optionData.length > 0;
                } catch (error) {
                    testResults.tests.optionChain.error = error.message;
                }
            }

            // Summary
            const passedTests = Object.values(testResults.tests).filter(test => test.passed).length;
            const totalTests = Object.keys(testResults.tests).length;
            
            console.log(`\n📊 Test Summary: ${passedTests}/${totalTests} tests passed`);
            Object.entries(testResults.tests).forEach(([testName, result]) => {
                const status = result.passed ? '✅' : '❌';
                console.log(`   ${status} ${testName}: ${result.passed ? 'PASSED' : `FAILED - ${result.error}`}`);
            });

            return testResults;

        } catch (error) {
            console.error('❌ Flask API integration test failed:', error.message);
            throw error;
        }
    }
}

module.exports = OptionChainService;
