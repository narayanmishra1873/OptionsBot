const { openai } = require('@ai-sdk/openai');
const { streamText } = require('ai');
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const OptionChainService = require('./optionChainService');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize option chain service
const optionChainService = new OptionChainService();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Store conversation history (in production, use a database)
const conversations = new Map();

// System prompt for the assistant (can be changed as needed)
let SYSTEM_PROMPT = `
You are a helpful, concise, and expert financial assistant. Your responses should be clear, informative and short. 
`;

// Serve the main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Chat API endpoint
app.post('/api/chat', async (req, res) => {
  try {
    const { message, sessionId = 'default' } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Get or create conversation history
    if (!conversations.has(sessionId)) {
      // Always start with the system prompt
      conversations.set(sessionId, [
        { role: 'system', content: SYSTEM_PROMPT }
      ]);
    }
    const messages = conversations.get(sessionId);

    // Add user message
    messages.push({ role: 'user', content: message });

    // Check if this is an option chain request
    const optionRequest = optionChainService.isOptionChainRequest(message);
    
    let responseMessage = message;
    if (optionRequest.isOptionChainRequest) {
      try {
        console.log(`Fetching option chain data for ${optionRequest.symbol}...`);
        const optionData = await optionChainService.getOptionChain(optionRequest.symbol);
        const formattedData = optionChainService.formatOptionChainData(optionData);
        
        // Modify the user message to include the option data for AI context
        responseMessage = `${message}\n\nHere's the latest option chain data:\n${formattedData}\n\nPlease analyze and explain this data in a helpful way.`;
        
        // Update the messages array with the enhanced message
        messages[messages.length - 1].content = responseMessage;
      } catch (error) {
        console.error('Error fetching option data:', error);
        responseMessage = `${message}\n\nI'm sorry, I'm currently unable to fetch live option chain data due to a technical issue. However, I can still help you understand options trading concepts, strategies, and answer any questions you have about options!`;
        messages[messages.length - 1].content = responseMessage;
      }
    }

    // Generate AI response
    const result = await streamText({
      model: openai('gpt-4o-mini'),
      messages,
    });

    let fullResponse = '';
    
    // Set headers for streaming
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Stream the response
    for await (const delta of result.textStream) {
      fullResponse += delta;
      res.write(`data: ${JSON.stringify({ delta })}\n\n`);
    }

    // Add assistant message to history
    messages.push({ role: 'assistant', content: fullResponse });

    // Send final message and close stream
    res.write(`data: ${JSON.stringify({ done: true, fullResponse })}\n\n`);
    res.end();

  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Clear conversation history
app.delete('/api/chat/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  conversations.delete(sessionId);
  res.json({ message: 'Conversation cleared' });
});

// Option chain API endpoint
app.get('/api/option-chain/:symbol?', async (req, res) => {
  try {
    const symbol = req.params.symbol || 'NIFTY';
    console.log(`Direct API request for ${symbol} option chain...`);
    
    const optionData = await optionChainService.getOptionChain(symbol.toUpperCase());
    res.json({
      success: true,
      data: optionData
    });
  } catch (error) {
    console.error('Option chain API error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch option chain data',
      message: error.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`🤖 Minimalist AI Chatbot running at http://localhost:${PORT}`);
  console.log('Open your browser and start chatting!');
});
