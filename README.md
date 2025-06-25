# Minimalist AI Chatbot

A simple command-line AI chatbot built with the AI SDK and OpenAI.

## Features

- Real-time streaming responses from OpenAI's GPT-4
- Conversation memory (maintains context)
- Simple command-line interface
- Easy to extend and customize

## Prerequisites

- Node.js 18+ 
- OpenAI API key

## Installation

1. Install dependencies:
```bash
npm install
```

## Usage

1. Make sure your OpenAI API key is set in the `.env` file:
```
OPENAI_API_KEY=your_openai_api_key_here
```

2. Run the chatbot:
```bash
npm start
```

3. Start chatting! Type your messages and press Enter. Type "exit" to quit.

## How it works

This chatbot uses:
- **AI SDK Core** for unified LLM integration
- **OpenAI Provider** for GPT-4 access
- **Streaming** for real-time response display
- **Message History** for conversation context

## Extending the Chatbot

You can easily extend this chatbot by:
- Adding tools for external API calls
- Implementing different AI models
- Adding a web interface
- Saving conversation history

## License

MIT
