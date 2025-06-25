const app = require('./app');
const config = require('./config');

const PORT = config.port;

console.log('🚀 Starting OptionsBot Multi-Agent System...');
console.log(`📋 Node.js version: ${process.version}`);
console.log(`🔧 Environment: ${config.nodeEnv}`);

app.listen(PORT, () => {
  console.log(`✅ OptionsBot Multi-Agent System running at http://localhost:${PORT}`);
  console.log(`📊 Environment: ${config.nodeEnv}`);
  console.log(`🎯 AI Model: ${config.ai.model}`);
  console.log('🌐 Open your browser and start chatting!');
  console.log('\n🔗 Available Endpoints:');
  console.log('   • GET  /                    - Web Interface');
  console.log('   • POST /api/chat            - Chat with AI');
  console.log('   • GET  /api/agents          - Get Agent Info');
  console.log('   • GET  /api/option-chain    - Get Option Chain Data');
  console.log('   • GET  /api/health          - Health Check');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('   • GET  /health              - Health Check');
});
