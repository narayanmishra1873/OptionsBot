require('dotenv').config();

// Environment configuration
const config = {
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // AI Configuration
  ai: {
    model: process.env.AI_MODEL || 'gpt-4o-mini',
    maxTokens: parseInt(process.env.AI_MAX_TOKENS) || 2000,
    temperature: parseFloat(process.env.AI_TEMPERATURE) || 0.7,
  },
  
  // OpenAI Configuration
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
  },
  
  // Session Configuration
  session: {
    defaultSessionId: 'default',
    maxConversationLength: parseInt(process.env.MAX_CONVERSATION_LENGTH) || 50,
  },
  
  // Option Chain Configuration
  optionChain: {
    defaultSymbol: 'NIFTY',
    cacheTimeout: parseInt(process.env.CACHE_TIMEOUT) || 300000, // 5 minutes
  }
};

// Validate required environment variables
if (!config.openai.apiKey) {
  throw new Error('OPENAI_API_KEY is required');
}

module.exports = config;
