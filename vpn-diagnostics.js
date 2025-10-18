/**
 * VPN Diagnostics Module
 *
 * Provides comprehensive VPN tunnel diagnostics including phase1/phase2 validation,
 * traffic statistics, and configuration troubleshooting.
 *
 * Ported from: AI Agents for Fortinet Firewall Troubleshooting
 * Source: fortinet_troubleshooting_workflows.py:diagnose_vpn_tunnel_issue
 */

const FortinetAPIClient = require('./fortinet-api-client');

class VPNDiagnostics {
  constructor(apiClient) {
    this.client = apiClient || new FortinetAPIClient();
  }

  /**
   * Diagnose VPN tunnel issues
   * @param {string} tunnelName - Name of VPN tunnel to diagnose
   * @returns {Object} Diagnostic results with recommendations
   */
  async diagnoseVPNTunnel(tunnelName) {
    console.log(`🔐 Diagnosing VPN tunnel: ${tunnelName}`);

    const results = {
      tunnel_name: tunnelName,
      timestamp: new Date().toISOString(),
      status: {
        overall: 'unknown',
        phase1: 'unknown',
        phase2: 'unknown'
      },
      tests: {},
      issues_found: [],
      recommendations: [],
      traffic_stats: null
    };

    try {
      // Step 1: Get VPN status
      console.log('  Step 1: Checking VPN status...');
      const vpnStatus = await this._getVPNStatus(tunnelName);
      results.tests.vpn_status = vpnStatus;

      if (!vpnStatus.found) {
        results.issues_found.push({
          severity: 'critical',
          issue: `VPN tunnel '${tunnelName}' not found`,
          test: 'vpn_status'
        });
        results.recommendations.push({
          priority: 'high',
          action: 'Verify VPN tunnel name',
          details: 'Check that the tunnel name is correct and the VPN is configured'
        });
        results.status.overall = 'not_found';
        return results;
      }

      // Update status
      results.status.phase1 = vpnStatus.phase1_status || 'unknown';
      results.status.phase2 = vpnStatus.phase2_status || 'unknown';

      // Step 2: Check Phase 1 (IKE) status
      console.log('  Step 2: Checking Phase 1 (IKE)...');
      if (vpnStatus.phase1_status !== 'up') {
        results.issues_found.push({
          severity: 'critical',
          issue: 'Phase 1 (IKE) is down',
          test: 'phase1',
          details: vpnStatus.phase1_details
        });
        results.recommendations.push({
          priority: 'critical',
          action: 'Troubleshoot Phase 1 negotiation',
          details: [
            'Verify pre-shared key matches on both ends',
            'Check IKE version compatibility (IKEv1 or IKEv2)',
            'Verify encryption/authentication proposals match',
            'Check that UDP port 500 (IKE) is not blocked',
            'Review FortiGate logs for IKE negotiation errors'
          ]
        });
      }

      // Step 3: Check Phase 2 (IPsec) status
      console.log('  Step 3: Checking Phase 2 (IPsec)...');
      if (vpnStatus.phase2_status !== 'up') {
        results.issues_found.push({
          severity: 'critical',
          issue: 'Phase 2 (IPsec) is down',
          test: 'phase2',
          details: vpnStatus.phase2_details
        });
        results.recommendations.push({
          priority: 'critical',
          action: 'Troubleshoot Phase 2 negotiation',
          details: [
            'Verify Phase 2 proposals match (encryption, authentication, PFS)',
            'Check local and remote subnets are correctly configured',
            'Ensure Phase 1 is up before troubleshooting Phase 2',
            'Verify that UDP port 4500 (NAT-T) is not blocked if behind NAT',
            'Check for proxy-id mismatches'
          ]
        });
      }

      // Step 4: Check traffic statistics
      console.log('  Step 4: Checking traffic statistics...');
      const trafficStats = await this._getTrafficStats(tunnelName);
      results.traffic_stats = trafficStats;

      if (vpnStatus.phase1_status === 'up' && vpnStatus.phase2_status === 'up') {
        if (trafficStats.bytes_sent === 0 && trafficStats.bytes_received === 0) {
          results.issues_found.push({
            severity: 'warning',
            issue: 'VPN tunnel is up but no traffic is flowing',
            test: 'traffic',
            details: trafficStats
          });
          results.recommendations.push({
            priority: 'medium',
            action: 'Investigate lack of traffic',
            details: [
              'Verify firewall policies allow traffic through VPN tunnel',
              'Check routing to ensure traffic is directed to VPN',
              'Verify remote network is accessible',
              'Test connectivity from local to remote subnet',
              'Check if interesting traffic selectors are correctly configured'
            ]
          });
        } else if (trafficStats.bytes_sent > 0 && trafficStats.bytes_received === 0) {
          results.issues_found.push({
            severity: 'warning',
            issue: 'VPN tunnel sending traffic but not receiving',
            test: 'traffic',
            details: trafficStats
          });
          results.recommendations.push({
            priority: 'medium',
            action: 'Check return traffic path',
            details: [
              'Verify routing on remote end points back through VPN',
              'Check firewall policies on remote end',
              'Verify NAT configuration is not interfering',
              'Check for asymmetric routing issues'
            ]
          });
        }
      }

      // Step 5: Check DPD (Dead Peer Detection) configuration
      console.log('  Step 5: Checking DPD configuration...');
      const dpdConfig = await this._checkDPDConfiguration(tunnelName);
      results.tests.dpd = dpdConfig;

      if (dpdConfig.enabled && dpdConfig.status === 'timeout') {
        results.issues_found.push({
          severity: 'high',
          issue: 'DPD timeout detected',
          test: 'dpd',
          details: dpdConfig
        });
        results.recommendations.push({
          priority: 'high',
          action: 'Troubleshoot DPD timeouts',
          details: [
            'Check network connectivity to remote peer',
            'Verify DPD interval and retry settings',
            'Check for firewall rules blocking DPD packets',
            'Review network latency and packet loss',
            'Consider increasing DPD timeout values'
          ]
        });
      }

      // Step 6: Check VPN configuration
      console.log('  Step 6: Validating VPN configuration...');
      const configValidation = await this._validateVPNConfiguration(tunnelName);
      results.tests.configuration = configValidation;

      if (configValidation.issues.length > 0) {
        configValidation.issues.forEach(issue => {
          results.issues_found.push({
            severity: 'medium',
            issue: issue.description,
            test: 'configuration',
            details: issue
          });
        });
        results.recommendations.push({
          priority: 'medium',
          action: 'Review VPN configuration',
          details: configValidation.issues.map(i => i.recommendation)
        });
      }

      // Determine overall status
      results.status.overall = this._determineOverallStatus(results);

      // Add summary
      if (results.issues_found.length === 0) {
        results.recommendations.push({
          priority: 'info',
          action: 'VPN tunnel appears healthy',
          details: 'All checks passed. Monitor traffic statistics for ongoing performance.'
        });
      }

      return results;

    } catch (error) {
      console.error('❌ VPN diagnostics error:', error.message);
      results.status.overall = 'error';
      results.error = error.message;
      return results;
    }
  }

  /**
   * Get VPN status from FortiGate
   */
  async _getVPNStatus(tunnelName) {
    try {
      // Get IPsec tunnel status
      const tunnels = await this.client.get('monitor/vpn/ipsec').catch(() => ({ results: [] }));

      const tunnel = (tunnels.results || []).find(t =>
        t.name === tunnelName || t.proxyid?.some(p => p.p2name === tunnelName)
      );

      if (!tunnel) {
        return { found: false };
      }

      return {
        found: true,
        phase1_status: tunnel.status === 1 ? 'up' : 'down',
        phase2_status: tunnel.proxyid?.[0]?.status === 1 ? 'up' : 'down',
        phase1_details: {
          remote_gw: tunnel.rgwy,
          local_gw: tunnel.lgwy,
          established: tunnel.created
        },
        phase2_details: tunnel.proxyid?.[0] || {},
        raw_data: tunnel
      };
    } catch (error) {
      return {
        found: false,
        error: error.message
      };
    }
  }

  /**
   * Get traffic statistics for VPN tunnel
   */
  async _getTrafficStats(tunnelName) {
    try {
      const tunnels = await this.client.get('monitor/vpn/ipsec').catch(() => ({ results: [] }));

      const tunnel = (tunnels.results || []).find(t =>
        t.name === tunnelName || t.proxyid?.some(p => p.p2name === tunnelName)
      );

      if (!tunnel || !tunnel.proxyid || tunnel.proxyid.length === 0) {
        return {
          bytes_sent: 0,
          bytes_received: 0,
          packets_sent: 0,
          packets_received: 0
        };
      }

      const p2 = tunnel.proxyid[0];

      return {
        bytes_sent: p2.outbytes || 0,
        bytes_received: p2.inbytes || 0,
        packets_sent: p2.outpackets || 0,
        packets_received: p2.inpackets || 0,
        last_seen: p2.expire ? new Date(Date.now() - p2.expire * 1000).toISOString() : null
      };
    } catch (error) {
      return {
        bytes_sent: 0,
        bytes_received: 0,
        error: error.message
      };
    }
  }

  /**
   * Check DPD configuration
   */
  async _checkDPDConfiguration(tunnelName) {
    try {
      // Get phase1 configuration
      const phase1Configs = await this.client.get('cmdb/vpn.ipsec/phase1-interface').catch(() => ({ results: [] }));

      const phase1 = (phase1Configs.results || []).find(p => p.name === tunnelName);

      if (!phase1) {
        return { enabled: false, error: 'Configuration not found' };
      }

      return {
        enabled: phase1.dpd === 'enable',
        mode: phase1['dpd-mode'] || 'on-demand',
        interval: phase1['dpd-retryinterval'] || 60,
        retry_count: phase1['dpd-retrycount'] || 3,
        status: 'ok' // Would need to check actual DPD status from monitor
      };
    } catch (error) {
      return {
        enabled: false,
        error: error.message
      };
    }
  }

  /**
   * Validate VPN configuration
   */
  async _validateVPNConfiguration(tunnelName) {
    const issues = [];

    try {
      // Get phase1 configuration
      const phase1Configs = await this.client.get('cmdb/vpn.ipsec/phase1-interface').catch(() => ({ results: [] }));
      const phase1 = (phase1Configs.results || []).find(p => p.name === tunnelName);

      if (!phase1) {
        return { valid: false, issues: [{ description: 'Phase 1 configuration not found' }] };
      }

      // Check for weak encryption
      if (phase1.proposal?.includes('des') || phase1.proposal?.includes('3des')) {
        issues.push({
          description: 'Weak encryption algorithm detected (DES/3DES)',
          recommendation: 'Use AES-128 or AES-256 for better security',
          severity: 'medium'
        });
      }

      // Check for MD5 authentication
      if (phase1.proposal?.includes('md5')) {
        issues.push({
          description: 'Weak authentication algorithm detected (MD5)',
          recommendation: 'Use SHA-256 or SHA-512 for better security',
          severity: 'medium'
        });
      }

      // Check DPD configuration
      if (phase1.dpd !== 'enable') {
        issues.push({
          description: 'DPD (Dead Peer Detection) is not enabled',
          recommendation: 'Enable DPD to detect dead peers quickly',
          severity: 'low'
        });
      }

      // Get phase2 configurations
      const phase2Configs = await this.client.get('cmdb/vpn.ipsec/phase2-interface').catch(() => ({ results: [] }));
      const phase2List = (phase2Configs.results || []).filter(p => p.phase1name === tunnelName);

      if (phase2List.length === 0) {
        issues.push({
          description: 'No Phase 2 configuration found',
          recommendation: 'Configure at least one Phase 2 selector',
          severity: 'critical'
        });
      }

      return {
        valid: issues.length === 0,
        issues
      };
    } catch (error) {
      return {
        valid: false,
        issues: [{ description: `Configuration validation error: ${error.message}` }]
      };
    }
  }

  /**
   * Determine overall VPN status
   */
  _determineOverallStatus(results) {
    const criticalIssues = results.issues_found.filter(i => i.severity === 'critical');

    if (criticalIssues.length > 0) {
      return 'critical';
    }

    if (results.status.phase1 === 'up' && results.status.phase2 === 'up') {
      if (results.issues_found.some(i => i.severity === 'warning')) {
        return 'degraded';
      }
      return 'healthy';
    }

    if (results.status.phase1 === 'up' && results.status.phase2 !== 'up') {
      return 'phase2_down';
    }

    if (results.status.phase1 !== 'up') {
      return 'phase1_down';
    }

    return 'unknown';
  }
}

module.exports = VPNDiagnostics;
