#!/usr/bin/env node

/**
 * FortiSwitch API Endpoint Discovery
 * Tests various FortiSwitch API endpoints to find the correct one for FortiOS 7.6
 */

const FORTIGATE_URL = 'https://192.168.0.254:8443';
const API_TOKEN = 'f5q7tgy9tznpHwqxc5fmHtz01hn5Q0';

// Set environment for self-signed certificates
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

/**
 * Test an API endpoint
 */
async function testEndpoint(path) {
  const url = `${FORTIGATE_URL}${path}`;
  
  try {
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${API_TOKEN}`,
        'Accept': 'application/json'
      }
    });
    
    const statusText = response.ok ? '✅ WORKS' : `❌ ${response.status}`;
    
    if (response.ok) {
      const data = await response.json();
      const resultCount = data.results ? data.results.length : 'N/A';
      return {
        path,
        status: response.status,
        success: true,
        resultCount,
        data: data
      };
    } else {
      return {
        path,
        status: response.status,
        success: false
      };
    }
    
  } catch (error) {
    return {
      path,
      status: 'ERROR',
      success: false,
      error: error.message
    };
  }
}

/**
 * Test all possible FortiSwitch endpoints
 */
async function discoverFortiSwitchEndpoints() {
  console.log('🔍 FortiSwitch API Endpoint Discovery for FortiOS 7.6.4');
  console.log('=======================================================');
  
  const endpointsToTest = [
    // Switch Controller based endpoints
    '/api/v2/monitor/switch-controller/managed-switch',
    '/api/v2/monitor/switch-controller/fortiswitch',
    '/api/v2/monitor/switch-controller/fortiswitch-ports',
    '/api/v2/monitor/switch-controller/status',
    '/api/v2/monitor/switch-controller',
    
    // System based endpoints
    '/api/v2/monitor/system/fortiswitch',
    '/api/v2/monitor/system/switch',
    '/api/v2/monitor/system/interface?interface_name=*',
    
    // Direct switch endpoints
    '/api/v2/monitor/switch/managed_switch',
    '/api/v2/monitor/switch/fortiswitch',
    '/api/v2/monitor/switch/status',
    
    // Network endpoints
    '/api/v2/monitor/network/fortiswitch',
    '/api/v2/monitor/fortiswitch/managed_switch',
    '/api/v2/monitor/fortiswitch/status',
    
    // Configuration endpoints (might show switch config)
    '/api/v2/cmdb/switch-controller/managed-switch',
    '/api/v2/cmdb/switch-controller/fortiswitch-ports'
  ];
  
  console.log(`🧪 Testing ${endpointsToTest.length} possible endpoints...\n`);
  
  const results = [];
  
  for (const endpoint of endpointsToTest) {
    console.log(`Testing: ${endpoint}`);
    const result = await testEndpoint(endpoint);
    results.push(result);
    
    if (result.success) {
      console.log(`✅ SUCCESS - ${result.resultCount} results`);
      if (result.data && result.data.results && result.data.results.length > 0) {
        const sample = result.data.results[0];
        console.log(`   Sample data keys: ${Object.keys(sample).slice(0, 5).join(', ')}...`);
      }
    } else {
      console.log(`❌ Failed - ${result.status}`);
    }
    console.log('');
  }
  
  // Summary
  console.log('📋 DISCOVERY SUMMARY');
  console.log('===================');
  
  const working = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  if (working.length > 0) {
    console.log('\n✅ WORKING ENDPOINTS:');
    working.forEach(r => {
      console.log(`   ${r.path} (${r.resultCount} results)`);
    });
    
    console.log('\n🎯 RECOMMENDED ENDPOINT:');
    const best = working.find(r => r.path.includes('switch-controller') && r.resultCount > 0) || working[0];
    console.log(`   ${best.path}`);
    
    if (best.data && best.data.results && best.data.results.length > 0) {
      console.log('\n📊 SAMPLE DATA STRUCTURE:');
      console.log(JSON.stringify(best.data.results[0], null, 2));
    }
  } else {
    console.log('\n❌ NO WORKING FORTISWITCH ENDPOINTS FOUND');
    console.log('\nThis could mean:');
    console.log('- No FortiSwitches are connected to this FortiGate');
    console.log('- FortiLink is not configured');
    console.log('- Different API structure in FortiOS 7.6.4');
    console.log('- Need to check FNDN documentation for exact endpoint');
  }
  
  console.log('\n📚 FOR COMPLETE API DOCUMENTATION:');
  console.log('- Visit FNDN: https://fndn.fortinet.net');
  console.log('- Search for "FortiOS 7.6 REST API Reference"');
  console.log('- Look for switch-controller or FortiSwitch sections');
  
  return working;
}

// Main execution
if (require.main === module) {
  discoverFortiSwitchEndpoints()
    .then(results => {
      if (results.length > 0) {
        console.log(`\n🚀 Found ${results.length} working endpoint(s)!`);
        process.exit(0);
      } else {
        console.log('\n🔍 No FortiSwitch endpoints found. Check FNDN documentation.');
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('💥 Discovery failed:', error.message);
      process.exit(1);
    });
}

module.exports = { discoverFortiSwitchEndpoints, testEndpoint };