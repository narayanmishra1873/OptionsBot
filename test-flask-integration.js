#!/usr/bin/env node

/**
 * Test script for Flask API integration with OptionChainService
 * This script tests the integration between Node.js and the Flask API
 */

const OptionChainService = require('./src/services/optionChain/OptionChainService');

async function main() {
    console.log('🚀 Testing Flask API Integration with OptionChainService\n');
    console.log('📋 Prerequisites:');
    console.log('   ✓ Flask API server should be running on http://localhost:5000');
    console.log('   ✓ Run: python app.py in your Flask API directory\n');

    const optionService = new OptionChainService();

    try {
        // Run comprehensive integration test
        console.log('🧪 Running comprehensive Flask API integration test...\n');
        const testResults = await optionService.testFlaskApiIntegration('NIFTY');
        
        // Display detailed results
        console.log('\n📊 Detailed Test Results:');
        console.log(JSON.stringify(testResults, null, 2));

        // If all tests pass, try to get actual option chain data
        const allTestsPassed = Object.values(testResults.tests).every(test => test.passed);
        
        if (allTestsPassed) {
            console.log('\n🎉 All tests passed! Fetching sample option chain data...\n');
            
            // Get option chain for nearest expiry
            const optionChain = await optionService.getOptionChainNearestExpiry('NIFTY');
            
            // Format and display the data
            const formattedData = optionService.formatFirstOptionOnly(optionChain);
            console.log(formattedData);
            
            console.log('\n✅ Flask API integration is working perfectly!');
            console.log('🔗 You can now use OptionChainService in your application.');
            
        } else {
            console.log('\n❌ Some tests failed. Please check:');
            console.log('   1. Flask API server is running on http://localhost:5000');
            console.log('   2. Flask API is responding correctly');
            console.log('   3. Network connectivity is working');
        }

    } catch (error) {
        console.error('\n💥 Integration test failed:');
        console.error(`   Error: ${error.message}`);
        console.log('\n🔧 Troubleshooting steps:');
        console.log('   1. Start Flask API: python app.py');
        console.log('   2. Verify it\'s running: curl http://localhost:5000');
        console.log('   3. Check for any firewall/port blocking');
        console.log('   4. Ensure Flask API dependencies are installed');
        
        process.exit(1);
    }
}

// Handle uncaught errors gracefully
process.on('unhandledRejection', (reason, promise) => {
    console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});

process.on('uncaughtException', (error) => {
    console.error('💥 Uncaught Exception:', error);
    process.exit(1);
});

// Run the test
main().then(() => {
    console.log('\n🏁 Integration test completed successfully!');
    process.exit(0);
}).catch((error) => {
    console.error('\n💥 Integration test failed:', error.message);
    process.exit(1);
});
