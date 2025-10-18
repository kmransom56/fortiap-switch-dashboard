// Test direct connectivity to FortiGate API
require('dotenv').config();

// Constants
const FGT_URL = process.env.FGT_URL || process.env.FORTIGATE_URL;
const FGT_TOKEN = process.env.FGT_TOKEN || process.env.FORTIGATE_API_TOKEN;

// Allow self-signed TLS if requested
if (String(process.env.ALLOW_SELF_SIGNED).toLowerCase() === 'true') {
  console.log('Allowing self-signed certificates (NODE_TLS_REJECT_UNAUTHORIZED=0)');
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
} else {
  console.log('Self-signed certificates not allowed. Enable with ALLOW_SELF_SIGNED=true in .env');
}

// Show configuration
console.log('Configuration:');
console.log('- FGT_URL:', FGT_URL);
console.log('- FGT_TOKEN:', FGT_TOKEN ? '********' + FGT_TOKEN.slice(-4) : 'not set');

// Helper function to make API requests with detailed error handling
async function testApiEndpoint(endpoint, description) {
  console.log(`\n----- Testing ${description} -----`);
  const url = `${FGT_URL}${endpoint}`;
  console.log(`URL: ${url}`);
  
  try {
    // Add a timeout to avoid hanging
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    console.log('Making request...');
    const startTime = Date.now();
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${FGT_TOKEN}`,
        'Accept': 'application/json'
      },
      signal: controller.signal
    });
    
    const endTime = Date.now();
    clearTimeout(timeoutId);
    
    console.log(`Response received in ${endTime - startTime}ms`);
    console.log(`Status: ${response.status} ${response.statusText}`);
    
    // Log headers
    console.log('Response headers:');
    for (const [key, value] of response.headers.entries()) {
      console.log(`  ${key}: ${value}`);
    }
    
    if (!response.ok) {
      const errorText = await response.text().catch(e => 'Error reading response body: ' + e.message);
      console.error('API request failed:');
      console.error(`Status: ${response.status} ${response.statusText}`);
      console.error(`Error body: ${errorText.substring(0, 1000)}`);
      return false;
    }
    
    const data = await response.json().catch(e => {
      console.error('Error parsing JSON response:', e.message);
      return null;
    });
    
    if (data) {
      console.log('Response data keys:', Object.keys(data));
      console.log('Success!');
      return true;
    } else {
      console.error('Response was not valid JSON');
      return false;
    }
  } catch (error) {
    console.error('Error making API request:');
    
    if (error.name === 'AbortError') {
      console.error('Request timed out after 10 seconds');
    } else if (error.cause) {
      console.error(`Error code: ${error.cause.code}`);
      console.error(`Error message: ${error.message}`);
      
      if (error.cause.code === 'ENOTFOUND') {
        console.error('Host not found. Check the FortiGate IP address/hostname.');
      } else if (error.cause.code === 'ECONNREFUSED') {
        console.error('Connection refused. Check if FortiGate is accepting connections on this port.');
      } else if (error.cause.code === 'CERT_HAS_EXPIRED') {
        console.error('SSL certificate has expired. Set ALLOW_SELF_SIGNED=true to bypass.');
      }
    } else {
      console.error(`Error: ${error.message}`);
    }
    
    return false;
  }
}

// Main function to run tests
async function runTests() {
  console.log('\n===== FortiGate API Test Tool =====');
  
  // Validate configuration
  if (!FGT_URL) {
    console.error('Error: FGT_URL not configured. Add FORTIGATE_URL or FGT_URL to .env file.');
    return;
  }
  
  if (!FGT_TOKEN) {
    console.error('Error: API token not configured. Add FORTIGATE_API_TOKEN or FGT_TOKEN to .env file.');
    return;
  }
  
  // Test endpoints
  const endpoints = [
    { path: '/api/v2/cmdb/system/status', desc: 'System Status' },
    { path: '/api/v2/monitor/wifi/managed_ap?format=JSON', desc: 'FortiAP List' },
    { path: '/api/v2/monitor/switch/controller/managed_switch?format=JSON', desc: 'FortiSwitch List' }
  ];
  
  console.log(`\nRunning ${endpoints.length} tests...\n`);
  
  let successCount = 0;
  for (const endpoint of endpoints) {
    const success = await testApiEndpoint(endpoint.path, endpoint.desc);
    if (success) successCount++;
  }
  
  console.log(`\n===== Test Results =====`);
  console.log(`${successCount} of ${endpoints.length} tests passed`);
  
  if (successCount === 0) {
    console.log('\nTroubleshooting Tips:');
    console.log('1. Verify FortiGate URL and port (https://ip:port) in .env');
    console.log('2. Check API token validity in FortiGate GUI');
    console.log('3. Ensure HTTPS access is enabled on FortiGate');
    console.log('4. Check network connectivity (ping/traceroute)');
    console.log('5. If using self-signed certificates, set ALLOW_SELF_SIGNED=true');
    console.log('6. Verify FortiGate REST API is enabled');
  }
}

// Run the tests
runTests().catch(error => {
  console.error('Unhandled error in test script:', error);
});