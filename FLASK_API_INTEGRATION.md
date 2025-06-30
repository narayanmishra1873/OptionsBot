# Flask API Integration for OptionChainService

This document explains the integration between the Node.js OptionChainService and the Flask API for NSE option chain data.

## Overview

The `OptionChainService.js` has been updated to use a Flask API backend instead of making direct requests to NSE. This provides better reliability, centralized session management, and easier maintenance.

## Architecture

```
┌─────────────────┐    HTTP Requests    ┌─────────────────┐    NSE API Calls    ┌─────────────────┐
│   Node.js App   │ ──────────────────> │   Flask API     │ ──────────────────> │   NSE Website   │
│ OptionChainSvc  │                     │ (Port 5000)     │                     │                 │
└─────────────────┘                     └─────────────────┘                     └─────────────────┘
```

## Prerequisites

1. **Flask API Server**: Must be running on `http://localhost:5000`
2. **Dependencies**: Node.js application with updated OptionChainService

## Flask API Endpoints

The Flask API provides the following endpoints:

| Endpoint | Method | Description | Parameters |
|----------|--------|-------------|------------|
| `/` | GET | Health check | None |
| `/api/expiry-dates` | GET | Get expiry dates | `symbol` (optional) |
| `/api/option-chain` | GET | Get full option chain | `symbol`, `expiry` |
| `/api/option-chain/ce` | GET | Get CE options only | `symbol`, `expiry` |
| `/api/option-chain/pe` | GET | Get PE options only | `symbol`, `expiry` |
| `/api/current-market` | GET | Get current market data | `symbol` (optional) |

## Usage Examples

### 1. Basic Option Chain Retrieval

```javascript
const OptionChainService = require('./src/services/optionChain/OptionChainService');

const optionService = new OptionChainService();

// Get option chain for current expiry (2 months ahead)
try {
    const optionChain = await optionService.getOptionChain('NIFTY');
    console.log(optionChain);
} catch (error) {
    console.error('Error:', error.message);
}
```

### 2. Get Nearest Expiry Option Chain

```javascript
// Get option chain for nearest expiry
const nearestChain = await optionService.getOptionChainNearestExpiry('NIFTY');
console.log('Nearest expiry option chain:', nearestChain);
```

### 3. Get Option Chain for Specific Expiry

```javascript
// Get option chain for specific expiry
const specificChain = await optionService.getOptionChainForSpecificExpiry('NIFTY', '27-Jun-2025');
console.log('Specific expiry option chain:', specificChain);
```

### 4. Get Current Market Data

```javascript
// Get current market data without full option chain
const marketData = await optionService.getCurrentMarketData('NIFTY');
console.log('Current market data:', marketData);
```

### 5. Get Only CE or PE Options

```javascript
// Get only Call (CE) options
const ceOptions = await optionService.getCEOptions('NIFTY', '27-Jun-2025');
console.log('CE options:', ceOptions);

// Get only Put (PE) options
const peOptions = await optionService.getPEOptions('NIFTY', '27-Jun-2025');
console.log('PE options:', peOptions);
```

### 6. Health Check and Testing

```javascript
// Check if Flask API is running
const health = await optionService.checkApiHealth();
console.log('API Health:', health);

// Run comprehensive integration test
const testResults = await optionService.testFlaskApiIntegration('NIFTY');
console.log('Test Results:', testResults);
```

## Data Structure

### Option Chain Response

```javascript
{
    symbol: 'NIFTY',
    underlyingValue: 23500.75,
    currentExpiry: '27-Jun-2025',
    atmStrike: 23500,
    timestamp: '2025-06-30T10:30:00.000Z',
    optionData: [
        {
            strikePrice: 23400,
            call: {
                lastPrice: 125.50,
                change: 5.25,
                pChange: 4.37,
                volume: 150000,
                oi: 2500000,
                impliedVolatility: 18.5
            },
            put: {
                lastPrice: 45.25,
                change: -2.75,
                pChange: -5.73,
                volume: 120000,
                oi: 1800000,
                impliedVolatility: 17.8
            }
        }
        // ... more strikes
    ],
    marketData: {
        underlyingValue: 23500.75,
        timestamp: '2025-06-30T10:30:00.000Z',
        totCE: 50,
        totPE: 50
    }
}
```

## Error Handling

The service includes comprehensive error handling:

```javascript
try {
    const optionChain = await optionService.getOptionChain('NIFTY');
    // Process successful response
} catch (error) {
    if (error.message.includes('Flask API server is not running')) {
        console.log('Please start the Flask API server first');
    } else if (error.message.includes('timeout')) {
        console.log('Request timed out, try again');
    } else {
        console.log('Other error:', error.message);
    }
}
```

## Testing the Integration

### Quick Test

Run the integration test script:

```bash
node test-flask-integration.js
```

### Manual Testing

1. **Start Flask API**:
   ```bash
   python app.py
   ```

2. **Verify Flask API is running**:
   ```bash
   curl http://localhost:5000
   ```

3. **Test with Node.js**:
   ```javascript
   const optionService = new OptionChainService();
   const health = await optionService.checkApiHealth();
   console.log('Health:', health);
   ```

## Configuration

### API Base URL

By default, the service connects to `http://localhost:5000`. You can modify this in the constructor:

```javascript
class OptionChainService {
    constructor(apiBaseUrl = 'http://localhost:5000') {
        this.apiBaseUrl = apiBaseUrl;
        this.requestTimeout = 30000;
    }
}
```

### Timeout Settings

Request timeout is set to 30 seconds by default. Adjust if needed:

```javascript
const optionService = new OptionChainService();
optionService.requestTimeout = 60000; // 60 seconds
```

## Troubleshooting

### Common Issues

1. **Flask API not running**:
   ```
   Error: Flask API server is not running. Please start it first.
   ```
   **Solution**: Start Flask API with `python app.py`

2. **Connection refused**:
   ```
   Error: connect ECONNREFUSED 127.0.0.1:5000
   ```
   **Solution**: Ensure Flask API is running on port 5000

3. **Timeout errors**:
   ```
   Error: API request timeout
   ```
   **Solution**: Check network connectivity or increase timeout

4. **Invalid JSON response**:
   ```
   Error: Invalid JSON response from API
   ```
   **Solution**: Check Flask API logs for errors

### Debug Mode

Enable debug logging:

```javascript
// The service automatically logs requests and responses
// Check console output for detailed information
```

## Performance Considerations

1. **API Health Check**: Called automatically before data requests
2. **Connection Reuse**: Each request creates a new connection (stateless)
3. **Timeout Handling**: Requests timeout after 30 seconds
4. **Error Retry**: No automatic retry (implement in your application if needed)

## Migration from Direct NSE Integration

If you're migrating from the previous direct NSE integration:

1. **No API changes**: All existing method signatures remain the same
2. **Better reliability**: Flask API handles session management
3. **Simplified code**: No more complex cookie/session handling
4. **Same data structure**: Response format remains consistent

## Support

For issues or questions:

1. Check Flask API logs
2. Run the integration test script
3. Verify API health with `/` endpoint
4. Check network connectivity

## Version History

- **v2.0.0**: Flask API integration
- **v1.0.0**: Direct NSE integration (deprecated)
