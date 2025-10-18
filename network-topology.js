/**
 * Network Topology Generator
 * Ported from firewall_optimizer/network_diagram_generator.py
 * Generates network topology from FortiGate, FortiAP, and FortiSwitch data
 */

class NetworkDevice {
  constructor(name, ip_address, device_type, platform, version, status, interfaces = [], security_status = 'Normal', risk_score = 0, uptime = 0, location = null) {
    this.name = name;
    this.ip_address = ip_address;
    this.device_type = device_type;
    this.platform = platform;
    this.version = version;
    this.status = status;
    this.interfaces = interfaces;
    this.security_status = security_status;
    this.risk_score = risk_score;
    this.uptime = uptime;
    this.location = location;
  }
}

class NetworkConnection {
  constructor(source_device, target_device, source_interface, target_interface, connection_type, bandwidth = null, status = 'active') {
    this.source_device = source_device;
    this.target_device = target_device;
    this.source_interface = source_interface;
    this.target_interface = target_interface;
    this.connection_type = connection_type;
    this.bandwidth = bandwidth;
    this.status = status;
  }
}

class NetworkTopologyGenerator {
  constructor() {
    this.devices = new Map();
    this.connections = [];
    this.layoutAlgorithm = 'force-directed';
  }

  /**
   * Add a device to the network topology
   */
  addDevice(device) {
    this.devices.set(device.name, device);
  }

  /**
   * Add a connection between devices
   */
  addConnection(connection) {
    this.connections.push(connection);
  }

  /**
   * Generate network topology from FortiGate/FortiAP/FortiSwitch data
   * @param {Object} data - Combined data from FortiGate API
   * @returns {Object} - Topology data
   */
  generateFromFortiGateData(data) {
    try {
      // Process FortiGate device
      if (data.fortigate) {
        const fg = data.fortigate;
        const device = new NetworkDevice(
          fg.hostname || 'FortiGate',
          fg.ip_address || 'Unknown',
          'FortiGate',
          fg.platform || fg.model || 'Unknown',
          fg.version || 'Unknown',
          fg.status || 'up',
          this._extractFortiGateInterfaces(fg),
          'Normal',
          fg.risk_score || 0,
          fg.uptime || 0,
          fg.location || null
        );
        this.addDevice(device);
      }

      // Process FortiAPs
      if (data.fortiaps && Array.isArray(data.fortiaps)) {
        for (const ap of data.fortiaps) {
          const device = new NetworkDevice(
            ap.name || ap.wtp_id || 'Unknown-AP',
            ap.ip_address || ap.ip || '0.0.0.0',
            'FortiAP',
            ap.model || 'Unknown',
            ap.firmware_version || ap.os_version || 'Unknown',
            ap.status || 'down',
            this._extractAPInterfaces(ap),
            'Normal',
            0, // APs don't have risk scores
            this._parseUptime(ap.uptime),
            ap.location || null
          );
          this.addDevice(device);
        }
      }

      // Process FortiSwitches
      if (data.fortiswitches && Array.isArray(data.fortiswitches)) {
        for (const sw of data.fortiswitches) {
          const device = new NetworkDevice(
            sw.name || sw['switch-id'] || 'Unknown-Switch',
            sw.ip_address || sw.ip || '0.0.0.0',
            'FortiSwitch',
            sw.model || 'Unknown',
            sw.firmware_version || sw.os_version || 'Unknown',
            sw.status || 'down',
            this._extractSwitchInterfaces(sw),
            'Normal',
            0, // Switches don't have risk scores
            this._parseUptime(sw.uptime),
            sw.location || null
          );
          this.addDevice(device);
        }
      }

      // Infer connections from policies and interface data
      this.inferConnectionsFromPolicies(data.policies || []);
      this.inferConnectionsFromFortiLink(data.fortiswitches || []);
      this.inferConnectionsFromWTP(data.fortiaps || []);

      console.log(`Generated network topology with ${this.devices.size} devices and ${this.connections.length} connections`);

      return this.exportToJSON();

    } catch (error) {
      console.error('Error generating network topology:', error);
      throw error;
    }
  }

  /**
   * Infer connections from firewall policies
   */
  inferConnectionsFromPolicies(policies) {
    if (!Array.isArray(policies) || policies.length === 0) return;

    try {
      const fortigate = Array.from(this.devices.values()).find(d => d.device_type === 'FortiGate');
      if (!fortigate) return;

      // Map of interface names to connected devices
      const interfaceMap = new Map();

      for (const policy of policies) {
        if (policy.status !== 'enable') continue;

        // Extract source and destination interfaces
        const srcIntfs = Array.isArray(policy.srcintf)
          ? policy.srcintf.map(i => typeof i === 'object' ? i.name : i)
          : [];
        const dstIntfs = Array.isArray(policy.dstintf)
          ? policy.dstintf.map(i => typeof i === 'object' ? i.name : i)
          : [];

        // Track which interfaces are used
        for (const intf of [...srcIntfs, ...dstIntfs]) {
          if (!interfaceMap.has(intf)) {
            interfaceMap.set(intf, new Set());
          }
        }
      }

      // Create connections for interfaces that appear to be inter-device links
      for (const [intf, _] of interfaceMap) {
        // Look for matching devices (FortiLink ports, management ports, etc.)
        for (const device of this.devices.values()) {
          if (device.name === fortigate.name) continue;

          // Check if device has an interface that suggests connection to this FortiGate interface
          const deviceInterfaces = device.interfaces.map(i => i.name || i.port || '');

          if (this._interfacesLikelyConnected(intf, deviceInterfaces, device.device_type)) {
            const connection = new NetworkConnection(
              fortigate.name,
              device.name,
              intf,
              'auto-detected',
              'policy-inferred',
              null,
              'inferred'
            );
            this.addConnection(connection);
          }
        }
      }

    } catch (error) {
      console.error('Error inferring connections from policies:', error);
    }
  }

  /**
   * Infer FortiLink connections between FortiGate and FortiSwitches
   */
  inferConnectionsFromFortiLink(fortiswitches) {
    if (!Array.isArray(fortiswitches) || fortiswitches.length === 0) return;

    try {
      const fortigate = Array.from(this.devices.values()).find(d => d.device_type === 'FortiGate');
      if (!fortigate) return;

      for (const sw of fortiswitches) {
        const switchDevice = this.devices.get(sw.name || sw['switch-id']);
        if (!switchDevice) continue;

        // FortiLink connection
        if (sw.fortilink_status === 'up' || sw.status === 'authorized') {
          const connection = new NetworkConnection(
            fortigate.name,
            switchDevice.name,
            'fortilink',
            'fortilink',
            'fortilink',
            '10G', // Typical FortiLink speed
            'active'
          );
          this.addConnection(connection);
        }
      }

    } catch (error) {
      console.error('Error inferring FortiLink connections:', error);
    }
  }

  /**
   * Infer WTP (Wireless Termination Point) connections from FortiAPs
   */
  inferConnectionsFromWTP(fortiaps) {
    if (!Array.isArray(fortiaps) || fortiaps.length === 0) return;

    try {
      const fortigate = Array.from(this.devices.values()).find(d => d.device_type === 'FortiGate');
      if (!fortigate) return;

      for (const ap of fortiaps) {
        const apDevice = this.devices.get(ap.name || ap.wtp_id);
        if (!apDevice) continue;

        // WTP/CAPWAP connection
        if (ap.status === 'up' || ap.status === 'online') {
          const connection = new NetworkConnection(
            fortigate.name,
            apDevice.name,
            'wtp-tunnel',
            'capwap',
            'capwap',
            null,
            'active'
          );
          this.addConnection(connection);
        }
      }

    } catch (error) {
      console.error('Error inferring WTP connections:', error);
    }
  }

  /**
   * Check if interfaces are likely connected
   */
  _interfacesLikelyConnected(fgInterface, deviceInterfaces, deviceType) {
    // FortiLink interfaces typically named "fortilink" or contain "fortilink"
    if (deviceType === 'FortiSwitch' && fgInterface.toLowerCase().includes('fortilink')) {
      return true;
    }

    // Internal interfaces suggest AP or switch connection
    if (deviceType === 'FortiAP' && fgInterface.toLowerCase().includes('internal')) {
      return true;
    }

    return false;
  }

  /**
   * Extract FortiGate interfaces
   */
  _extractFortiGateInterfaces(fortigate) {
    const interfaces = [];

    // Try to extract from various possible fields
    if (fortigate.interfaces && Array.isArray(fortigate.interfaces)) {
      return fortigate.interfaces.map(i => ({
        name: i.name || i.interface || 'unknown',
        type: i.type || 'ethernet',
        ip: i.ip || i.ip_address || null,
        status: i.status || 'unknown'
      }));
    }

    // Default common FortiGate interfaces
    return [
      { name: 'wan1', type: 'wan', ip: null, status: 'unknown' },
      { name: 'wan2', type: 'wan', ip: null, status: 'unknown' },
      { name: 'internal', type: 'lan', ip: null, status: 'unknown' },
      { name: 'fortilink', type: 'fortilink', ip: null, status: 'unknown' }
    ];
  }

  /**
   * Extract FortiAP interfaces
   */
  _extractAPInterfaces(ap) {
    const interfaces = [];

    // Radio interfaces
    if (ap.radio_1 || ap['radio-1']) {
      const radio1 = ap.radio_1 || ap['radio-1'];
      interfaces.push({
        name: 'radio-1',
        type: 'wireless',
        channel: radio1.channel || 0,
        status: 'active'
      });
    }

    if (ap.radio_2 || ap['radio-2']) {
      const radio2 = ap.radio_2 || ap['radio-2'];
      interfaces.push({
        name: 'radio-2',
        type: 'wireless',
        channel: radio2.channel || 0,
        status: 'active'
      });
    }

    // Ethernet/CAPWAP interface
    interfaces.push({
      name: 'capwap',
      type: 'control',
      ip: ap.ip_address || ap.ip,
      status: ap.status || 'down'
    });

    return interfaces;
  }

  /**
   * Extract FortiSwitch interfaces (ports)
   */
  _extractSwitchInterfaces(sw) {
    if (sw.ports && Array.isArray(sw.ports)) {
      return sw.ports.map(port => ({
        name: port.port || port.name || 'unknown',
        type: 'ethernet',
        speed: port.speed || '0M',
        status: port.status || 'down',
        poe_status: port.poe_status || 'disabled',
        connected_device: port.device || null
      }));
    }

    // Default - create placeholder ports
    const portCount = sw.total_ports || sw.port_count || 24;
    const interfaces = [];
    for (let i = 1; i <= portCount; i++) {
      interfaces.push({
        name: `port${i}`,
        type: 'ethernet',
        speed: '1G',
        status: 'unknown',
        poe_status: 'unknown',
        connected_device: null
      });
    }

    return interfaces;
  }

  /**
   * Parse uptime string to seconds
   */
  _parseUptime(uptime) {
    if (typeof uptime === 'number') return uptime;
    if (!uptime) return 0;

    // Parse format like "5d 3h 20m"
    const days = uptime.match(/(\d+)d/);
    const hours = uptime.match(/(\d+)h/);
    const minutes = uptime.match(/(\d+)m/);

    let seconds = 0;
    if (days) seconds += parseInt(days[1]) * 86400;
    if (hours) seconds += parseInt(hours[1]) * 3600;
    if (minutes) seconds += parseInt(minutes[1]) * 60;

    return seconds;
  }

  /**
   * Export topology to JSON format
   */
  exportToJSON() {
    const topology = {
      generated_at: new Date().toISOString(),
      devices: {},
      connections: [],
      metadata: {
        total_devices: this.devices.size,
        total_connections: this.connections.length,
        layout_algorithm: this.layoutAlgorithm
      }
    };

    // Export devices
    for (const [name, device] of this.devices) {
      topology.devices[name] = {
        name: device.name,
        ip_address: device.ip_address,
        device_type: device.device_type,
        platform: device.platform,
        version: device.version,
        status: device.status,
        interfaces: device.interfaces,
        security_status: device.security_status,
        risk_score: device.risk_score,
        uptime: device.uptime,
        location: device.location
      };
    }

    // Export connections
    for (const connection of this.connections) {
      topology.connections.push({
        source_device: connection.source_device,
        target_device: connection.target_device,
        source_interface: connection.source_interface,
        target_interface: connection.target_interface,
        connection_type: connection.connection_type,
        bandwidth: connection.bandwidth,
        status: connection.status
      });
    }

    return topology;
  }

  /**
   * Export topology to CSV format (devices and connections separately)
   */
  exportToCSV() {
    const result = {
      devices: [],
      connections: []
    };

    // Export devices
    for (const [_, device] of this.devices) {
      result.devices.push({
        name: device.name,
        ip_address: device.ip_address,
        device_type: device.device_type,
        platform: device.platform,
        version: device.version,
        status: device.status,
        security_status: device.security_status,
        risk_score: device.risk_score,
        uptime: device.uptime,
        location: device.location || '',
        interface_count: device.interfaces.length
      });
    }

    // Export connections
    for (const connection of this.connections) {
      result.connections.push({
        source_device: connection.source_device,
        target_device: connection.target_device,
        source_interface: connection.source_interface,
        target_interface: connection.target_interface,
        connection_type: connection.connection_type,
        bandwidth: connection.bandwidth || '',
        status: connection.status
      });
    }

    return result;
  }

  /**
   * Get topology statistics
   */
  getTopologyStatistics() {
    const stats = {
      total_devices: this.devices.size,
      total_connections: this.connections.length,
      device_types: {},
      connection_types: {},
      status_distribution: {},
      security_status_distribution: {},
      risk_score_summary: {
        min: 0,
        max: 0,
        average: 0
      }
    };

    // Device type distribution
    for (const device of this.devices.values()) {
      const deviceType = device.device_type;
      stats.device_types[deviceType] = (stats.device_types[deviceType] || 0) + 1;

      // Status distribution
      const status = device.status;
      stats.status_distribution[status] = (stats.status_distribution[status] || 0) + 1;

      // Security status distribution
      const securityStatus = device.security_status;
      stats.security_status_distribution[securityStatus] = (stats.security_status_distribution[securityStatus] || 0) + 1;
    }

    // Connection type distribution
    for (const connection of this.connections) {
      const connectionType = connection.connection_type;
      stats.connection_types[connectionType] = (stats.connection_types[connectionType] || 0) + 1;
    }

    // Risk score summary
    const riskScores = Array.from(this.devices.values()).map(d => d.risk_score);
    if (riskScores.length > 0) {
      stats.risk_score_summary = {
        min: Math.min(...riskScores),
        max: Math.max(...riskScores),
        average: riskScores.reduce((sum, val) => sum + val, 0) / riskScores.length
      };
    }

    return stats;
  }

  /**
   * Convert topology to graph format for visualization libraries
   * Returns format compatible with D3.js, Cytoscape.js, etc.
   */
  toGraphFormat() {
    const nodes = [];
    const edges = [];

    // Convert devices to nodes
    for (const [_, device] of this.devices) {
      nodes.push({
        id: device.name,
        label: device.name,
        type: device.device_type,
        ip: device.ip_address,
        status: device.status,
        platform: device.platform,
        version: device.version,
        risk_score: device.risk_score,
        // Visual properties
        color: this._getNodeColor(device.device_type, device.status),
        size: this._getNodeSize(device.device_type),
        shape: this._getNodeShape(device.device_type)
      });
    }

    // Convert connections to edges
    for (let i = 0; i < this.connections.length; i++) {
      const connection = this.connections[i];
      edges.push({
        id: `edge-${i}`,
        source: connection.source_device,
        target: connection.target_device,
        label: connection.connection_type,
        type: connection.connection_type,
        bandwidth: connection.bandwidth,
        status: connection.status,
        // Visual properties
        color: this._getEdgeColor(connection.status),
        width: this._getEdgeWidth(connection.connection_type)
      });
    }

    return { nodes, edges };
  }

  /**
   * Get node color based on device type and status
   */
  _getNodeColor(deviceType, status) {
    if (status === 'down' || status === 'offline') return '#ff4444';

    switch (deviceType) {
      case 'FortiGate': return '#00A9E0';
      case 'FortiSwitch': return '#7CB342';
      case 'FortiAP': return '#FFA726';
      default: return '#9E9E9E';
    }
  }

  /**
   * Get node size based on device type
   */
  _getNodeSize(deviceType) {
    switch (deviceType) {
      case 'FortiGate': return 30;
      case 'FortiSwitch': return 20;
      case 'FortiAP': return 18;
      default: return 15;
    }
  }

  /**
   * Get node shape based on device type
   */
  _getNodeShape(deviceType) {
    switch (deviceType) {
      case 'FortiGate': return 'square';
      case 'FortiSwitch': return 'rectangle';
      case 'FortiAP': return 'triangle';
      default: return 'circle';
    }
  }

  /**
   * Get edge color based on status
   */
  _getEdgeColor(status) {
    switch (status) {
      case 'active': return '#4CAF50';
      case 'inferred': return '#9E9E9E';
      case 'down': return '#f44336';
      default: return '#757575';
    }
  }

  /**
   * Get edge width based on connection type
   */
  _getEdgeWidth(connectionType) {
    switch (connectionType) {
      case 'fortilink': return 3;
      case 'capwap': return 2;
      default: return 1;
    }
  }
}

module.exports = { NetworkTopologyGenerator, NetworkDevice, NetworkConnection };
