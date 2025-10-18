/**
 * Enhanced Fortinet API Client
 * Based on the Python FortigateAPI class from fortinet_mcp
 * Provides improved error handling, session management, and request abstraction
 */

// Read environment variables
const FGT_URL = process.env.FGT_URL || process.env.FORTIGATE_URL || 'https://192.168.0.254:8443';
const FGT_TOKEN = process.env.FGT_TOKEN || process.env.FORTIGATE_API_TOKEN || '';
const ALLOW_SELF_SIGNED = process.env.ALLOW_SELF_SIGNED === 'true';

// Set TLS rejection based on environment
if (ALLOW_SELF_SIGNED) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

class FortinetAPIClient {
  /**
   * Enhanced Fortinet API client with better error handling and session management
   * @param {string} baseUrl - Base URL for FortiGate (e.g., https://192.168.0.254:8443)
   * @param {string} apiToken - API token for authentication
   * @param {Object} options - Additional options
   */
  constructor(baseUrl = FGT_URL, apiToken = FGT_TOKEN, options = {}) {
    this.baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
    this.apiToken = apiToken;
    this.timeout = options.timeout || 30000; // 30 seconds default
    this.retries = options.retries || 3;
    this.retryDelay = options.retryDelay || 1000;
    this.allowSelfSigned = options.allowSelfSigned !== undefined ? options.allowSelfSigned : ALLOW_SELF_SIGNED;

    // Statistics
    this.stats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      lastRequestTime: null
    };
  }

  /**
   * Make an API request with enhanced error handling and retry logic
   * @param {string} method - HTTP method (GET, POST, PUT, DELETE)
   * @param {string} endpoint - API endpoint path (without /api/v2/ prefix)
   * @param {Object} options - Request options
   * @returns {Promise<Object>} - API response
   */
  async request(method, endpoint, options = {}) {
    // Normalize endpoint - ensure it starts with monitor/ or cmdb/
    const normalizedEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
    const url = `${this.baseUrl}/api/v2/${normalizedEndpoint}`;

    // Build headers
    const headers = {
      'Authorization': `Bearer ${this.apiToken}`,
      'Accept': 'application/json'
    };

    if (['POST', 'PUT', 'PATCH'].includes(method.toUpperCase())) {
      headers['Content-Type'] = 'application/json';
    }

    // Merge custom headers
    if (options.headers) {
      Object.assign(headers, options.headers);
    }

    // Build fetch options
    const fetchOptions = {
      method: method.toUpperCase(),
      headers
    };

    // Add body for POST/PUT/PATCH
    if (options.body && ['POST', 'PUT', 'PATCH'].includes(method.toUpperCase())) {
      fetchOptions.body = typeof options.body === 'string'
        ? options.body
        : JSON.stringify(options.body);
    }

    // Add abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);
    fetchOptions.signal = controller.signal;

    // Track statistics
    this.stats.totalRequests++;
    this.stats.lastRequestTime = new Date().toISOString();

    try {
      // Make request with retry logic
      const response = await this._makeRequestWithRetry(url, fetchOptions, this.retries);
      clearTimeout(timeoutId);

      // Handle response
      const result = await this._handleResponse(response, endpoint);
      this.stats.successfulRequests++;
      return result;

    } catch (error) {
      clearTimeout(timeoutId);
      this.stats.failedRequests++;
      throw this._enhanceError(error, method, endpoint);
    }
  }

  /**
   * Make request with retry logic
   * @private
   */
  async _makeRequestWithRetry(url, options, retriesLeft) {
    try {
      const response = await fetch(url, options);

      // Retry on 5xx errors
      if (response.status >= 500 && retriesLeft > 0) {
        await this._delay(this.retryDelay);
        return this._makeRequestWithRetry(url, options, retriesLeft - 1);
      }

      return response;
    } catch (error) {
      if (retriesLeft > 0 && error.name !== 'AbortError') {
        await this._delay(this.retryDelay);
        return this._makeRequestWithRetry(url, options, retriesLeft - 1);
      }
      throw error;
    }
  }

  /**
   * Handle API response
   * @private
   */
  async _handleResponse(response, endpoint) {
    // Check for specific error status codes
    if (response.status === 401) {
      throw new Error('Authentication failed. Check your API token and permissions.');
    }

    if (response.status === 403) {
      throw new Error('Access forbidden. Check API administrator permissions and trusted hosts configuration.');
    }

    if (response.status === 404) {
      throw new Error(`API endpoint not found: ${endpoint}. Check FortiOS version compatibility.`);
    }

    if (response.status === 429) {
      throw new Error('Rate limit exceeded. Too many requests.');
    }

    // Parse response
    let data;
    const contentType = response.headers.get('content-type');

    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      const text = await response.text();
      throw new Error(`Unexpected response format: ${text.substring(0, 100)}`);
    }

    // Check for API-level errors
    if (data.status === 'error') {
      throw new Error(data.error || data.message || 'API returned error status');
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${data.error || response.statusText}`);
    }

    return data;
  }

  /**
   * Enhance error with additional context
   * @private
   */
  _enhanceError(error, method, endpoint) {
    const enhancedError = new Error(
      `FortiGate API Error [${method} ${endpoint}]: ${error.message}`
    );
    enhancedError.originalError = error;
    enhancedError.method = method;
    enhancedError.endpoint = endpoint;
    enhancedError.timestamp = new Date().toISOString();
    return enhancedError;
  }

  /**
   * Delay helper for retries
   * @private
   */
  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Convenience methods for common HTTP verbs
   */
  async get(endpoint, params = {}) {
    // Build query string if params provided
    let url = endpoint;
    if (Object.keys(params).length > 0) {
      const queryString = new URLSearchParams(params).toString();
      url = `${endpoint}${endpoint.includes('?') ? '&' : '?'}${queryString}`;
    }
    return this.request('GET', url);
  }

  async post(endpoint, body = {}) {
    return this.request('POST', endpoint, { body });
  }

  async put(endpoint, body = {}) {
    return this.request('PUT', endpoint, { body });
  }

  async delete(endpoint) {
    return this.request('DELETE', endpoint);
  }

  /**
   * Get client statistics
   */
  getStats() {
    return {
      ...this.stats,
      successRate: this.stats.totalRequests > 0
        ? ((this.stats.successfulRequests / this.stats.totalRequests) * 100).toFixed(2) + '%'
        : 'N/A'
    };
  }

  /**
   * Reset statistics
   */
  resetStats() {
    this.stats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      lastRequestTime: null
    };
  }

  /**
   * Test API connectivity
   */
  async testConnection() {
    try {
      const result = await this.get('monitor/system/status');
      return {
        success: true,
        hostname: result.results?.hostname || 'unknown',
        version: result.results?.version || 'unknown',
        serial: result.results?.serial || 'unknown'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}

// Export singleton instance
const apiClient = new FortinetAPIClient();

module.exports = {
  FortinetAPIClient,
  apiClient
};
