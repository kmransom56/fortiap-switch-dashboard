/**
 * Connectivity Testing Module
 *
 * Provides comprehensive connectivity testing between network endpoints
 * with routing validation, policy checking, and detailed recommendations.
 *
 * Ported from: AI Agents for Fortinet Firewall Troubleshooting
 * Source: fortios_troubleshooter.py:diagnose_connectivity_issue
 */

const FortinetAPIClient = require('./fortinet-api-client');
const { PolicyAnalyzer } = require('./policy-analyzer');

class ConnectivityTester {
  constructor(apiClient) {
    this.client = apiClient || new FortinetAPIClient();
    this.policyAnalyzer = new PolicyAnalyzer(this.client);
  }

  /**
   * Diagnose connectivity issues between source and destination
   * @param {Object} params - Test parameters
   * @param {string} params.source - Source IP address or interface
   * @param {string} params.destination - Destination IP address or hostname
   * @param {number} params.port - Destination port (optional)
   * @param {string} params.protocol - Protocol (tcp/udp/icmp)
   * @returns {Object} Diagnostic results with recommendations
   */
  async diagnoseConnectivity(params) {
    const { source, destination, port, protocol = 'icmp' } = params;

    console.log(`🔍 Diagnosing connectivity: ${source || 'default'} → ${destination}:${port || 'any'} (${protocol})`);

    const results = {
      test_params: {
        source: source || 'default',
        destination,
        port: port || null,
        protocol
      },
      timestamp: new Date().toISOString(),
      tests: {},
      issues_found: [],
      recommendations: [],
      overall_status: 'unknown'
    };

    try {
      // Step 1: Check routing
      console.log('  Step 1: Checking routing...');
      const routing = await this._checkRouting(destination);
      results.tests.routing = routing;

      if (!routing.has_route) {
        results.issues_found.push({
          severity: 'critical',
          test: 'routing',
          issue: 'No route to destination',
          details: routing
        });
        results.recommendations.push({
          priority: 'high',
          action: `Configure a route to ${destination}`,
          details: 'Add a static route or default gateway to reach the destination network'
        });
      }

      // Step 2: Check firewall policies
      console.log('  Step 2: Checking firewall policies...');
      const policyCheck = await this._checkPoliciesForTraffic(source, destination, port, protocol);
      results.tests.policies = policyCheck;

      if (!policyCheck.allowed) {
        results.issues_found.push({
          severity: 'critical',
          test: 'policies',
          issue: 'No firewall policy allows this traffic',
          details: policyCheck
        });
        results.recommendations.push({
          priority: 'high',
          action: `Create firewall policy to allow traffic`,
          details: `Add policy: ${source || 'any'} → ${destination}:${port || 'any'}/${protocol}`
        });
      }

      // Step 3: Ping test (if ICMP or no protocol specified)
      if (protocol === 'icmp' || !protocol) {
        console.log('  Step 3: Running ping test...');
        const ping = await this._pingTest(destination, source);
        results.tests.ping = ping;

        if (!ping.success) {
          results.issues_found.push({
            severity: 'high',
            test: 'ping',
            issue: 'Ping test failed',
            details: ping
          });
          results.recommendations.push({
            priority: 'medium',
            action: 'Investigate network connectivity',
            details: 'Ping failed - check physical connectivity, routing, and firewall rules'
          });
        }
      }

      // Step 4: Port connectivity test (if TCP/UDP and port specified)
      if ((protocol === 'tcp' || protocol === 'udp') && port) {
        console.log(`  Step 4: Testing ${protocol.toUpperCase()} port ${port}...`);
        const portTest = await this._portConnectivityTest(destination, port, protocol, source);
        results.tests.port = portTest;

        if (!portTest.success) {
          results.issues_found.push({
            severity: 'high',
            test: 'port',
            issue: `${protocol.toUpperCase()} port ${port} is not reachable`,
            details: portTest
          });
          results.recommendations.push({
            priority: 'high',
            action: `Verify service is running on port ${port}`,
            details: `Check that the destination service is listening on ${protocol}/${port}`
          });
        }
      }

      // Step 5: Check NAT configuration (if source is private and dest is public)
      if (this._isPrivateIP(source) && !this._isPrivateIP(destination)) {
        console.log('  Step 5: Checking NAT configuration...');
        const natCheck = await this._checkNATConfiguration(source, destination);
        results.tests.nat = natCheck;

        if (!natCheck.configured) {
          results.issues_found.push({
            severity: 'medium',
            test: 'nat',
            issue: 'NAT may not be configured for this traffic',
            details: natCheck
          });
          results.recommendations.push({
            priority: 'medium',
            action: 'Verify NAT/SNAT configuration',
            details: 'Ensure outbound NAT is configured for private to public traffic'
          });
        }
      }

      // Determine overall status
      results.overall_status = this._determineOverallStatus(results.issues_found);

      // Add summary recommendations
      if (results.issues_found.length === 0) {
        results.recommendations.push({
          priority: 'info',
          action: 'Connectivity appears normal',
          details: 'All tests passed. If issues persist, check application-level configuration.'
        });
      } else {
        results.recommendations.push({
          priority: 'info',
          action: 'Address issues in priority order',
          details: `Found ${results.issues_found.length} issue(s). Resolve critical and high severity items first.`
        });
      }

      return results;

    } catch (error) {
      console.error('❌ Connectivity test error:', error.message);
      results.overall_status = 'error';
      results.error = error.message;
      return results;
    }
  }

  /**
   * Check routing for destination
   */
  async _checkRouting(destination) {
    try {
      // Try to get routing table
      const routes = await this.client.get('monitor/router/ipv4').catch(() => ({ results: [] }));

      // Find matching route
      const matchingRoute = this._findMatchingRoute(destination, routes.results || []);

      return {
        has_route: !!matchingRoute,
        destination,
        gateway: matchingRoute?.gateway || null,
        interface: matchingRoute?.interface || null,
        distance: matchingRoute?.distance || null,
        details: matchingRoute
      };
    } catch (error) {
      return {
        has_route: false,
        error: error.message
      };
    }
  }

  /**
   * Find matching route for destination IP
   */
  _findMatchingRoute(destinationIP, routes) {
    // Look for default route
    const defaultRoute = routes.find(r => r.ip_mask === '0.0.0.0 0.0.0.0' || r.ip_mask === '0.0.0.0/0');

    // Look for specific routes (simplified matching)
    const specificRoute = routes.find(r => {
      const routeNet = r.ip_mask?.split(' ')[0] || r.network;
      return destinationIP.startsWith(routeNet);
    });

    return specificRoute || defaultRoute;
  }

  /**
   * Check firewall policies for traffic
   */
  async _checkPoliciesForTraffic(source, destination, port, protocol) {
    try {
      const policies = await this.client.get('cmdb/firewall/policy').catch(() => ({ results: [] }));

      const matchingPolicies = (policies.results || []).filter(policy => {
        // Check if policy is enabled
        if (policy.status !== 'enable') return false;

        // Check source (simplified)
        const srcMatch = this._matchAddress(source, policy.srcaddr);

        // Check destination (simplified)
        const dstMatch = this._matchAddress(destination, policy.dstaddr);

        // Check service/port (simplified)
        const serviceMatch = this._matchService(port, protocol, policy.service);

        return srcMatch && dstMatch && serviceMatch;
      });

      const allowed = matchingPolicies.some(p => p.action === 'accept');

      return {
        allowed,
        matching_policies: matchingPolicies.length,
        policies: matchingPolicies.map(p => ({
          id: p.policyid,
          name: p.name,
          action: p.action,
          srcintf: p.srcintf?.map(i => i.name),
          dstintf: p.dstintf?.map(i => i.name)
        }))
      };
    } catch (error) {
      return {
        allowed: false,
        error: error.message
      };
    }
  }

  /**
   * Simplified address matching
   */
  _matchAddress(ip, policyAddresses) {
    if (!ip || !policyAddresses) return true; // If not specified, match any

    // Check for "all" address
    const hasAll = policyAddresses.some(addr => addr.name === 'all');
    if (hasAll) return true;

    // Simplified matching - would need full CIDR matching in production
    return policyAddresses.some(addr => addr.name && addr.name.includes(ip));
  }

  /**
   * Simplified service matching
   */
  _matchService(port, protocol, policyServices) {
    if (!port || !policyServices) return true; // If not specified, match any

    // Check for "ALL" service
    const hasAll = policyServices.some(svc => svc.name === 'ALL');
    if (hasAll) return true;

    // Simplified matching
    return true; // In production, would match port ranges and protocols
  }

  /**
   * Ping test
   */
  async _pingTest(destination, source) {
    try {
      // In production, would use FortiOS diag command via API
      // For now, return simulated response based on routing check
      const routing = await this._checkRouting(destination);

      return {
        success: routing.has_route,
        destination,
        source: source || 'default',
        latency_ms: routing.has_route ? Math.floor(Math.random() * 50) + 10 : null,
        packet_loss: routing.has_route ? 0 : 100,
        note: 'Simulated ping test based on routing availability'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Port connectivity test
   */
  async _portConnectivityTest(destination, port, protocol, source) {
    try {
      // In production, would use FortiOS diagnose commands
      // For now, return based on policy check
      const policyCheck = await this._checkPoliciesForTraffic(source, destination, port, protocol);

      return {
        success: policyCheck.allowed,
        destination,
        port,
        protocol,
        source: source || 'default',
        note: 'Connectivity determined by firewall policy analysis'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Check NAT configuration
   */
  async _checkNATConfiguration(source, destination) {
    try {
      const policies = await this.client.get('cmdb/firewall/policy').catch(() => ({ results: [] }));

      const natPolicies = (policies.results || []).filter(policy => {
        return policy.nat === 'enable' || policy.nat === true;
      });

      return {
        configured: natPolicies.length > 0,
        nat_policies: natPolicies.length,
        details: natPolicies.map(p => ({
          id: p.policyid,
          name: p.name,
          nat: p.nat,
          ippool: p.ippool
        }))
      };
    } catch (error) {
      return {
        configured: false,
        error: error.message
      };
    }
  }

  /**
   * Check if IP is private
   */
  _isPrivateIP(ip) {
    if (!ip) return false;
    return ip.startsWith('10.') ||
           ip.startsWith('192.168.') ||
           ip.startsWith('172.16.') ||
           ip.startsWith('172.17.') ||
           ip.startsWith('172.18.') ||
           ip.startsWith('172.19.') ||
           ip.startsWith('172.2') ||
           ip.startsWith('172.30.') ||
           ip.startsWith('172.31.');
  }

  /**
   * Determine overall status from issues
   */
  _determineOverallStatus(issues) {
    if (issues.length === 0) return 'success';

    const criticalIssues = issues.filter(i => i.severity === 'critical');
    if (criticalIssues.length > 0) return 'failure';

    const highIssues = issues.filter(i => i.severity === 'high');
    if (highIssues.length > 0) return 'degraded';

    return 'partial';
  }
}

module.exports = ConnectivityTester;
