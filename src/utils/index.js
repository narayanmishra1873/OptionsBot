/**
 * Response utilities for consistent API responses
 */
class ResponseUtils {
  /**
   * Send success response
   */
  static success(res, data, message = 'Success') {
    return res.json({
      success: true,
      message,
      data,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Send error response
   */
  static error(res, message = 'Error', statusCode = 500, error = null) {
    return res.status(statusCode).json({
      success: false,
      message,
      error: error ? error.message : null,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Send validation error response
   */
  static validationError(res, errors) {
    return res.status(400).json({
      success: false,
      message: 'Validation error',
      errors,
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Validation utilities
 */
class ValidationUtils {
  /**
   * Validate required fields
   */
  static validateRequiredFields(obj, requiredFields) {
    const errors = [];
    
    requiredFields.forEach(field => {
      if (!obj[field]) {
        errors.push(`${field} is required`);
      }
    });
    
    return errors;
  }

  /**
   * Validate message format
   */
  static validateMessage(message) {
    const errors = [];
    
    if (!message || typeof message !== 'string') {
      errors.push('Message must be a non-empty string');
    }
    
    if (message && message.length > 10000) {
      errors.push('Message is too long (max 10000 characters)');
    }
    
    return errors;
  }
}

/**
 * Logger utilities
 */
class LoggerUtils {
  /**
   * Log with timestamp and level
   */
  static log(level, message, data = null) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
    
    console.log(logMessage);
    
    if (data) {
      console.log(JSON.stringify(data, null, 2));
    }
  }

  static info(message, data = null) {
    this.log('info', message, data);
  }

  static error(message, data = null) {
    this.log('error', message, data);
  }

  static warn(message, data = null) {
    this.log('warn', message, data);
  }

  static debug(message, data = null) {
    this.log('debug', message, data);
  }
}

module.exports = {
  ResponseUtils,
  ValidationUtils,
  LoggerUtils
};
