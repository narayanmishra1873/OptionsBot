/**
 * Generic tool-calling AI workflow for agents.
 *
 * @param {Object} params
 * @param {Array} params.messages - Array of messages for the AI
 * @param {Array} params.tools - Array of tool schemas: { name, description, parameters }
 * @param {Object} params.toolImpls - Map of toolName => function
 * @param {Array} [params.toolCalls] - Array of tool calls: { toolName, args }
 * @param {Object} params.aiService - AIService instance
 * @param {number} [params.maxRetries]
 * @param {number} [params.timeoutMs]
 * @param {number} [params.temperature]
 * @param {number} [params.maxTokens]
 * @returns {Promise<{ aiResponse: string, toolResults: Object }>} - AI response and tool results
 */
async function generateWithTools(params) {
  let attempts = 0;
  const maxAttempts = params.maxRetries || 1;
  const totalAttempts = maxAttempts + 1;
  const timeoutMs = params.timeoutMs || 60000;
  // Format tools for LLM API if needed
  const formattedTools = Array.isArray(params.tools)
    ? params.tools.reduce((acc, tool) => {
        if (tool.name) {
          acc[tool.name] = {
            description: tool.description || '',
            parameters: tool.parameters || { type: 'object', properties: {}, required: [] }
          };
        }
        return acc;
      }, {})
    : params.tools;
  while (attempts < totalAttempts) {
    attempts++;
    let timeoutId = null;
    try {
      // 1. Run all requested tool calls and collect results
      const toolResults = {};
      if (Array.isArray(params.toolCalls) && params.toolImpls) {
        for (const call of params.toolCalls) {
          const { toolName, args } = call;
          if (typeof params.toolImpls[toolName] === 'function') {
            try {
              console.log(`[generateWithTools] Calling tool: ${toolName} with args:`, args);
              toolResults[toolName] = params.toolImpls[toolName](args);
              console.log(`[generateWithTools] Tool result for ${toolName}:`, toolResults[toolName]);
            } catch (err) {
              toolResults[toolName] = { error: err.message };
              console.log(`[generateWithTools] Tool error for ${toolName}:`, err.message);
            }
          } else {
            toolResults[toolName] = { error: 'Tool implementation not found' };
            console.log(`[generateWithTools] Tool implementation not found for ${toolName}`);
          }
        }
      } else {
        console.log('[generateWithTools] No tool calls requested.');
      }
      // 2. Compose final AI message (agent is responsible for formatting tool results)
      const finalMessages = params.messages;
      // 3. Call AI for final response
      let aiResponse = await params.aiService.generateStreamingResponse(finalMessages);
      console.log('[generateWithTools] AI service returned:', typeof aiResponse, aiResponse);
      
      // The AI service returns a streaming response object directly - don't wrap it
      // Just return it as-is since it implements async iteration
      const result = { aiResponse, toolResults };
      console.log('[generateWithTools] Returning result. aiResponse type:', typeof result.aiResponse);
      return result;
    } catch (error) {
      if (timeoutId) clearTimeout(timeoutId);
      // Always return an async iterable with the error message
      const errorMsg = `[generateWithTools] Error: ${error.message || error}`;
      return { aiResponse: stringToAsyncIterable(errorMsg), toolResults: {} };
    }
  }
  throw new Error('Failed to generate with tools after exhausting all retry attempts');
}

/**
 * Utility: Wrap a string as an async iterable (for streaming compatibility)
 */
function stringToAsyncIterable(str) {
  return {
    [Symbol.asyncIterator]: async function* () {
      yield str;
    }
  };
}

module.exports = { generateWithTools };
