const { openai } = require('@ai-sdk/openai');
const { streamText } = require('ai');
const config = require('../../config');

class AIService {
  constructor() {
    this.model = openai(config.ai.model);
  }

  /**
   * Generate streaming AI response
   */
  async generateStreamingResponse(messages) {
    try {
      const result = await streamText({
        model: this.model,
        messages,
        maxTokens: config.ai.maxTokens,
        temperature: config.ai.temperature,
      });

      return result;
    } catch (error) {
      console.error('AI Service error:', error);
      throw new Error('Failed to generate AI response');
    }
  }

  /**
   * Generate streaming AI response with tool calling support
   */
  async generateStreamingResponseWithTools(messages, tools, toolChoice = 'auto') {
    try {
      const result = await streamText({
        model: this.model,
        messages,
        tools,
        toolChoice,
        maxTokens: config.ai.maxTokens,
        temperature: config.ai.temperature,
      });

      return result;
    } catch (error) {
      console.error('AI Service error with tools:', error);
      throw new Error('Failed to generate AI response with tools');
    }
  }

  /**
   * Generate non-streaming AI response
   */
  async generateResponse(messages) {
    try {
      const result = await streamText({
        model: this.model,
        messages,
        maxTokens: config.ai.maxTokens,
        temperature: config.ai.temperature,
      });

      let fullResponse = '';
      for await (const delta of result.textStream) {
        fullResponse += delta;
      }

      return fullResponse;
    } catch (error) {
      console.error('AI Service error:', error);
      throw new Error('Failed to generate AI response');
    }
  }
}

module.exports = AIService;
