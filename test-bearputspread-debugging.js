#!/usr/bin/env node

/**
 * Test script for BearPutSpreadAgent debugging output
 * This script tests if the agent provides comprehensive debugging information
 */

const BearPutSpreadAgent = require('./src/core/agents/specialized/BearPutSpreadAgent');

async function testBearPutSpreadAgentDebugging() {
    console.log('🧪 Testing BearPutSpreadAgent with Enhanced Debugging\n');
    
    const agent = new BearPutSpreadAgent();
    
    // Test message that should trigger the tools and debugging output
    const testMessage = "I think NIFTY will fall by 3% in the next week. Show me some bear put spread strategies with complete analysis.";
    const sessionId = 'test-session-001';
    
    try {
        console.log('📨 Sending test message to BearPutSpreadAgent...');
        console.log(`Message: "${testMessage}"\n`);
        
        const response = await agent.generateResponse(testMessage, sessionId, []);
        
        console.log('📤 Processing response stream...\n');
        console.log('=' * 80);
        console.log('AGENT RESPONSE:');
        console.log('=' * 80);
        
        let fullResponse = '';
        
        // Process the streaming response
        for await (const chunk of response.textStream) {
            process.stdout.write(chunk);
            fullResponse += chunk;
        }
        
        console.log('\n' + '=' * 80);
        console.log('RESPONSE ANALYSIS:');
        console.log('=' * 80);
        
        // Analyze the response for debugging content
        const hasDebuggingSection = fullResponse.includes('🔍 DETAILED ANALYSIS & DEBUGGING DATA');
        const hasRawData = fullResponse.includes('RAW MARKET DATA RECEIVED');
        const hasStrikeTable = fullResponse.includes('COMPLETE STRIKE PRICE DATA TABLE');
        const hasToolOutput = fullResponse.includes('Tool Output Received');
        const hasCalculationVerification = fullResponse.includes('CALCULATION VERIFICATION');
        const hasConfidenceScore = fullResponse.includes('RECOMMENDATION CONFIDENCE SCORE');
        
        console.log(`✅ Debugging Section Present: ${hasDebuggingSection ? 'YES' : 'NO'}`);
        console.log(`✅ Raw Market Data: ${hasRawData ? 'YES' : 'NO'}`);
        console.log(`✅ Strike Price Table: ${hasStrikeTable ? 'YES' : 'NO'}`);
        console.log(`✅ Tool Output Details: ${hasToolOutput ? 'YES' : 'NO'}`);
        console.log(`✅ Calculation Verification: ${hasCalculationVerification ? 'YES' : 'NO'}`);
        console.log(`✅ Confidence Scoring: ${hasConfidenceScore ? 'YES' : 'NO'}`);
        
        const debuggingScore = [
            hasDebuggingSection,
            hasRawData,
            hasStrikeTable,
            hasToolOutput,
            hasCalculationVerification,
            hasConfidenceScore
        ].filter(Boolean).length;
        
        console.log(`\n📊 Debugging Completeness Score: ${debuggingScore}/6`);
        
        if (debuggingScore >= 4) {
            console.log('🎉 SUCCESS: Agent provides comprehensive debugging output!');
        } else {
            console.log('⚠️  WARNING: Debugging output may be incomplete.');
        }
        
        // Check response length (should be substantial with debugging)
        console.log(`📏 Response Length: ${fullResponse.length} characters`);
        
        if (fullResponse.length > 2000) {
            console.log('✅ Response is comprehensive (good length)');
        } else {
            console.log('⚠️  Response might be too brief for proper debugging');
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error('Stack trace:', error.stack);
        
        // Check if it's a Flask API issue
        if (error.message.includes('Flask API') || error.message.includes('localhost:5000')) {
            console.log('\n💡 This might be a Flask API connectivity issue.');
            console.log('Make sure your Flask API server is running on http://localhost:5000');
            console.log('Run: python app.py in your Flask API directory');
        }
    }
}

// Handle process events
process.on('unhandledRejection', (reason, promise) => {
    console.error('💥 Unhandled Rejection:', reason);
    process.exit(1);
});

process.on('uncaughtException', (error) => {
    console.error('💥 Uncaught Exception:', error);
    process.exit(1);
});

// Run the test
testBearPutSpreadAgentDebugging().then(() => {
    console.log('\n🏁 Debugging test completed!');
    process.exit(0);
}).catch((error) => {
    console.error('\n💥 Test failed:', error.message);
    process.exit(1);
});
