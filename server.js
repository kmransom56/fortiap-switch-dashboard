const express = require('express');
const cors = require('cors');
require('dotenv').config();

// Import data transformer
const { transformFortiAPs, transformFortiSwitches, generateSystemHealth } = require('./data-transformer');

// Import enhanced Fortinet API client
const { apiClient } = require('./fortinet-api-client');

// Import policy analyzer
const { PolicyAnalyzer } = require('./policy-analyzer');

// Import network topology generator
const { NetworkTopologyGenerator } = require('./network-topology');

// Allow self-signed TLS if requested (ONLY for trusted labs)
if (String(process.env.ALLOW_SELF_SIGNED).toLowerCase() === 'true') {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

// FortiOS API Configuration
const FGT_URL = process.env.FGT_URL || process.env.FORTIGATE_URL; // e.g. https://192.168.0.254
const FGT_TOKEN = process.env.FGT_TOKEN || process.env.FORTIGATE_API_TOKEN; // FortiGate API token
const PORT = process.env.PORT || 59169;

// FortiOS API token validation
if (!FGT_URL) {
  console.error('[ERROR] FGT_URL not set in .env file. Please set FGT_URL to your FortiGate IP address.');
  console.error('Example: FGT_URL=https://192.168.1.1');
  process.exit(1);
}

if (!FGT_TOKEN) {
  console.warn('[WARN] FGT_TOKEN not set in .env file.');
  console.warn('To use real FortiGate data:');
  console.warn('1. Create an API administrator in FortiGate:');
  console.warn('   - Go to System > Administrators');
  console.warn('   - Create new administrator with "REST API Admin" profile');
  console.warn('   - Copy the generated API token');
  console.warn('2. Set FGT_TOKEN=your_api_token in .env file');
  console.warn('3. Configure trusted hosts if needed for security');
  console.warn('');
  console.warn('Dashboard will use fallback YAML data until token is configured.');
} else {
  console.log('✅ Using FortiOS API token authentication');
}

// Log environment variables for debugging
console.log('\nFortiOS API Configuration:');
console.log('- FGT_URL:', FGT_URL);
console.log('- FGT_TOKEN:', FGT_TOKEN ? `${FGT_TOKEN.substring(0, 8)}...${FGT_TOKEN.slice(-4)} (${FGT_TOKEN.length} chars)` : 'not set');
console.log('- ALLOW_SELF_SIGNED:', process.env.ALLOW_SELF_SIGNED === 'true' ? 'enabled' : 'disabled');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('.'));

/**
 * FortiOS API client function
 * Implements proper FortiOS REST API authentication and request handling
 * @param {string} path - API endpoint path (e.g., '/api/v2/monitor/wifi/managed_ap')
 * @param {object} options - Request options
 * @returns {Promise<object>} - API response data
 */
async function fortiOSAPI(path, options = {}) {
  try {
    // Validate that we have an API token
    if (!FGT_TOKEN) {
      throw new Error('FortiOS API token not configured. Set FGT_TOKEN in .env file.');
    }
    
    // Construct full URL
    const url = `${FGT_URL}${path}`;
    console.log(`🔗 FortiOS API Request: ${options.method || 'GET'} ${url}`);
    
    // Set timeout to prevent hanging
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    
    // FortiOS API headers following best practices
    const headers = {
      'Authorization': `Bearer ${FGT_TOKEN}`,
      'Accept': 'application/json',
      'User-Agent': 'FortiAP-Dashboard/1.0'
    };
    
    // Add Content-Type for POST/PUT requests
    if (options.method && ['POST', 'PUT', 'PATCH'].includes(options.method.toUpperCase())) {
      headers['Content-Type'] = 'application/json';
    }
    
    // Merge any additional headers
    if (options.headers) {
      Object.assign(headers, options.headers);
    }
    
    console.log(`🔐 Auth: Bearer ${FGT_TOKEN.substring(0, 8)}...${FGT_TOKEN.slice(-4)}`);
    
    // Make the API request
    const requestOptions = {
      method: options.method || 'GET',
      headers,
      signal: controller.signal
    };
    
    // Add body for POST/PUT requests
    if (options.body) {
      requestOptions.body = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
    }
    
    const response = await fetch(url, requestOptions);
    
    // Clear the timeout
    clearTimeout(timeoutId);
    
    // Log response details
    console.log(`📡 Response: ${response.status} ${response.statusText}`);
    
    // Handle different response scenarios
    if (response.status === 401) {
      throw new Error('Authentication failed. Check your API token and permissions.');
    }
    
    if (response.status === 403) {
      throw new Error('Access forbidden. Check API administrator permissions and trusted hosts configuration.');
    }
    
    if (response.status === 404) {
      throw new Error(`API endpoint not found: ${path}. Check FortiOS version compatibility.`);
    }
    
    if (!response.ok) {
      let errorText = '';
      try {
        errorText = await response.text();
      } catch (e) {
        // Ignore text parsing errors
      }
      
      console.error(`❌ API Error Response: ${errorText}`);
      throw new Error(`FortiOS API request failed: ${response.status} ${response.statusText}${errorText ? ` - ${errorText}` : ''}`);
    }
    
    // Parse JSON response
    const data = await response.json();
    
    // Log response structure for debugging
    if (data && typeof data === 'object') {
      const keys = Object.keys(data);
      console.log(`✅ Response Data: ${keys.length} top-level keys [${keys.slice(0, 5).join(', ')}${keys.length > 5 ? '...' : ''}]`);
      
      // Log result count if available
      if (data.results && Array.isArray(data.results)) {
        console.log(`📊 Results: ${data.results.length} items`);
      }
    }
    
    return data;
    
  } catch (error) {
    console.error('❌ FortiOS API Error:', error.message);
    
    // Provide specific error details
    if (error.name === 'AbortError') {
      console.error('⏱️  Request timed out after 10 seconds');
      throw new Error('FortiOS API request timed out. Check network connectivity and FortiGate status.');
    }
    
    if (error.cause?.code === 'ECONNREFUSED') {
      console.error('🚫 Connection refused');
      throw new Error('Cannot connect to FortiGate. Check FGT_URL and ensure FortiGate is accessible.');
    }
    
    if (error.cause?.code === 'ENOTFOUND') {
      console.error('🌐 DNS resolution failed');
      throw new Error('Cannot resolve FortiGate hostname. Check FGT_URL in .env file.');
    }
    
    if (error.cause?.code === 'CERT_HAS_EXPIRED') {
      console.error('🔒 Certificate expired');
      throw new Error('FortiGate SSL certificate has expired. Set ALLOW_SELF_SIGNED=true or update certificate.');
    }
    
    // Re-throw with context
    throw error;
  }
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

// FortiAP API endpoint
app.get('/api/fortiaps', async (_req, res) => {
  try {
    console.log('📡 Fetching FortiAPs...');
    const data = await fortiOSAPI('/api/v2/monitor/wifi/managed_ap?format=name|wtp_id|status|ip|model|serial|uptime');
    
    // Transform data using our data transformer
    const rawAPs = data?.results ?? (Array.isArray(data) ? data : []);
    const transformedAPs = transformFortiAPs(rawAPs);
    
    res.json(transformedAPs);
  } catch (error) {
    console.error('❌ Error fetching FortiAPs:', error.message);
    res.status(500).json({ 
      error: error.message || 'Failed to fetch FortiAP data',
      timestamp: new Date().toISOString()
    });
  }
});

// FortiSwitch API endpoint
app.get('/api/fortiswitches', async (_req, res) => {
  try {
    console.log('📡 Fetching FortiSwitches...');
    const data = await fortiOSAPI('/api/v2/monitor/switch-controller/managed-switch/status');

    // Extract results array from API response
    const rawSwitches = data?.results ?? [];
    const transformedSwitches = transformFortiSwitches(rawSwitches);

    res.json(transformedSwitches);
  } catch (error) {
    console.error('❌ Error fetching FortiSwitches:', error.message);
    res.status(500).json({
      error: error.message || 'Failed to fetch FortiSwitch data',
      timestamp: new Date().toISOString()
    });
  }
});

// Main overview endpoint with comprehensive dashboard data
app.get('/api/overview', async (_req, res) => {
  try {
    console.log('📊 Fetching overview data...');
    
    let apData, swData;
    let usingFallbackData = false;
    
    try {
      // Attempt to get data from FortiOS API with parallel requests
      console.log('🔄 Attempting FortiOS API requests...');
      // Get FortiAP data (working)
      apData = await fortiOSAPI('/api/v2/monitor/wifi/managed_ap?format=name|wtp_id|status|ip|model|serial|uptime|client_count');
      
      // FortiSwitch endpoint - correct path for FortiOS 7.6+
      // Endpoint: /api/v2/monitor/switch-controller/managed-switch/status

      try {
        swData = await fortiOSAPI('/api/v2/monitor/switch-controller/managed-switch/status');
      } catch (switchError) {
        console.log('⚠️  FortiSwitch endpoint not available, using interface data');
        swData = await fortiOSAPI('/api/v2/monitor/system/interface');
      }
      
      console.log('✅ FortiOS API data retrieved successfully');
      
    } catch (apiError) {
      console.warn('⚠️  FortiOS API unavailable, using fallback data:', apiError.message);
      usingFallbackData = true;
      
      // Load YAML fallback data
      try {
        const fs = require('fs');
        const yaml = require('yaml');
        
        const yamlContent = fs.readFileSync('./dashboard_data.yaml', 'utf8');
        const yamlData = yaml.parse(yamlContent);
        
        console.log('📄 Using YAML fallback data');
        
        const responseData = {
          last_updated: new Date().toISOString(),
          fortiaps: yamlData.fortiaps || [],
          fortiswitches: yamlData.fortiswitches || [],
          historical_data: yamlData.historical_data || [],
          system_health: yamlData.system_health || generateSystemHealth(yamlData.fortiaps || [], yamlData.fortiswitches || []),
          network_topology: yamlData.network_topology || {
            connections: [],
            fortigate: {
              fortilink_interface: "fortilink",
              ip: FGT_URL?.replace('https://', '').replace('http://', '') || "192.168.1.1",
              model: "FortiGate"
            }
          },
          data_source: 'yaml_fallback',
          api_status: 'unreachable'
        };
        
        console.log(`📈 Fallback data loaded: ${responseData.fortiaps.length} APs, ${responseData.fortiswitches.length} switches`);
        res.json(responseData);
        return;
        
      } catch (yamlError) {
        console.error('❌ Failed to load YAML fallback data:', yamlError.message);
        throw new Error('Both FortiOS API and fallback data unavailable');
      }
    }
    
    // Transform FortiOS API data
    console.log('🔄 Transforming FortiOS API data...');
    
    const rawAPs = apData?.results ?? (Array.isArray(apData) ? apData : []);
    const rawSwitches = swData?.results ?? (Array.isArray(swData) ? swData : []);
    
    const transformedAPs = transformFortiAPs(rawAPs);
    const transformedSwitches = transformFortiSwitches(rawSwitches);
    const systemHealth = generateSystemHealth(transformedAPs, transformedSwitches);
    
    // Build comprehensive response
    const responseData = {
      last_updated: new Date().toISOString(),
      fortiaps: transformedAPs,
      fortiswitches: transformedSwitches,
      system_health: systemHealth,
      network_topology: {
        connections: [], // TODO: Can be populated from actual topology data
        fortigate: {
          fortilink_interface: "fortilink",
          ip: FGT_URL?.replace('https://', '').replace('http://', '') || "192.168.1.1",
          model: "FortiGate"
        }
      },
      historical_data: [], // TODO: Can be populated from historical monitoring data
      data_source: 'fortios_api',
      api_status: 'connected'
    };
    
    console.log(`✅ Live data processed: ${responseData.fortiaps.length} APs, ${responseData.fortiswitches.length} switches, ${responseData.system_health.alerts.length} alerts`);
    
    res.json(responseData);
    
  } catch (error) {
    console.error('❌ Overview endpoint error:', error.message);
    res.status(500).json({
      error: error.message || 'Failed to fetch overview data',
      timestamp: new Date().toISOString(),
      data_source: 'error'
    });
  }
});

// Serve the dashboard_data.yaml file directly
app.get('/dashboard_data.yaml', (_req, res) => {
  res.sendFile('dashboard_data.yaml', { root: '.' });
});

// Add a special endpoint that serves YAML data as JSON for fallback
app.get('/api/fallback-overview', async (_req, res) => {
  try {
    console.log('Loading fallback data from YAML...');
    const fs = require('fs');
    const yaml = require('yaml');
    
    const yamlContent = fs.readFileSync('./dashboard_data.yaml', 'utf8');
    const yamlData = yaml.parse(yamlContent);
    
    // Format the response
    const responseData = {
      last_updated: new Date().toISOString(),
      fortiaps: yamlData.fortiaps || [],
      fortiswitches: yamlData.fortiswitches || [],
      historical_data: yamlData.historical_data || [],
      network_topology: {
        connections: [],
        fortigate: {
          fortilink_interface: "fortilink",
          ip: "192.168.1.1",
          model: "FortiGate-61E"
        }
      },
      system_health: {
        alerts: [],
        aps_offline: yamlData.fortiaps ? yamlData.fortiaps.filter(ap => ap.status === 'down').length : 0,
        aps_online: yamlData.fortiaps ? yamlData.fortiaps.filter(ap => ap.status === 'up').length : 0,
        total_aps: yamlData.fortiaps ? yamlData.fortiaps.length : 0,
        switches_offline: yamlData.fortiswitches ? yamlData.fortiswitches.filter(sw => sw.status === 'down').length : 0,
        switches_online: yamlData.fortiswitches ? yamlData.fortiswitches.filter(sw => sw.status === 'up').length : 0,
        total_switches: yamlData.fortiswitches ? yamlData.fortiswitches.length : 0,
        total_clients: yamlData.fortiaps ? yamlData.fortiaps.reduce((sum, ap) => sum + ap.clients_connected, 0) : 0,
        total_poe_power_budget: yamlData.fortiswitches ? yamlData.fortiswitches.reduce((sum, sw) => sum + (sw.poe_power_budget || 0), 0) : 0,
        total_poe_power_consumption: yamlData.fortiswitches ? yamlData.fortiswitches.reduce((sum, sw) => sum + (sw.poe_power_consumption || 0), 0) : 0,
        avg_poe_utilization: 0
      }
    };
    
    // Calculate average POE utilization
    if (responseData.system_health.total_poe_power_budget > 0) {
      responseData.system_health.avg_poe_utilization =
        (responseData.system_health.total_poe_power_consumption / responseData.system_health.total_poe_power_budget) * 100;
    }
    
    console.log('Sending fallback data from YAML');
    res.json(responseData);
  } catch (e) {
    console.error('Error serving fallback data:', e);
    res.status(500).json({ error: e.message });
  }
});

// FortiOS API connectivity test endpoint
app.get('/api/test', async (_req, res) => {
  try {
    console.log('🧪 Testing FortiOS API connectivity...');
    
    // Environment information
    const envInfo = {
      fgt_url: FGT_URL,
      token_configured: !!FGT_TOKEN,
      token_length: FGT_TOKEN ? FGT_TOKEN.length : 0,
      token_preview: FGT_TOKEN ? `${FGT_TOKEN.substring(0, 8)}...${FGT_TOKEN.slice(-4)}` : 'not configured',
      self_signed_allowed: String(process.env.ALLOW_SELF_SIGNED).toLowerCase() === 'true',
      node_version: process.version
    };
    
    console.log('📋 Environment check:', envInfo);
    
    if (!FGT_TOKEN) {
      return res.status(400).json({
        success: false,
        error: 'FortiOS API token not configured',
        message: 'Set FGT_TOKEN in .env file to test API connectivity',
        env: envInfo,
        instructions: [
          '1. Create an API administrator in FortiGate (System > Administrators)',
          '2. Select "REST API Admin" profile',
          '3. Copy the generated API token',
          '4. Set FGT_TOKEN=your_token in .env file',
          '5. Restart the server and try again'
        ]
      });
    }
    
    try {
      // Test with a lightweight system status endpoint
      console.log('🔍 Testing system status endpoint...');
      const statusData = await fortiOSAPI('/api/v2/monitor/system/status');
      
      // Test FortiAP endpoint
      console.log('🔍 Testing FortiAP endpoint...');
      const apTestResult = await fortiOSAPI('/api/v2/monitor/wifi/managed_ap?count=1');
      
      // Test FortiSwitch endpoint  
      console.log('🔍 Testing FortiSwitch endpoint...');
      const switchTestResult = await fortiOSAPI('/api/v2/monitor/switch-controller/managed-switch/status');
      
      console.log('✅ All API tests passed');
      
      res.json({
        success: true,
        message: 'FortiOS API connectivity test successful',
        env: envInfo,
        test_results: {
          system_status: {
            success: true,
            hostname: statusData?.results?.hostname || 'unknown',
            version: statusData?.results?.version || 'unknown',
            serial: statusData?.results?.serial || 'unknown'
          },
          fortiap_endpoint: {
            success: true,
            endpoint: '/api/v2/monitor/wifi/managed_ap',
            count: apTestResult?.results?.length || 0
          },
          fortiswitch_endpoint: {
            success: true,
            endpoint: '/api/v2/monitor/switch-controller/managed-switch/status',
            count: switchTestResult?.results?.length || 0
          }
        },
        timestamp: new Date().toISOString()
      });
      
    } catch (apiError) {
      console.error('❌ API test failed:', apiError.message);
      
      res.status(500).json({
        success: false,
        error: 'FortiOS API test failed',
        message: apiError.message,
        env: envInfo,
        troubleshooting: [
          'Check if FortiGate is reachable at the configured URL',
          'Verify the API token is valid and not expired',
          'Ensure the API administrator has proper permissions',
          'Check trusted hosts configuration in FortiGate',
          'Verify FortiGate management interface is accessible'
        ],
        timestamp: new Date().toISOString()
      });
    }
    
  } catch (error) {
    console.error('❌ Test endpoint error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Test endpoint internal error',
      message: error.message || 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

// ========================================
// NEW ENHANCED ENDPOINTS (from fortinet_mcp)
// ========================================

// Firewall Policies Endpoint
app.get('/api/firewall/policies', async (_req, res) => {
  try {
    console.log('🔥 Fetching firewall policies...');
    const data = await apiClient.get('cmdb/firewall/policy');

    // Transform policies for dashboard display
    const policies = (data?.results || []).map(policy => ({
      id: policy.policyid,
      name: policy.name || `Policy ${policy.policyid}`,
      status: policy.status || 'enable',
      action: policy.action || 'accept',
      source_interfaces: policy.srcintf || [],
      destination_interfaces: policy.dstintf || [],
      source_addresses: policy.srcaddr || [],
      destination_addresses: policy.dstaddr || [],
      services: policy.service || [],
      schedule: policy.schedule || 'always',
      nat: policy.nat || 'disable',
      hits: policy.hit_count || 0,
      bytes: policy.bytes || 0,
      packets: policy.packets || 0
    }));

    res.json({
      total_policies: policies.length,
      enabled_policies: policies.filter(p => p.status === 'enable').length,
      disabled_policies: policies.filter(p => p.status === 'disable').length,
      policies: policies
    });

  } catch (error) {
    console.error('❌ Error fetching firewall policies:', error.message);
    res.status(500).json({
      error: error.message || 'Failed to fetch firewall policies',
      timestamp: new Date().toISOString()
    });
  }
});

// VPN Status Endpoint
app.get('/api/vpn/status', async (_req, res) => {
  try {
    console.log('🔐 Fetching VPN status...');

    // Fetch both IPsec and SSL-VPN status
    const [ipsec, sslvpn] = await Promise.all([
      apiClient.get('monitor/vpn/ipsec').catch(e => ({ results: [] })),
      apiClient.get('monitor/vpn/ssl').catch(e => ({ results: [] }))
    ]);

    const ipsecTunnels = (ipsec?.results || []).map(tunnel => ({
      name: tunnel.name || 'Unknown',
      type: 'ipsec',
      status: tunnel.proxyid && tunnel.proxyid.length > 0 && tunnel.proxyid[0].status === 'up' ? 'up' : 'down',
      remote_gateway: tunnel['rgwy'] || 'Unknown',
      incoming_bytes: tunnel.incoming_bytes || 0,
      outgoing_bytes: tunnel.outgoing_bytes || 0,
      tunnel_id: tunnel.tun_id || 0
    }));

    const sslvpnUsers = (sslvpn?.results || []).map(user => ({
      username: user.user_name || 'Unknown',
      type: 'ssl-vpn',
      status: 'connected',
      remote_host: user.remote_host || 'Unknown',
      virtual_ip: user.assigned_ip || 'Unknown',
      connected_since: user.login_time || 'Unknown',
      bytes_sent: user.bytes_sent || 0,
      bytes_received: user.bytes_received || 0
    }));

    res.json({
      ipsec_tunnels: {
        total: ipsecTunnels.length,
        up: ipsecTunnels.filter(t => t.status === 'up').length,
        down: ipsecTunnels.filter(t => t.status === 'down').length,
        tunnels: ipsecTunnels
      },
      ssl_vpn: {
        total_users: sslvpnUsers.length,
        users: sslvpnUsers
      },
      summary: {
        total_vpn_connections: ipsecTunnels.length + sslvpnUsers.length,
        active_connections: ipsecTunnels.filter(t => t.status === 'up').length + sslvpnUsers.length
      }
    });

  } catch (error) {
    console.error('❌ Error fetching VPN status:', error.message);
    res.status(500).json({
      error: error.message || 'Failed to fetch VPN status',
      timestamp: new Date().toISOString()
    });
  }
});

// System Performance Endpoint
app.get('/api/system/performance', async (_req, res) => {
  try {
    console.log('📊 Fetching system performance...');

    // Fetch system resources and performance data
    const [resources, status] = await Promise.all([
      apiClient.get('monitor/system/resource-usage').catch(e => ({ results: {} })),
      apiClient.get('monitor/system/status').catch(e => ({ results: {} }))
    ]);

    const resourceData = resources?.results || {};
    const statusData = status?.results || {};

    res.json({
      cpu: {
        usage: resourceData.cpu || 0,
        usage_1min: resourceData['cpu-1min'] || 0,
        usage_5min: resourceData['cpu-5min'] || 0,
        cores: statusData.cpu_count || 1
      },
      memory: {
        total: resourceData['mem-total'] || 0,
        used: resourceData['mem-used'] || 0,
        free: resourceData['mem-free'] || 0,
        usage_percent: resourceData['mem-used'] && resourceData['mem-total']
          ? Math.round((resourceData['mem-used'] / resourceData['mem-total']) * 100)
          : 0
      },
      disk: {
        total: resourceData['disk-total'] || 0,
        used: resourceData['disk-used'] || 0,
        free: resourceData['disk-free'] || 0,
        usage_percent: resourceData['disk-used'] && resourceData['disk-total']
          ? Math.round((resourceData['disk-used'] / resourceData['disk-total']) * 100)
          : 0
      },
      sessions: {
        current: resourceData.sessions || 0,
        max: resourceData['session-max'] || 0,
        usage_percent: resourceData.sessions && resourceData['session-max']
          ? Math.round((resourceData.sessions / resourceData['session-max']) * 100)
          : 0
      },
      uptime: statusData.uptime || 0,
      hostname: statusData.hostname || 'Unknown'
    });

  } catch (error) {
    console.error('❌ Error fetching system performance:', error.message);
    res.status(500).json({
      error: error.message || 'Failed to fetch system performance',
      timestamp: new Date().toISOString()
    });
  }
});

// Security Threats Endpoint
app.get('/api/security/threats', async (_req, res) => {
  try {
    console.log('🛡️  Fetching security threats...');

    // Fetch IPS and AV statistics
    const [ipsStats, avStats] = await Promise.all([
      apiClient.get('monitor/ips/anomaly').catch(e => ({ results: [] })),
      apiClient.get('monitor/antivirus/stats').catch(e => ({ results: {} }))
    ]);

    res.json({
      ips: {
        total_detections: ipsStats?.results?.length || 0,
        recent_events: (ipsStats?.results || []).slice(0, 10).map(event => ({
          severity: event.severity || 'unknown',
          signature: event.signature || 'Unknown',
          source: event.src || 'Unknown',
          destination: event.dst || 'Unknown',
          action: event.action || 'Unknown',
          timestamp: event.timestamp || new Date().toISOString()
        }))
      },
      antivirus: {
        total_detections: avStats?.results?.total || 0,
        blocked: avStats?.results?.blocked || 0,
        passed: avStats?.results?.passed || 0,
        engines: avStats?.results?.engines || []
      },
      summary: {
        total_threats: (ipsStats?.results?.length || 0) + (avStats?.results?.total || 0),
        status: (ipsStats?.results?.length || 0) > 0 || (avStats?.results?.total || 0) > 0
          ? 'active_threats'
          : 'no_threats'
      }
    });

  } catch (error) {
    console.error('❌ Error fetching security threats:', error.message);
    res.status(500).json({
      error: error.message || 'Failed to fetch security threats',
      timestamp: new Date().toISOString()
    });
  }
});

// API Client Statistics Endpoint
app.get('/api/client/stats', (_req, res) => {
  try {
    const stats = apiClient.getStats();
    res.json(stats);
  } catch (error) {
    console.error('❌ Error fetching client stats:', error.message);
    res.status(500).json({
      error: error.message || 'Failed to fetch client statistics',
      timestamp: new Date().toISOString()
    });
  }
});

// ========================================
// FIREWALL OPTIMIZER ENDPOINTS
// ========================================

// Firewall Policy Analysis Endpoint
app.get('/api/firewall/analysis', async (_req, res) => {
  try {
    console.log('🔬 Analyzing firewall policies...');

    // Fetch all firewall policies
    const data = await apiClient.get('cmdb/firewall/policy');
    const policies = data?.results || [];

    // Create analyzer instance and run analysis
    const analyzer = new PolicyAnalyzer();
    const analysis = analyzer.analyzePolicies(policies);

    res.json({
      ...analysis,
      analyzed_at: new Date().toISOString(),
      fortigate: {
        url: process.env.FGT_URL,
        policies_analyzed: policies.length
      }
    });

  } catch (error) {
    console.error('❌ Error analyzing policies:', error.message);
    res.status(500).json({
      error: error.message || 'Failed to analyze firewall policies',
      timestamp: new Date().toISOString()
    });
  }
});

// Policy Simulation Endpoint
app.post('/api/firewall/simulate', async (req, res) => {
  try {
    console.log('🧪 Simulating packet through firewall...');

    const {
      source_ip,
      destination_ip,
      destination_port,
      protocol = 'tcp'
    } = req.body;

    // Validate required fields
    if (!source_ip || !destination_ip || !destination_port) {
      return res.status(400).json({
        error: 'Missing required fields: source_ip, destination_ip, destination_port',
        timestamp: new Date().toISOString()
      });
    }

    // Fetch all policies
    const data = await apiClient.get('cmdb/firewall/policy');
    const policies = data?.results || [];

    // Simulate packet (simple matching logic)
    const matchingPolicy = policies.find(policy => {
      // This is a simplified simulation - real implementation would need
      // to check address objects, service objects, etc.
      const isEnabled = policy.status === 'enable';
      return isEnabled; // In production, add proper IP/port matching logic
    });

    res.json({
      simulation: {
        source_ip,
        destination_ip,
        destination_port,
        protocol
      },
      matched_policy: matchingPolicy ? {
        id: matchingPolicy.policyid,
        name: matchingPolicy.name,
        action: matchingPolicy.action,
        nat: matchingPolicy.nat
      } : null,
      result: matchingPolicy ? matchingPolicy.action : 'deny (implicit)',
      evaluated_policies: policies.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error simulating packet:', error.message);
    res.status(500).json({
      error: error.message || 'Failed to simulate packet',
      timestamp: new Date().toISOString()
    });
  }
});

// Security Risk Assessment Endpoint
app.get('/api/security/risk-assessment', async (_req, res) => {
  try {
    console.log('🎯 Performing security risk assessment...');

    // Fetch policies and analyze
    const policyData = await apiClient.get('cmdb/firewall/policy');
    const policies = policyData?.results || [];

    const analyzer = new PolicyAnalyzer();
    const analysis = analyzer.analyzePolicies(policies);

    // Calculate overall risk score
    const riskFactors = {
      broad_policies: analysis.broad_policies.length,
      unused_policies: analysis.unused_policies.length,
      duplicate_policies: analysis.duplicates.length,
      critical_broad: analysis.broad_policies.filter(p => p.risk_level === 'critical').length
    };

    const riskScore = 100 - analysis.optimization_score;

    const riskLevel = riskScore < 30 ? 'low' :
                     riskScore < 60 ? 'medium' :
                     riskScore < 80 ? 'high' : 'critical';

    res.json({
      overall_risk_score: riskScore,
      risk_level: riskLevel,
      risk_factors: riskFactors,
      policy_analysis: {
        total_policies: analysis.total_policies,
        enabled_policies: analysis.enabled_policies,
        optimization_score: analysis.optimization_score
      },
      security_issues: {
        critical: analysis.broad_policies.filter(p => p.risk_level === 'critical').length,
        high: analysis.broad_policies.filter(p => p.risk_level === 'high').length,
        medium: analysis.broad_policies.filter(p => p.risk_level === 'medium').length + analysis.similar_pairs.length,
        low: analysis.unused_policies.length
      },
      recommendations: analysis.recommendations,
      assessed_at: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error performing risk assessment:', error.message);
    res.status(500).json({
      error: error.message || 'Failed to perform risk assessment',
      timestamp: new Date().toISOString()
    });
  }
});

// =============================================================================
// Switch Detected Devices Endpoint
// =============================================================================

/**
 * Switch Detected Devices Endpoint
 * Fetches devices detected/connected to FortiSwitch ports
 *
 * GET /api/switch/detected-devices
 * Returns: Devices detected on switch ports
 */
app.get('/api/switch/detected-devices', async (req, res) => {
  try {
    console.log('🔍 Fetching switch detected devices...');

    const data = await apiClient.get('monitor/switch-controller/detected-device');
    const devices = data?.results || [];

    console.log(`✅ Found ${devices.length} detected devices on switches`);

    res.json({
      total_devices: devices.length,
      devices: devices,
      timestamp: new Date().toISOString(),
      fortigate: {
        url: process.env.FGT_URL
      }
    });

  } catch (error) {
    console.error('❌ Error fetching switch detected devices:', error.message);
    res.status(500).json({
      error: error.message || 'Failed to fetch switch detected devices',
      timestamp: new Date().toISOString()
    });
  }
});

// =============================================================================
// WiFi Client Details Endpoint
// =============================================================================

/**
 * WiFi Clients Endpoint
 * Fetches detailed WiFi client information for all APs or specific AP
 *
 * GET /api/wifi/clients?wtp=AP_NAME (optional)
 * Returns: Detailed WiFi client information
 */
app.get('/api/wifi/clients', async (req, res) => {
  try {
    const wtpName = req.query.wtp; // Optional AP filter
    console.log(`📱 Fetching WiFi clients${wtpName ? ` for ${wtpName}` : ''}...`);

    // Build endpoint with optional WTP filter
    let endpoint = 'monitor/wifi/client';
    if (wtpName) {
      endpoint += `?wtp=${wtpName}`;
    }

    const data = await apiClient.get(endpoint);
    const clients = data?.results || [];

    // Transform client data
    const transformedClients = clients.map(client => ({
      // Client identification
      mac: client.mac || 'Unknown',
      ip: client.ip || 'Unknown',
      hostname: client.hostname || client.host || 'Unknown',
      manufacturer: client.manufacturer || 'Unknown',
      os: client.os || 'Unknown',

      // AP information
      ap_name: client.wtp_name || 'Unknown',
      ap_serial: client.wtp_id || 'Unknown',
      ap_ip: client.wtp_ip || 'Unknown',
      ssid: client.ssid || 'Unknown',
      vap_name: client.vap_name || 'Unknown',

      // Connection details
      signal: client.signal || 0,
      snr: client.snr || 0,
      noise: client.noise || -95,
      channel: client.channel || 0,
      radio_type: client.radio_type || 'Unknown',
      mimo: client.mimo || 'Unknown',

      // Data rates
      rx_rate: client.sta_rxrate || 0,
      tx_rate: client.sta_txrate || 0,
      rx_rate_mbps: client.data_rxrate_bps ? (client.data_rxrate_bps / 1000000).toFixed(1) : '0.0',
      tx_rate_mbps: client.data_txrate_bps ? (client.data_txrate_bps / 1000000).toFixed(1) : '0.0',

      // Traffic statistics
      bytes_rx: client.bytes_rx || 0,
      bytes_tx: client.bytes_tx || 0,
      packets_rx: client.packets_rx || 0,
      packets_tx: client.packets_tx || 0,
      bandwidth_rx: client.bandwidth_rx || 0,
      bandwidth_tx: client.bandwidth_tx || 0,

      // Connection quality
      tx_retry_percentage: client.tx_retry_percentage || 0,
      tx_discard_percentage: client.tx_discard_percentage || 0,
      idle_time: client.idle_time || 0,
      association_time: client.association_time || 0,

      // Security
      security: client.security_str || 'Unknown',
      authentication: client.authentication || 'Unknown',
      vlan_id: client.vlan_id || 0,

      // Capabilities
      capabilities: {
        '11k': client['11k_capable'] || false,
        '11v': client['11v_capable'] || false,
        '11r': client['11r_capable'] || false
      },

      // Health status (if available)
      health: client.health || null
    }));

    // Group by AP
    const clientsByAP = {};
    transformedClients.forEach(client => {
      if (!clientsByAP[client.ap_name]) {
        clientsByAP[client.ap_name] = [];
      }
      clientsByAP[client.ap_name].push(client);
    });

    console.log(`✅ Found ${transformedClients.length} WiFi clients across ${Object.keys(clientsByAP).length} APs`);

    res.json({
      total_clients: transformedClients.length,
      clients: transformedClients,
      clients_by_ap: clientsByAP,
      timestamp: new Date().toISOString(),
      fortigate: {
        url: process.env.FGT_URL
      }
    });

  } catch (error) {
    console.error('❌ Error fetching WiFi clients:', error.message);
    res.status(500).json({
      error: error.message || 'Failed to fetch WiFi clients',
      timestamp: new Date().toISOString()
    });
  }
});

// =============================================================================
// Network Topology Endpoints (from fortinet_mcp + firewall_optimizer)
// =============================================================================

/**
 * Network Topology Endpoint
 * Generates comprehensive network topology from FortiGate, FortiAP, and FortiSwitch data
 *
 * GET /api/network/topology
 * Returns: Complete network topology with devices and connections
 */
app.get('/api/network/topology', async (req, res) => {
  try {
    console.log('📡 Generating network topology...');

    // Fetch all device data
    const [systemStatus, apData, switchData, policyData] = await Promise.all([
      apiClient.get('monitor/system/status').catch(err => {
        console.warn('⚠️  Could not fetch system status:', err.message);
        return { results: {} };
      }),
      apiClient.get('monitor/wifi/managed_ap').catch(err => {
        console.warn('⚠️  Could not fetch FortiAP data:', err.message);
        return { results: [] };
      }),
      apiClient.get('monitor/switch-controller/managed-switch/status').catch(err => {
        console.warn('⚠️  Could not fetch FortiSwitch data:', err.message);
        return { results: [] };
      }),
      apiClient.get('cmdb/firewall/policy').catch(err => {
        console.warn('⚠️  Could not fetch firewall policies:', err.message);
        return { results: [] };
      })
    ]);

    // Extract data
    const fortigateInfo = systemStatus.results || {};
    const fortiaps = apData.results || [];
    const fortiswitches = switchData.results || [];
    const policies = policyData.results || [];

    // Transform data for topology generator
    const fortigateData = {
      hostname: fortigateInfo.hostname || 'FortiGate',
      ip_address: req.query.fortigate_ip || process.env.FGT_URL?.replace(/^https?:\/\//, '').split(':')[0] || '192.168.0.254',
      platform: fortigateInfo.platform || fortigateInfo.model || 'FortiGate',
      version: fortigateInfo.version || 'Unknown',
      status: 'up',
      uptime: fortigateInfo.uptime || 0,
      risk_score: 0 // Will be calculated from policies if needed
    };

    // Transform FortiAPs
    const transformedAPs = transformFortiAPs(fortiaps);

    // Transform FortiSwitches
    const transformedSwitches = transformFortiSwitches(fortiswitches);

    // Generate topology
    const generator = new NetworkTopologyGenerator();
    const topology = generator.generateFromFortiGateData({
      fortigate: fortigateData,
      fortiaps: transformedAPs,
      fortiswitches: transformedSwitches,
      policies: policies
    });

    // Get statistics
    const statistics = generator.getTopologyStatistics();

    // Get graph format for visualization
    const graphFormat = generator.toGraphFormat();

    console.log('✅ Network topology generated successfully');
    console.log(`   - Devices: ${statistics.total_devices}`);
    console.log(`   - Connections: ${statistics.total_connections}`);

    res.json({
      success: true,
      topology,
      statistics,
      graph: graphFormat,
      generated_at: new Date().toISOString(),
      fortigate: {
        url: process.env.FGT_URL,
        hostname: fortigateData.hostname
      }
    });

  } catch (error) {
    console.error('❌ Error generating network topology:', error.message);
    res.status(500).json({
      error: error.message || 'Failed to generate network topology',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Network Topology Export Endpoint
 * Exports network topology in various formats (JSON, CSV)
 *
 * GET /api/network/topology/export?format=json|csv
 * Returns: Topology data in requested format
 */
app.get('/api/network/topology/export', async (req, res) => {
  try {
    const format = req.query.format || 'json';
    console.log(`📡 Exporting network topology as ${format.toUpperCase()}...`);

    // Fetch all device data (same as topology endpoint)
    const [systemStatus, apData, switchData, policyData] = await Promise.all([
      apiClient.get('monitor/system/status').catch(() => ({ results: {} })),
      apiClient.get('monitor/wifi/managed_ap').catch(() => ({ results: [] })),
      apiClient.get('monitor/switch-controller/managed-switch/status').catch(() => ({ results: [] })),
      apiClient.get('cmdb/firewall/policy').catch(() => ({ results: [] }))
    ]);

    const fortigateInfo = systemStatus.results || {};
    const fortiaps = apData.results || [];
    const fortiswitches = switchData.results || [];
    const policies = policyData.results || [];

    const fortigateData = {
      hostname: fortigateInfo.hostname || 'FortiGate',
      ip_address: req.query.fortigate_ip || process.env.FGT_URL?.replace(/^https?:\/\//, '').split(':')[0] || '192.168.0.254',
      platform: fortigateInfo.platform || fortigateInfo.model || 'FortiGate',
      version: fortigateInfo.version || 'Unknown',
      status: 'up',
      uptime: fortigateInfo.uptime || 0,
      risk_score: 0
    };

    const transformedAPs = transformFortiAPs(fortiaps);
    const transformedSwitches = transformFortiSwitches(fortiswitches);

    // Generate topology
    const generator = new NetworkTopologyGenerator();
    generator.generateFromFortiGateData({
      fortigate: fortigateData,
      fortiaps: transformedAPs,
      fortiswitches: transformedSwitches,
      policies: policies
    });

    if (format === 'csv') {
      // Export as CSV
      const csvData = generator.exportToCSV();

      // Convert to CSV string format
      const devicesCSV = convertToCSVString(csvData.devices);
      const connectionsCSV = convertToCSVString(csvData.connections);

      console.log('✅ Network topology exported as CSV');

      res.setHeader('Content-Type', 'text/plain');
      res.send(`# Network Devices\n${devicesCSV}\n\n# Network Connections\n${connectionsCSV}`);

    } else {
      // Export as JSON (default)
      const jsonData = generator.exportToJSON();

      console.log('✅ Network topology exported as JSON');

      res.setHeader('Content-Type', 'application/json');
      res.json({
        success: true,
        format: 'json',
        ...jsonData
      });
    }

  } catch (error) {
    console.error('❌ Error exporting network topology:', error.message);
    res.status(500).json({
      error: error.message || 'Failed to export network topology',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Helper function to convert array of objects to CSV string
 */
function convertToCSVString(data) {
  if (!data || data.length === 0) return '';

  const headers = Object.keys(data[0]);
  const rows = data.map(row =>
    headers.map(header => {
      const value = row[header];
      // Escape values that contain commas or quotes
      if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    }).join(',')
  );

  return [headers.join(','), ...rows].join('\n');
}

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

app.listen(PORT, () => {
  console.log(`\n🚀 FortiAP Switch Dashboard API Server`);
  console.log(`📍 Server running at: http://localhost:${PORT}`);
  console.log(`🌐 Dashboard URL: http://localhost:${PORT}`);
  
  if (FGT_TOKEN) {
    console.log(`\n✅ FortiOS API Configuration:`);
    console.log(`   - URL: ${FGT_URL}`);
    console.log(`   - Token: ${FGT_TOKEN.substring(0, 8)}...${FGT_TOKEN.slice(-4)}`);
    console.log(`   - SSL: ${process.env.ALLOW_SELF_SIGNED === 'true' ? 'Self-signed allowed' : 'Strict validation'}`);
    console.log(`\n🧪 Test API: curl http://localhost:${PORT}/api/test`);
  } else {
    console.log(`\n⚠️  FortiOS API Token Not Configured`);
    console.log(`   Dashboard will use fallback YAML data until configured.`);
    console.log(`\n📋 To connect to real FortiGate:`);
    console.log(`   1. Create API administrator in FortiGate (System > Administrators)`);
    console.log(`   2. Use "REST API Admin" profile`);
    console.log(`   3. Copy the generated API token`);
    console.log(`   4. Set FGT_TOKEN=your_token in .env file`);
    console.log(`   5. Restart server`);
  }
  
  console.log(`\n📊 API Endpoints:`);
  console.log(`   - GET /api/health - Server health check`);
  console.log(`   - GET /api/test - FortiOS API connectivity test`);
  console.log(`   - GET /api/overview - Complete dashboard data`);
  console.log(`   - GET /api/fortiaps - FortiAP devices only`);
  console.log(`   - GET /api/fortiswitches - FortiSwitch devices only`);
  console.log(`\n🔥 Enhanced Monitoring Endpoints:`);
  console.log(`   - GET /api/firewall/policies - Firewall rules and policies`);
  console.log(`   - GET /api/vpn/status - VPN tunnels and SSL-VPN users`);
  console.log(`   - GET /api/system/performance - CPU, memory, disk, sessions`);
  console.log(`   - GET /api/security/threats - IPS and antivirus detections`);
  console.log(`   - GET /api/wifi/clients?wtp=AP_NAME - WiFi client details (all or by AP)`);
  console.log(`   - GET /api/switch/detected-devices - Devices detected on switch ports`);
  console.log(`   - GET /api/client/stats - API client statistics`);
  console.log(`\n🔬 Firewall Optimizer Endpoints:`);
  console.log(`   - GET /api/firewall/analysis - Policy analysis & optimization`);
  console.log(`   - POST /api/firewall/simulate - Packet simulation engine`);
  console.log(`   - GET /api/security/risk-assessment - Security risk scoring`);
  console.log(`\n🗺️  Network Topology Endpoints:`);
  console.log(`   - GET /api/network/topology - Generate network topology with devices & connections`);
  console.log(`   - GET /api/network/topology/export?format=json|csv - Export topology data`);
  console.log(`\n🎯 Ready for connections!`);
});