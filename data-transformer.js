// FortiGate API Data Transformer
// Transforms real FortiGate API responses into the dashboard format

/**
 * Transform FortiAP data from FortiGate API response
 * @param {Array} apData - Raw AP data from FortiGate API
 * @returns {Array} - Transformed AP data for dashboard
 */
function transformFortiAPs(apData) {
  if (!Array.isArray(apData)) {
    console.warn('FortiAP data is not an array:', apData);
    return [];
  }

  return apData.map(ap => {
    // Map FortiGate API fields to dashboard format
    const transformed = {
      name: ap.name || ap.wtp_id || 'Unknown-AP',
      model: ap.model || ap.wtp_profile || 'Unknown',
      serial: ap.serial || ap.serial_number || 'Unknown',
      ip_address: ap.ip || ap.ip_address || ap.lan_ip || '0.0.0.0',
      status: mapApStatus(ap.status || ap.wtp_status),
      firmware_version: ap.os_version || ap.firmware_version || 'Unknown',
      uptime: formatUptime(ap.uptime || 0),
      
      // Wireless information
      channel_2_4ghz: ap.radio_1?.channel || ap['radio-1']?.channel || 0,
      channel_5ghz: ap.radio_2?.channel || ap['radio-2']?.channel || 0,
      channel_utilization_2_4ghz: Math.round(ap.radio_1?.utilization || ap['radio-1']?.utilization || 0),
      channel_utilization_5ghz: Math.round(ap.radio_2?.utilization || ap['radio-2']?.utilization || 0),
      
      // Client information
      clients_connected: ap.client_count || ap.clients || 0,
      clients_limit: ap.max_clients || 64,
      
      // System metrics
      temperature: Math.round(ap.temperature || 0),
      cpu_usage: Math.round(ap.cpu_usage || 0),
      memory_usage: Math.round(ap.memory_usage || 0),
      
      // RF information
      signal_strength: ap.signal_strength || -50,
      noise_level: ap.noise_level || -95,
      tx_power_2_4ghz: ap.radio_1?.tx_power || ap['radio-1']?.tx_power || 17,
      tx_power_5ghz: ap.radio_2?.tx_power || ap['radio-2']?.tx_power || 20,
      
      // Security metrics
      interfering_aps: ap.interfering_aps || 0,
      rogue_aps: ap.rogue_aps || 0,
      login_failures: ap.login_failures || 0,
      
      // SSIDs
      ssids: extractSSIDs(ap),
      
      // Last seen
      last_seen: ap.last_seen || new Date().toISOString()
    };

    return transformed;
  });
}

/**
 * Transform FortiSwitch data from FortiGate API response
 * @param {Array} switchData - Raw switch data from FortiGate API
 * @returns {Array} - Transformed switch data for dashboard
 */
function transformFortiSwitches(switchData) {
  if (!Array.isArray(switchData)) {
    console.warn('FortiSwitch data is not an array:', switchData);
    return [];
  }

  return switchData.map(sw => {
    const ports = transformSwitchPorts(sw.ports || []);
    const actualBudget = sw.max_poe_budget || 0;
    const poeStats = calculatePoeStats(ports, actualBudget);

    const transformed = {
      name: sw.name || sw['switch-id'] || sw.switch_id || 'Unknown-Switch',
      model: sw.model || sw.platform || sw.type || 'Unknown',
      serial: sw.serial || sw.serial_number || 'Unknown',
      ip_address: sw.ip || sw.ip_address || sw.mgmt_ip || sw.connecting_from || '0.0.0.0',
      status: mapSwitchStatus(sw.status || sw.state || sw.switch_status),
      firmware_version: sw.os_version || sw.firmware_version || 'Unknown',
      uptime: formatUptime(sw.uptime || 0),

      // Port information
      total_ports: sw.port_count || ports.length || 0,
      ports_up: ports.filter(p => p.status === 'up').length,
      ports_down: ports.filter(p => p.status === 'down').length,

      // PoE information
      poe_ports: poeStats.total_poe_ports,
      poe_enabled_ports: poeStats.enabled_ports,
      poe_power_budget: poeStats.budget,
      poe_power_consumption: poeStats.consumption,
      poe_power_percentage: poeStats.utilization,
      
      // System metrics
      temperature: Math.round(sw.temperature || 0),
      cpu_usage: Math.round(sw.cpu_usage || 0),
      memory_usage: Math.round(sw.memory_usage || 0),
      
      // Hardware status
      fan_status: sw.fan_status || 'ok',
      power_supply_1: sw.power_supply?.[0]?.status || sw.psu1_status || 'ok',
      power_supply_2: sw.power_supply?.[1]?.status || sw.psu2_status || 'n/a',
      
      // FortiLink status
      fortilink_status: sw.fortilink_status || 'up',
      
      // Port details
      ports: ports,
      
      // Last seen
      last_seen: sw.last_seen || new Date().toISOString()
    };

    return transformed;
  });
}

/**
 * Transform port data for switches
 * @param {Array} ports - Raw port data
 * @returns {Array} - Transformed port data
 */
function transformSwitchPorts(ports) {
  if (!Array.isArray(ports)) return [];

  return ports.map(port => {
    // Extract connected device name from various possible fields
    let connectedDevice = '';
    if (port.fgt_peer_device_name) {
      connectedDevice = port.fgt_peer_device_name;
    } else if (port.isl_peer_device_name) {
      connectedDevice = port.isl_peer_device_name;
    } else if (port.connected_device) {
      connectedDevice = port.connected_device;
    } else if (port.device) {
      connectedDevice = port.device;
    }

    // Add VLAN information if available
    const vlan = port.vlan || '';

    return {
      port: port.name || port.interface || port.port_id || 'unknown',
      device: connectedDevice,
      vlan: vlan,
      status: port.status || port.link_status || 'down',
      speed: formatSpeed(port.speed || 0),
      poe_status: port.poe_status || (port.poe_enable ? 'enabled' : 'disabled'),
      poe_power: formatPower(port.port_power || port.poe_power || 0),
      poe_capable: port.poe_capable || false,
      fortilink_port: port.fortilink_port || false
    };
  });
}

/**
 * Calculate PoE statistics from ports
 * @param {Array} ports - Port data
 * @param {number} actualBudget - Actual max PoE budget from device (optional)
 * @returns {Object} - PoE statistics
 */
function calculatePoeStats(ports, actualBudget = 0) {
  const poeCapablePorts = ports.filter(p => p.poe_capable === true);
  const poeEnabledPorts = ports.filter(p => p.poe_status === 'enabled');
  const totalConsumption = ports.reduce((sum, port) => {
    const power = parseFloat(port.poe_power?.replace('W', '') || 0);
    return sum + power;
  }, 0);

  // Use actual budget if provided, otherwise estimate
  const totalPoePorts = poeCapablePorts.length || ports.filter(p => p.poe_status !== 'n/a').length;
  const budget = actualBudget > 0 ? actualBudget : (totalPoePorts * 30); // 30W per PoE port estimate

  return {
    total_poe_ports: totalPoePorts,
    enabled_ports: poeEnabledPorts.length,
    budget: budget,
    consumption: Math.round(totalConsumption),
    utilization: budget > 0 ? Math.round((totalConsumption / budget) * 100) : 0
  };
}

/**
 * Map FortiAP status to dashboard format
 * @param {string} status - Raw AP status
 * @returns {string} - Mapped status
 */
function mapApStatus(status) {
  const statusMap = {
    'online': 'up',
    'connected': 'up',
    'up': 'up',
    'offline': 'down',
    'disconnected': 'down',
    'down': 'down',
    'warning': 'warning',
    'error': 'down'
  };
  
  return statusMap[status?.toLowerCase()] || 'down';
}

/**
 * Map FortiSwitch status to dashboard format
 * @param {string} status - Raw switch status
 * @returns {string} - Mapped status
 */
function mapSwitchStatus(status) {
  const statusMap = {
    'authorized': 'up',
    'connected': 'up',
    'up': 'up',
    'unauthorized': 'warning',
    'down': 'down',
    'offline': 'down',
    'warning': 'warning',
    'error': 'down'
  };
  
  return statusMap[status?.toLowerCase()] || 'down';
}

/**
 * Extract SSIDs from AP data
 * @param {Object} ap - AP data
 * @returns {Array} - SSID list
 */
function extractSSIDs(ap) {
  if (ap.ssids && Array.isArray(ap.ssids)) {
    return ap.ssids;
  }
  
  if (ap.wlan && Array.isArray(ap.wlan)) {
    return ap.wlan.map(w => w.ssid || w.name).filter(Boolean);
  }
  
  // Try to extract from VAPs (Virtual APs)
  if (ap.vaps && Array.isArray(ap.vaps)) {
    return ap.vaps.map(vap => vap.ssid).filter(Boolean);
  }
  
  return ['Corporate-WiFi']; // Default fallback
}

/**
 * Format uptime from seconds to readable format
 * @param {number} uptimeSeconds - Uptime in seconds
 * @returns {string} - Formatted uptime
 */
function formatUptime(uptimeSeconds) {
  if (!uptimeSeconds) return '0d 0h 0m';
  
  const days = Math.floor(uptimeSeconds / 86400);
  const hours = Math.floor((uptimeSeconds % 86400) / 3600);
  const minutes = Math.floor((uptimeSeconds % 3600) / 60);
  
  return `${days}d ${hours}h ${minutes}m`;
}

/**
 * Format port speed
 * @param {number} speedMbps - Speed in Mbps
 * @returns {string} - Formatted speed
 */
function formatSpeed(speedMbps) {
  if (!speedMbps || speedMbps === 0) return '0M';
  if (speedMbps >= 1000) return `${speedMbps / 1000}G`;
  return `${speedMbps}M`;
}

/**
 * Format PoE power
 * @param {number} powerWatts - Power in watts
 * @returns {string} - Formatted power
 */
function formatPower(powerWatts) {
  if (!powerWatts || powerWatts === 0) return '0W';
  return `${powerWatts.toFixed(1)}W`;
}

/**
 * Generate system health data from transformed device data
 * @param {Array} fortiaps - Transformed AP data
 * @param {Array} fortiswitches - Transformed switch data
 * @returns {Object} - System health data
 */
function generateSystemHealth(fortiaps, fortiswitches) {
  const alerts = [];
  
  // Check FortiAPs for issues
  fortiaps.forEach(ap => {
    if (ap.status === 'down') {
      alerts.push({
        device: ap.name,
        message: `Device offline${ap.last_seen ? ' since ' + new Date(ap.last_seen).toLocaleString() : ''}`,
        severity: 'high',
        type: 'error'
      });
    }
    
    if (ap.temperature > 60) {
      alerts.push({
        device: ap.name,
        message: `High temperature (${ap.temperature}°C)`,
        severity: 'medium',
        type: 'warning'
      });
    }
    
    if (ap.interfering_aps > 5) {
      alerts.push({
        device: ap.name,
        message: `High interference (${ap.interfering_aps} APs detected)`,
        severity: 'low',
        type: 'info'
      });
    }
  });
  
  // Check FortiSwitches for issues
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
    
    if (sw.poe_power_percentage > 80) {
      alerts.push({
        device: sw.name,
        message: `PoE utilization at ${sw.poe_power_percentage}%`,
        severity: 'medium',
        type: 'warning'
      });
    }
    
    if (sw.fan_status === 'warning' || sw.fan_status === 'error') {
      alerts.push({
        device: sw.name,
        message: `Fan issue detected`,
        severity: 'medium',
        type: 'warning'
      });
    }
  });
  
  // Calculate summary statistics
  const apsOnline = fortiaps.filter(ap => ap.status === 'up').length;
  const switchesOnline = fortiswitches.filter(sw => sw.status === 'up').length;
  const switchesWarning = fortiswitches.filter(sw => sw.status === 'warning').length;
  
  const totalClients = fortiaps.reduce((sum, ap) => sum + ap.clients_connected, 0);
  const totalPoeConsumption = fortiswitches.reduce((sum, sw) => sum + sw.poe_power_consumption, 0);
  const totalPoeBudget = fortiswitches.reduce((sum, sw) => sum + sw.poe_power_budget, 0);
  
  const avgPoeUtilization = totalPoeBudget > 0 ? 
    parseFloat(((totalPoeConsumption / totalPoeBudget) * 100).toFixed(1)) : 0;
  
  return {
    alerts,
    aps_offline: fortiaps.length - apsOnline,
    aps_online: apsOnline,
    avg_poe_utilization: avgPoeUtilization,
    switches_offline: fortiswitches.length - switchesOnline - switchesWarning,
    switches_online: switchesOnline,
    total_aps: fortiaps.length,
    total_clients: totalClients,
    total_poe_power_budget: totalPoeBudget,
    total_poe_power_consumption: totalPoeConsumption,
    total_switches: fortiswitches.length
  };
}

module.exports = {
  transformFortiAPs,
  transformFortiSwitches,
  generateSystemHealth
};