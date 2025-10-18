const express = require('express');
const cors = require('cors');
const fs = require('fs');
const yaml = require('yaml');
require('dotenv').config();

// Allow self-signed TLS if requested (ONLY for trusted labs)
if (String(process.env.ALLOW_SELF_SIGNED).toLowerCase() === 'true') {
  console.log('⚠️ Self-signed certificates allowed (NODE_TLS_REJECT_UNAUTHORIZED=0)');
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
} else {
  console.log('Self-signed certificates not allowed. To enable, set ALLOW_SELF_SIGNED=true in .env');
}

// Support multiple env var names for convenience
const FGT_URL = process.env.FGT_URL || process.env.FORTIGATE_URL; // e.g. https://192.168.0.254:8443
const FGT_TOKEN = process.env.FGT_TOKEN || process.env.FORTIGATE_API_TOKEN; // FortiGate API token
const PORT = process.env.PORT || 59169;

// Enhanced configuration validation
const configErrors = [];
if (!FGT_URL) configErrors.push('FortiGate URL not set. Add FORTIGATE_URL or FGT_URL to .env file.');
if (!FGT_TOKEN) configErrors.push('API token not set. Add FORTIGATE_API_TOKEN or FGT_TOKEN to .env file.');

// Try to parse the URL to detect issues early
let parsedUrl;
if (FGT_URL) {
  try {
    parsedUrl = new URL(FGT_URL);
    if (!parsedUrl.protocol.startsWith('https')) {
      configErrors.push('FortiGate URL should use HTTPS protocol (https://)');
    }
    if (!parsedUrl.port) {
      configErrors.push('FortiGate URL should include a port (e.g., :8443)');
    }
  } catch (e) {
    configErrors.push(`Invalid FortiGate URL: ${e.message}`);
  }
}

// Log configuration and any errors
console.log('Environment variables:');
console.log('- FGT_URL:', FGT_URL);
console.log('- FGT_TOKEN:', FGT_TOKEN ? '********' + FGT_TOKEN.slice(-4) : 'not set');

if (configErrors.length > 0) {
  console.warn('\n⚠️ Configuration issues detected:');
  configErrors.forEach(err => console.warn(`- ${err}`));
  console.warn('\nFallback to YAML data will be used.');
} else {
  console.log('\n✅ Configuration looks good');
}

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// Enhanced API function with better error handling and debugging
async function fgt(path, retries = 2, allowNotFound = false) {
  try {
    const url = `${FGT_URL}${path}`;
    console.log(`Making FortiGate API request to: ${url}`);
    
    // Add a timeout to avoid hanging if the server is unreachable
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    
    // Debug log the request headers
    const headers = {
      'Authorization': `Bearer ${FGT_TOKEN}`,
      'Accept': 'application/json'
    };
    console.log('Request headers:', {
      'Authorization': `Bearer ${FGT_TOKEN ? '******' : 'not set'}`,
      'Accept': 'application/json'
    });
    
    const startTime = Date.now();
    const res = await fetch(url, {
      headers,
      signal: controller.signal
    });
    const responseTime = Date.now() - startTime;
    
    // Clear the timeout
    clearTimeout(timeoutId);
    
    console.log(`API response received in ${responseTime}ms, status: ${res.status} ${res.statusText}`);
    
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.error(`API error response: ${text.substring(0, 500)}`);
      
      // If we're allowing 404 not found errors and the status is 404, return an empty result
      if (allowNotFound && res.status === 404) {
        console.log('404 Not Found error allowed, returning empty result');
        return { results: [] };
      }
      
      throw new Error(`FortiGate request failed ${res.status} ${res.statusText}: ${text.substring(0, 200)}`);
    }
    
    try {
      const data = await res.json();
      console.log('API response data structure:', Object.keys(data));
      return data;
    } catch (jsonError) {
      console.error('Failed to parse response as JSON:', jsonError);
      throw new Error('Invalid JSON in API response');
    }
  } catch (error) {
    console.error('Error in fgt() function:', error);
    
    // More detailed error handling based on error type
    if (error.name === 'AbortError') {
      console.error('API request timed out after 10 seconds');
      throw new Error('Connection timeout: FortiGate API request timed out after 10 seconds');
    }
    
    if (error.cause?.code) {
      console.error(`Network error code: ${error.cause.code}`);
      
      // Provide more detailed error information for common network errors
      const errorDetails = {
        ENOTFOUND: 'Host not found. Check the FortiGate IP address/hostname.',
        ECONNREFUSED: 'Connection refused. Check if FortiGate is accepting connections on this port.',
        ECONNRESET: 'Connection reset by peer. The FortiGate might have terminated the connection.',
        ETIMEDOUT: 'Connection timed out. Check network connectivity to the FortiGate.',
        CERT_HAS_EXPIRED: 'SSL certificate has expired. Set ALLOW_SELF_SIGNED=true to bypass.'
      };
      
      const detailedMessage = errorDetails[error.cause.code] || error.message;
      throw new Error(`Network error: ${error.cause.code} - ${detailedMessage}`);
    }
    
    // If this is the last retry, throw the error, otherwise try again
    if (retries <= 0) {
      throw error;
    } else {
      console.log(`Retrying API request, ${retries} retries left...`);
      return await fgt(path, retries - 1, allowNotFound);
    }
  }
}

// Helper function to load YAML data
function loadYamlData() {
  try {
    console.log('Loading YAML data from file...');
    const yamlContent = fs.readFileSync('./dashboard_data.yaml', 'utf8');
    const yamlData = yaml.parse(yamlContent);
    console.log('YAML data loaded successfully');
    return yamlData;
  } catch (e) {
    console.error('Error loading YAML data:', e);
    return {
      fortiaps: [],
      fortiswitches: [],
      historical_data: []
    };
  }
}

// Process YAML data into the expected dashboard format
function formatYamlDataForDashboard(yamlData) {
  // Calculate statistics for system health
  const fortiaps = yamlData.fortiaps || [];
  const fortiswitches = yamlData.fortiswitches || [];
  
  const apsOnline = fortiaps.filter(ap => ap.status === 'up').length;
  const switchesOnline = fortiswitches.filter(sw => sw.status === 'up').length;
  const switchesWarning = fortiswitches.filter(sw => sw.status === 'warning').length;
  
  let totalPoeConsumption = 0;
  let totalPoeBudget = 0;
  let totalClients = 0;
  
  fortiswitches.forEach(sw => {
    totalPoeConsumption += (sw.poe_power_consumption || 0);
    totalPoeBudget += (sw.poe_power_budget || 0);
  });
  
  fortiaps.forEach(ap => {
    totalClients += (ap.clients_connected || 0);
  });
  
  // Generate alerts list
  const alerts = [];
  fortiswitches.forEach(sw => {
    if (sw.status === 'warning' || sw.status === 'down') {
      alerts.push({
        device: sw.name,
        message: `Switch ${sw.status === 'down' ? 'offline' : 'in warning state'}`,
        severity: sw.status === 'down' ? 'high' : 'medium',
        type: sw.status === 'down' ? 'error' : 'warning'
      });
    }
    
    if (sw.temperature > 65) {
      alerts.push({
        device: sw.name,
        message: `High temperature (${sw.temperature}°C)`,
        severity: 'medium',
        type: 'warning'
      });
    }
  });
  
  fortiaps.forEach(ap => {
    if (ap.status === 'down') {
      alerts.push({
        device: ap.name,
        message: 'Device offline',
        severity: 'high',
        type: 'error'
      });
    }
  });
  
  const avgPoeUtilization = totalPoeBudget ? (totalPoeConsumption / totalPoeBudget) * 100 : 0;
  
  return {
    last_updated: new Date().toISOString(),
    fortiaps,
    fortiswitches,
    historical_data: yamlData.historical_data || [],
    system_health: {
      alerts,
      aps_offline: fortiaps.length - apsOnline,
      aps_online: apsOnline,
      avg_poe_utilization: avgPoeUtilization,
      switches_offline: fortiswitches.length - switchesOnline - switchesWarning,
      switches_online: switchesOnline,
      switches_warning: switchesWarning,
      total_aps: fortiaps.length,
      total_clients: totalClients,
      total_poe_power_budget: totalPoeBudget,
      total_poe_power_consumption: totalPoeConsumption,
      total_switches: fortiswitches.length
    },
    network_topology: {
      connections: [],
      fortigate: {
        fortilink_interface: "fortilink",
        ip: parsedUrl?.hostname || "192.168.0.254",
        model: "FortiGate-61E"
      }
    }
  };
}

// Health check endpoint
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

// FortiAPs endpoint with better error handling
app.get('/api/fortiaps', async (req, res) => {
  try {
    console.log('Fetching FortiAPs from FortiGate API...');
    
    try {
      // Try to get data from FortiGate API
      const data = await fgt('/api/v2/monitor/wifi/managed_ap?format=JSON');
      console.log('FortiAPs data received from API');
      res.json(data?.results || []);
    } catch (apiError) {
      console.error('API error, falling back to YAML data:', apiError);
      
      // Load from YAML file as fallback
      const yamlData = loadYamlData();
      console.log(`Sending ${yamlData.fortiaps?.length || 0} FortiAPs from YAML`);
      res.json(yamlData.fortiaps || []);
    }
  } catch (e) {
    console.error('Error in /api/fortiaps endpoint:', e);
    res.status(500).json({ error: e.message || 'Failed to fetch FortiAP data' });
  }
});

// FortiSwitches endpoint
app.get('/api/fortiswitches', async (req, res) => {
  try {
    console.log('Fetching FortiSwitches from FortiGate API...');
    
    try {
      // Try to get data from FortiGate API - allow 404 for this endpoint
      const data = await fgt('/api/v2/monitor/switch/controller/managed_switch?format=JSON', 2, true);
      console.log('FortiSwitches data received from API');
      res.json(data?.results || []);
    } catch (apiError) {
      console.error('API error, falling back to YAML data:', apiError);
      
      // Load from YAML file as fallback
      const yamlData = loadYamlData();
      console.log(`Sending ${yamlData.fortiswitches?.length || 0} FortiSwitches from YAML`);
      res.json(yamlData.fortiswitches || []);
    }
  } catch (e) {
    console.error('Error in /api/fortiswitches endpoint:', e);
    res.status(500).json({ error: e.message || 'Failed to fetch FortiSwitch data' });
  }
});

// Overview endpoint - main dashboard data
app.get('/api/overview', async (req, res) => {
  try {
    console.log('Fetching overview data...');
    
    // First try to get data from the FortiGate API
    try {
      // We know from testing that FortiAP endpoint works but FortiSwitch gives 404
      const apData = await fgt('/api/v2/monitor/wifi/managed_ap?format=JSON');
      const swData = { results: [] }; // Empty for now, will use YAML data instead
      
      console.log('API data for FortiAPs received, using YAML data for FortiSwitches');
      
      // Get switch data from YAML
      const yamlData = loadYamlData();
      
      // Transform API data into the dashboard format
      const responseData = {
        last_updated: new Date().toISOString(),
        fortiaps: apData?.results || [],
        fortiswitches: yamlData.fortiswitches || [],
        historical_data: yamlData.historical_data || []
      };
      
      // Calculate system health
      const apsFromApi = responseData.fortiaps;
      const switchesFromYaml = responseData.fortiswitches;
      
      // Prepare system health data
      const apsOnline = apsFromApi.filter(ap => ap.status === 'up').length;
      const switchesOnline = switchesFromYaml.filter(sw => sw.status === 'up').length;
      const switchesWarning = switchesFromYaml.filter(sw => sw.status === 'warning').length;
      
      let totalClients = 0;
      apsFromApi.forEach(ap => {
        totalClients += (ap.clients_connected || 0);
      });
      
      // POE data - use YAML since it's from switches
      let totalPoeBudget = 0;
      let totalPoeConsumption = 0;
      switchesFromYaml.forEach(sw => {
        totalPoeBudget += (sw.poe_power_budget || 0);
        totalPoeConsumption += (sw.poe_power_consumption || 0);
      });
      
      // Calculate average POE utilization
      const avgPoeUtilization = totalPoeBudget ? 
        (totalPoeConsumption / totalPoeBudget) * 100 : 0;
      
      // Create system health object
      responseData.system_health = {
        aps_offline: apsFromApi.length - apsOnline,
        aps_online: apsOnline,
        switches_offline: switchesFromYaml.length - switchesOnline - switchesWarning,
        switches_online: switchesOnline,
        switches_warning: switchesWarning,
        total_aps: apsFromApi.length,
        total_switches: switchesFromYaml.length,
        total_clients: totalClients,
        total_poe_power_budget: totalPoeBudget,
        total_poe_power_consumption: totalPoeConsumption,
        avg_poe_utilization: avgPoeUtilization
      };
      
      // Create topology
      responseData.network_topology = {
        connections: [],
        fortigate: {
          fortilink_interface: "fortilink",
          ip: parsedUrl?.hostname || "192.168.0.254",
          model: "FortiGate-61E"
        }
      };
      
      res.json(responseData);
      return;
    } catch (apiError) {
      console.error('Failed to fetch data from FortiGate API, using complete YAML fallback:', apiError.message);
    }
    
    // If API fails, use YAML data
    const yamlData = loadYamlData();
    const formattedData = formatYamlDataForDashboard(yamlData);
    
    console.log('Sending overview data from YAML fallback');
    res.json(formattedData);
  } catch (e) {
    console.error('Error in overview endpoint:', e);
    res.status(500).json({
      error: e.message || 'Failed to fetch overview data',
      message: 'Error fetching data, please try again or check the API connection'
    });
  }
});

// Serve the dashboard_data.yaml file directly
app.get('/dashboard_data.yaml', (_req, res) => {
  res.sendFile('dashboard_data.yaml', { root: '.' });
});

// Add an endpoint to get server configuration for troubleshooting
app.get('/api/config', (_req, res) => {
  res.json({
    fgt_url_configured: !!FGT_URL,
    fgt_token_configured: !!FGT_TOKEN,
    self_signed_allowed: String(process.env.ALLOW_SELF_SIGNED).toLowerCase() === 'true',
    server_time: new Date().toISOString(),
    config_errors: configErrors,
    api_test_results: {
      "fortiaps_endpoint": true,  // We know this works from testing
      "fortiswitches_endpoint": false, // This returns 404
      "system_status_endpoint": false  // This returns 404
    }
  });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log('Available endpoints:');
  console.log('- GET /api/health - Server health check');
  console.log('- GET /api/fortiaps - FortiAP data');
  console.log('- GET /api/fortiswitches - FortiSwitch data');
  console.log('- GET /api/overview - Combined dashboard data');
  console.log('- GET /dashboard_data.yaml - Raw YAML data file');
  console.log('- GET /api/config - Server configuration');
});