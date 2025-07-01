from flask import Flask, jsonify, request
from flask_cors import CORS
import requests
import json
from datetime import datetime
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)  # Enable CORS for cross-origin requests

def create_nse_session():
    """Create a session with proper cookies and headers"""
    session = requests.Session()
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "*/*",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer": "https://www.nseindia.com/option-chain"
    }
    session.headers.update(headers)
    
    # Get cookies by accessing main pages
    session.get("https://www.nseindia.com")
    session.get("https://www.nseindia.com/option-chain")
    return session

def is_valid_option(option):
    """Check if option has valid data"""
    return option.get('lastPrice', 0) != 0

def get_nse_expiry_dates_internal(symbol="NIFTY"):
    """Internal function to fetch expiry dates"""
    session = create_nse_session()
    api_url = "https://www.nseindia.com/api/option-chain-contract-info"
    params = {"symbol": symbol}
    
    try:
        response = session.get(api_url, params=params)
        response.raise_for_status()
        data = response.json()
        
        # Extract expiry dates from the correct response structure
        expiry_dates = data.get('expiryDates', [])
        # Remove duplicates and sort by date (DD-MMM-YYYY)
        def parse_date(d):
            return datetime.strptime(d, '%d-%b-%Y')
        return sorted(set(expiry_dates), key=parse_date)
        
    except Exception as e:
        logger.error(f"Error fetching expiries: {e}")
        raise
    finally:
        session.close()

def fetch_option_chain_internal(expiry, symbol="NIFTY"):
    """Internal function to fetch option chain data"""
    session = create_nse_session()
    url = "https://www.nseindia.com/api/option-chain-v3"
    params = {
        "type": "Indices",
        "symbol": symbol,
        "expiry": expiry
    }
    
    try:
        response = session.get(url, params=params)
        response.raise_for_status()
        data = response.json()
        
        # Extract and filter CE/PE data
        ce_list = []
        pe_list = []
        all_options = []
        
        for entry in data.get('records', {}).get('data', []):
            option_entry = {
                "strikePrice": entry.get('strikePrice'),
                "expiryDate": expiry
            }
            
            if 'CE' in entry and entry['CE'] and is_valid_option(entry['CE']):
                ce_data = entry['CE'].copy()
                ce_data['optionType'] = 'CE'
                ce_list.append(ce_data)
                all_options.append(ce_data)
                
            if 'PE' in entry and entry['PE'] and is_valid_option(entry['PE']):
                pe_data = entry['PE'].copy()
                pe_data['optionType'] = 'PE'
                pe_list.append(pe_data)
                all_options.append(pe_data)
        
        # Get current market data
        market_data = {
            "underlyingValue": data.get('records', {}).get('underlyingValue'),
            "timestamp": data.get('records', {}).get('timestamp'),
            "totCE": data.get('records', {}).get('totCE'),
            "totPE": data.get('records', {}).get('totPE')
        }
        
        return {
            "marketData": market_data,
            "allOptions": all_options,
            "ceOptions": ce_list,
            "peOptions": pe_list,
            "totalCE": len(ce_list),
            "totalPE": len(pe_list)
        }
        
    except Exception as e:
        logger.error(f"Error fetching option chain: {e}")
        raise
    finally:
        session.close()

# API Routes

@app.route('/', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        "status": "healthy",
        "service": "NSE Options API",
        "version": "1.0.0",
        "endpoints": [
            "GET /api/expiry-dates - Get all expiry dates",
            "GET /api/option-chain?expiry=<date>&symbol=<symbol> - Get option chain for expiry",
            "GET /api/option-chain/ce?expiry=<date>&symbol=<symbol> - Get only CE options",
            "GET /api/option-chain/pe?expiry=<date>&symbol=<symbol> - Get only PE options"
        ]
    })

@app.route('/api/expiry-dates', methods=['GET'])
def get_expiry_dates():
    """Get all available expiry dates for NIFTY"""
    try:
        symbol = request.args.get('symbol', 'NIFTY')
        expiry_dates = get_nse_expiry_dates_internal(symbol)
        
        return jsonify({
            "success": True,
            "symbol": symbol,
            "expiryDates": expiry_dates,
            "count": len(expiry_dates),
            "timestamp": datetime.now().isoformat()
        })
        
    except Exception as e:
        logger.error(f"Error in get_expiry_dates: {e}")
        return jsonify({
            "success": False,
            "error": str(e),
            "timestamp": datetime.now().isoformat()
        }), 500

@app.route('/api/option-chain', methods=['GET'])
def get_option_chain():
    """Get complete option chain data for specific expiry"""
    try:
        expiry = request.args.get('expiry')
        symbol = request.args.get('symbol', 'NIFTY')
        
        if not expiry:
            return jsonify({
                "success": False,
                "error": "expiry parameter is required",
                "example": "/api/option-chain?expiry=27-Jun-2025"
            }), 400
        
        option_data = fetch_option_chain_internal(expiry, symbol)
        
        return jsonify({
            "success": True,
            "symbol": symbol,
            "expiry": expiry,
            "data": option_data,
            "timestamp": datetime.now().isoformat()
        })
        
    except Exception as e:
        logger.error(f"Error in get_option_chain: {e}")
        return jsonify({
            "success": False,
            "error": str(e),
            "timestamp": datetime.now().isoformat()
        }), 500

@app.route('/api/option-chain/ce', methods=['GET'])
def get_ce_options():
    """Get only Call (CE) options for specific expiry"""
    try:
        expiry = request.args.get('expiry')
        symbol = request.args.get('symbol', 'NIFTY')
        
        if not expiry:
            return jsonify({
                "success": False,
                "error": "expiry parameter is required",
                "example": "/api/option-chain/ce?expiry=27-Jun-2025"
            }), 400
        
        option_data = fetch_option_chain_internal(expiry, symbol)
        
        return jsonify({
            "success": True,
            "symbol": symbol,
            "expiry": expiry,
            "optionType": "CE",
            "marketData": option_data["marketData"],
            "options": option_data["ceOptions"],
            "count": option_data["totalCE"],
            "timestamp": datetime.now().isoformat()
        })
        
    except Exception as e:
        logger.error(f"Error in get_ce_options: {e}")
        return jsonify({
            "success": False,
            "error": str(e),
            "timestamp": datetime.now().isoformat()
        }), 500

@app.route('/api/option-chain/pe', methods=['GET'])
def get_pe_options():
    """Get only Put (PE) options for specific expiry"""
    try:
        expiry = request.args.get('expiry')
        symbol = request.args.get('symbol', 'NIFTY')
        
        if not expiry:
            return jsonify({
                "success": False,
                "error": "expiry parameter is required",
                "example": "/api/option-chain/pe?expiry=27-Jun-2025"
            }), 400
        
        option_data = fetch_option_chain_internal(expiry, symbol)
        
        return jsonify({
            "success": True,
            "symbol": symbol,
            "expiry": expiry,
            "optionType": "PE",
            "marketData": option_data["marketData"],
            "options": option_data["peOptions"],
            "count": option_data["totalPE"],
            "timestamp": datetime.now().isoformat()
        })
        
    except Exception as e:
        logger.error(f"Error in get_pe_options: {e}")
        return jsonify({
            "success": False,
            "error": str(e),
            "timestamp": datetime.now().isoformat()
        }), 500

@app.route('/api/current-market', methods=['GET'])
def get_current_market():
    """Get current NIFTY market data without full option chain"""
    try:
        symbol = request.args.get('symbol', 'NIFTY')
        
        # Get the first expiry to fetch current market data
        expiry_dates = get_nse_expiry_dates_internal(symbol)
        if not expiry_dates:
            raise Exception("No expiry dates available")
        
        option_data = fetch_option_chain_internal(expiry_dates[0], symbol)
        
        return jsonify({
            "success": True,
            "symbol": symbol,
            "marketData": option_data["marketData"],
            "nearestExpiry": expiry_dates[0],
            "timestamp": datetime.now().isoformat()
        })
        
    except Exception as e:
        logger.error(f"Error in get_current_market: {e}")
        return jsonify({
            "success": False,
            "error": str(e),
            "timestamp": datetime.now().isoformat()
        }), 500

if __name__ == '__main__':
    print("🚀 Starting NSE Options API Server...")
    print("📊 Available endpoints:")
    print("   GET /                           - Health check")
    print("   GET /api/expiry-dates           - Get expiry dates")
    print("   GET /api/option-chain           - Get full option chain")
    print("   GET /api/option-chain/ce        - Get CE options only")
    print("   GET /api/option-chain/pe        - Get PE options only")
    print("   GET /api/current-market         - Get current market data")
    print("\n🌐 Server will be available at: http://localhost:5000")
    
    # Run Flask development server
    app.run(debug=True, host='0.0.0.0', port=5000)
