const https = require('https');
const zlib = require('zlib');

class OptionChainService {
    constructor() {
        // Base headers for all requests (matching your Python code exactly)
        this.baseHeaders = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'Accept': '*/*',
            'Accept-Language': 'en-US,en;q=0.9',
            'Referer': 'https://www.nseindia.com/option-chain',
            'Accept-Encoding': 'gzip, deflate, br',
            'Connection': 'keep-alive',
        };
    }

    /**
     * Create a new session for each request group
     * @returns {Object} - New session object
     */
    createNewSession() {
        return {
            cookies: {},
            headers: { ...this.baseHeaders }
        };
    }    /**
     * Get NSE expiry dates for a symbol (matching your Python get_nse_expiry_dates function)
     * @param {string} symbol - The symbol to fetch expiry dates for
     * @returns {Promise<Array>} - Array of expiry dates
     */
    async getNSEExpiryDates(symbol = 'NIFTY') {
        const session = this.createNewSession(); // Create new session for this request
        
        try {
            console.log(`Fetching expiry dates for ${symbol}...`);
            
            // Step 1: Establish session
            await this.makeHttpRequestWithSession('https://www.nseindia.com', session);
            await this.makeHttpRequestWithSession('https://www.nseindia.com/option-chain', session);
            
            // Step 2: Get expiry dates
            const url = 'https://www.nseindia.com/api/option-chain-contract-info';
            const data = await this.makeHttpRequestWithParamsAndSession(url, { symbol }, session);
            
            if (!data || !data.expiryDates) {
                throw new Error('Invalid response from NSE contract info API');
            }
            
            // Sort expiry dates (first one is current expiry)
            const expiryDates = data.expiryDates.sort((a, b) => {
                const dateA = new Date(a.split('-').reverse().join('-'));
                const dateB = new Date(b.split('-').reverse().join('-'));
                return dateA - dateB;
            });
            
            console.log(`Found ${expiryDates.length} expiry dates for ${symbol}`);
            return expiryDates;
        } catch (error) {
            console.error('Error fetching expiry dates:', error.message);
            throw error;
        }
    }    /**
     * Fetch option chain data for specific expiry (matching your Python fetch_and_clean_option_chain function)
     * @param {string} symbol - The symbol to fetch option chain for
     * @param {string} expiry - The expiry date in DD-MMM-YYYY format
     * @returns {Promise<Object>} - Option chain data with CE and PE arrays
     */
    async fetchOptionChainForExpiry(symbol = 'NIFTY', expiry) {
        const session = this.createNewSession(); // Create new session for this request
        
        try {
            console.log(`Fetching option chain for ${symbol} expiry: ${expiry}`);
            
            // Step 1: Establish session (exactly like your Python code)
            await this.makeHttpRequestWithSession('https://www.nseindia.com', session);
            await this.makeHttpRequestWithSession('https://www.nseindia.com/option-chain', session);
            
            // Small delay to ensure session is established
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Step 2: Get option chain data for specific expiry
            const url = 'https://www.nseindia.com/api/option-chain-v3';
            const params = {
                type: 'Indices',
                symbol: symbol,
                expiry: expiry
            };
            
            const data = await this.makeHttpRequestWithParamsAndSession(url, params, session);
            
            if (!data || !data.records) {
                throw new Error('Invalid response from NSE option chain API');
            }
            
            const underlyingValue = data.records.underlyingValue || 0;
            console.log(`${underlyingValue} is the underlying value for expiry ${expiry}`);
            
            const ceList = [];
            const peList = [];
            
            // Filter CE and PE options (matching your Python logic)
            for (const entry of data.records.data || []) {
                if (entry.CE && this.isValidOption(entry.CE)) {
                    ceList.push(entry.CE);
                }
                if (entry.PE && this.isValidOption(entry.PE)) {
                    peList.push(entry.PE);
                }
            }
            
            console.log(`Found ${ceList.length} CE options and ${peList.length} PE options`);
            
            return {
                symbol: symbol,
                expiry: expiry,
                underlyingValue: underlyingValue,
                timestamp: new Date().toISOString(),
                ceOptions: ceList,
                peOptions: peList
            };
        } catch (error) {
            console.error('Error fetching option chain for expiry:', error.message);
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
            // Step 1: Get all expiry dates
            const expiryDates = await this.getNSEExpiryDates(symbol);
            
            if (!expiryDates || expiryDates.length === 0) {
                throw new Error('No expiry dates found');
            }

            // Step 2: Find the last expiry of the month two months ahead
            const now = new Date();
            const targetMonth = now.getMonth() + 2; // 0-based, so +2 for two months ahead
            const targetYear = now.getFullYear() + Math.floor(targetMonth / 12);
            const normalizedTargetMonth = targetMonth % 12;

            // Parse expiry dates and filter for the target month/year
            const expiryObjs = expiryDates.map(dateStr => {
                // Handles both DD-MMM-YYYY and YYYY-MM-DD
                let parts = dateStr.includes('-') ? dateStr.split('-') : [];
                let dateObj;
                if (parts.length === 3 && isNaN(parts[0])) {
                    // e.g. 27-JUN-2025
                    dateObj = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
                } else {
                    // fallback
                    dateObj = new Date(dateStr);
                }
                return { dateStr, dateObj };
            });

            // Filter for target month/year
            const filtered = expiryObjs.filter(({ dateObj }) =>
                dateObj.getMonth() === normalizedTargetMonth && dateObj.getFullYear() === targetYear
            );

            if (filtered.length === 0) {
                throw new Error('No expiry found for two months ahead');
            }

            // Pick the latest expiry in that month
            const lastExpiry = filtered.reduce((latest, curr) =>
                curr.dateObj > latest.dateObj ? curr : latest
            );
            const targetExpiry = lastExpiry.dateStr;

            // Step 3: Get option chain data for the selected expiry
            const optionData = await this.fetchOptionChainForExpiry(symbol, targetExpiry);

            // Step 4: Find ATM and get relevant strikes
            const atmStrike = this.findATMStrikeFromLists(optionData.ceOptions, optionData.peOptions, optionData.underlyingValue);
            const relevantStrikes = this.getRelevantStrikesFromLists(optionData.ceOptions, optionData.peOptions, atmStrike, 5);

            return {
                symbol: symbol,
                underlyingValue: optionData.underlyingValue,
                currentExpiry: targetExpiry,
                atmStrike: atmStrike,
                timestamp: optionData.timestamp,
                optionData: relevantStrikes
            };
        } catch (error) {
            console.error('Error fetching option chain:', error.message);
            throw error;
        }
    }

    /**
     * Check if option is valid (has lastPrice > 0)
     * @param {Object} option - Option data
     * @returns {boolean} - True if valid option
     */
    isValidOption(option) {
        return option && option.lastPrice && option.lastPrice > 0;
    }    /**
     * Makes HTTP request with specific session and retry logic
     * @param {string} url - The URL to fetch data from
     * @param {Object} session - Session object with cookies and headers
     * @param {number} retries - Number of retries (default: 3)
     * @returns {Promise<Object>} - Parsed JSON response
     */
    async makeHttpRequestWithSession(url, session, retries = 3) {
        for (let attempt = 1; attempt <= retries; attempt++) {
            try {
                console.log(`Attempt ${attempt}/${retries} for ${url}`);
                const result = await this._singleHttpRequestWithSession(url, session);
                return result;
            } catch (error) {
                console.error(`Attempt ${attempt} failed:`, error.message);
                
                if (attempt === retries) {
                    throw error;
                }
                
                // Wait before retry (exponential backoff)
                const delay = Math.pow(2, attempt) * 1000 + Math.random() * 1000; // Add jitter
                console.log(`Waiting ${delay.toFixed(0)}ms before retry...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }

    /**
     * Makes HTTP request with URL parameters and specific session
     * @param {string} baseUrl - The base URL
     * @param {Object} params - URL parameters
     * @param {Object} session - Session object with cookies and headers
     * @returns {Promise<Object>} - Parsed JSON response
     */
    makeHttpRequestWithParamsAndSession(baseUrl, params, session) {
        const url = new URL(baseUrl);
        Object.entries(params).forEach(([key, value]) => {
            url.searchParams.append(key, value);
        });
        return this.makeHttpRequestWithSession(url.toString(), session);
    }

    /**
     * Single HTTP request implementation with session handling
     * @param {string} url - The URL to fetch data from
     * @param {Object} session - Session object with cookies and headers
     * @returns {Promise<Object>} - Parsed JSON response
     */
    _singleHttpRequestWithSession(url, session) {
        return new Promise((resolve, reject) => {
            // Prepare headers
            const headers = { ...session.headers };
            
            // Add cookies if available
            if (Object.keys(session.cookies).length > 0) {
                const cookieString = Object.entries(session.cookies)
                    .map(([key, value]) => `${key}=${value}`)
                    .join('; ');
                headers['Cookie'] = cookieString;
            }

            const request = https.get(url, { 
                headers,
                timeout: 25000,
                // Use fresh agent for each request to avoid connection reuse issues
                agent: new https.Agent({ 
                    keepAlive: false,
                    maxSockets: 1,
                    timeout: 25000,
                    // Add some randomization to avoid detection
                    rejectUnauthorized: true
                })
            }, (response) => {
                // Handle cookies from response (like your Python session)
                if (response.headers['set-cookie']) {
                    response.headers['set-cookie'].forEach(cookie => {
                        const [cookiePair] = cookie.split(';');
                        const [name, value] = cookiePair.split('=');
                        if (name && value) {
                            session.cookies[name.trim()] = value.trim();
                        }
                    });
                }

                // Handle compressed responses
                let stream = response;
                const encoding = response.headers['content-encoding'];
                
                if (encoding === 'gzip') {
                    stream = response.pipe(zlib.createGunzip());
                } else if (encoding === 'deflate') {
                    stream = response.pipe(zlib.createInflate());
                } else if (encoding === 'br') {
                    stream = response.pipe(zlib.createBrotliDecompress());
                }

                let data = '';
                stream.on('data', (chunk) => {
                    data += chunk;
                });

                stream.on('end', () => {
                    try {
                        // If it's the homepage or option-chain page request, we don't need to parse JSON
                        if (url === 'https://www.nseindia.com' || url === 'https://www.nseindia.com/option-chain') {
                            resolve({ success: true });
                            return;
                        }
                        
                        const jsonData = JSON.parse(data);
                        resolve(jsonData);
                    } catch (error) {
                        console.error('Failed to parse JSON. Raw response length:', data.length);
                        console.error('Response starts with:', data.substring(0, 200));
                        reject(new Error('Failed to parse JSON response'));
                    }
                });

                stream.on('error', (error) => {
                    reject(error);
                });
            });

            request.on('error', (error) => {
                reject(error);
            });

            request.on('timeout', () => {
                request.destroy();
                reject(new Error('Request timeout'));
            });

            request.setTimeout(25000, () => {
                request.destroy();
                reject(new Error('Request timeout'));
            });
        });
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
}

module.exports = OptionChainService;
