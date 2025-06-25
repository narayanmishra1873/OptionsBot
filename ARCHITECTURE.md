# OptionsBot Multi-Agent Architecture

## 🏗️ Architecture Overview

This is a sophisticated multi-agent AI system designed for options trading and financial analysis. The system uses a modular architecture with specialized agents that can handle different types of financial queries.

## 📁 Project Structure

```
OptionsBot/
├── src/
│   ├── index.js                 # Main entry point
│   ├── app.js                   # Express app configuration
│   ├── config/
│   │   └── index.js             # Environment configuration
│   ├── api/
│   │   ├── controllers/
│   │   │   ├── ChatController.js     # Chat API logic
│   │   │   └── OptionChainController.js # Option chain API logic
│   │   └── routes/
│   │       ├── chat.js              # Chat routes
│   │       └── optionChain.js       # Option chain routes
│   ├── core/
│   │   └── agents/
│   │       ├── BaseAgent.js         # Base agent class
│   │       ├── AgentManager.js      # Agent orchestration
│   │       └── specialized/
│   │           ├── OptionsAgent.js      # Options trading specialist
│   │           └── GeneralFinanceAgent.js # General finance advisor
│   ├── services/
│   │   ├── ai/
│   │   │   └── AIService.js         # AI/LLM service wrapper
│   │   ├── chat/
│   │   │   └── ConversationManager.js # Conversation history
│   │   └── optionChain/
│   │       └── OptionChainService.js    # NSE data fetching
│   └── utils/
│       └── index.js             # Utility functions
├── public/
│   └── index.html              # Frontend interface
├── package.json
└── README.md
```

## 🤖 Agent System

### BaseAgent
- Foundation class for all agents
- Defines core agent capabilities
- Handles priority system and message routing

### Specialized Agents

#### 1. OptionsAgent
- **Specialization**: Options trading, derivatives analysis
- **Triggers**: "option chain", "calls", "puts", "NIFTY", "BANKNIFTY"
- **Features**: 
  - Real-time NSE option chain data
  - Options Greeks analysis
  - Trading strategy recommendations
  - Open Interest analysis

#### 2. GeneralFinanceAgent
- **Specialization**: General financial advice, market analysis
- **Triggers**: General finance terms, greetings, investment queries
- **Features**: 
  - Stock market insights
  - Investment strategies
  - Portfolio guidance
  - Economic analysis

## 🔧 Key Features

### 1. Multi-Agent Architecture
- **Agent Selection**: Automatic routing based on message content
- **Priority System**: Agents have priorities for handling specific queries
- **Extensible**: Easy to add new specialized agents
- **Fallback**: Default to GeneralFinanceAgent for unmatched queries

### 2. Conversation Management
- **Session-based**: Maintains conversation history per session
- **Context Preservation**: System prompts and agent context
- **Memory Management**: Automatic conversation trimming
- **Statistics**: Conversation analytics

### 3. Real-time Data Integration
- **NSE Option Chain**: Live derivatives data
- **Streaming Responses**: Real-time AI responses
- **Error Handling**: Graceful fallbacks for data failures

### 4. Modern Architecture
- **Separation of Concerns**: Clear MVC pattern
- **Configuration Management**: Environment-based config
- **Error Handling**: Comprehensive error management
- **Logging**: Structured logging utilities

## 🚀 Getting Started

### Prerequisites
- Node.js 16+
- OpenAI API Key

### Installation
```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Add your OPENAI_API_KEY

# Start development server
npm run dev

# Start production server
npm start
```

### Environment Variables
```env
OPENAI_API_KEY=your_openai_api_key
PORT=3000
NODE_ENV=development
AI_MODEL=gpt-4o-mini
AI_MAX_TOKENS=2000
AI_TEMPERATURE=0.7
MAX_CONVERSATION_LENGTH=50
```

## 📡 API Endpoints

### Chat API
- `POST /api/chat` - Send message to AI
- `DELETE /api/chat/:sessionId` - Clear conversation
- `GET /api/chat/stats/:sessionId` - Get conversation stats
- `GET /api/chat/agents` - Get agent information

### Option Chain API
- `GET /api/option-chain/:symbol` - Get option chain data
- `GET /api/option-chain/symbols` - Get supported symbols

### Utility
- `GET /health` - Health check
- `GET /` - Web interface

## 🔌 Adding New Agents

### 1. Create Agent Class
```javascript
// src/core/agents/specialized/YourAgent.js
const BaseAgent = require('../BaseAgent');

class YourAgent extends BaseAgent {
  constructor() {
    super('YourAgent', SYSTEM_PROMPT);
  }

  canHandle(message) {
    // Logic to determine if this agent should handle the message
    return message.toLowerCase().includes('your-keyword');
  }

  getPriority(message) {
    // Return priority level (higher = more priority)
    return 5;
  }

  async processMessage(message, sessionId) {
    // Process and enhance the message
    return message;
  }
}

// System prompt at the bottom of the file
const SYSTEM_PROMPT = `
Your agent's system prompt here...
`;

module.exports = YourAgent;
```

### 2. Register Agent
```javascript
// src/core/agents/AgentManager.js
const YourAgent = require('./specialized/YourAgent');

// In initializeAgents() method:
this.agents.push(new YourAgent());
```

## 🎯 Agent Selection Logic

1. **Filtering**: Only active agents that can handle the message
2. **Priority Sorting**: Agents sorted by priority (highest first)
3. **Selection**: Highest priority agent is selected
4. **Fallback**: GeneralFinanceAgent if no specific agent matches

## 📊 System Prompts

Each agent maintains its own system prompt at the bottom of its file, allowing for:
- **Specialized Knowledge**: Agent-specific expertise
- **Consistent Behavior**: Maintained personality per agent
- **Easy Updates**: Modify prompts without changing code logic
- **Clear Separation**: Prompt management separate from business logic

## 🔄 Future Enhancements

### Planned Agents
- **TechnicalAnalysisAgent**: Chart patterns, indicators
- **NewsAnalysisAgent**: Market news interpretation
- **RiskManagementAgent**: Portfolio risk assessment
- **BacktestingAgent**: Strategy backtesting
- **CryptocurrencyAgent**: Digital asset analysis

### System Improvements
- Database integration for conversation persistence
- Rate limiting and authentication
- WebSocket support for real-time updates
- Agent performance analytics
- A/B testing for agent responses

## 🛠️ Development Guidelines

### Code Style
- Use clear, descriptive naming
- Maintain separation of concerns
- Add comprehensive error handling
- Include JSDoc comments for functions

### Agent Development
- Keep system prompts at file bottom
- Use priority system effectively
- Handle errors gracefully
- Log agent selection decisions

### Testing
- Test agent selection logic
- Validate API responses
- Check error handling
- Verify conversation flow

This architecture provides a solid foundation for a scalable, multi-agent financial AI system with room for extensive future enhancements.
