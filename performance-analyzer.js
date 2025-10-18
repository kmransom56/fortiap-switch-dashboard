/**
 * Performance Analyzer Module
 *
 * Identifies performance bottlenecks and provides optimization recommendations
 * based on CPU, memory, sessions, and interface metrics.
 *
 * Ported from: AI Agents for Fortinet Firewall Troubleshooting
 * Source: fortios_troubleshooter.py:comprehensive_health_check
 */

const FortinetAPIClient = require('./fortinet-api-client');

class PerformanceAnalyzer {
  constructor(apiClient) {
    this.client = apiClient || new FortinetAPIClient();
  }

  /**
   * Analyze system performance and identify bottlenecks
   * @returns {Object} Performance analysis with bottlenecks and optimizations
   */
  async analyzePerformance() {
    console.log('📊 Analyzing system performance...');

    const results = {
      timestamp: new Date().toISOString(),
      overall_health: 'unknown',
      bottlenecks: [],
      optimizations: [],
      metrics: {},
      analysis: {}
    };

    try {
      // Gather performance data
      console.log('  Gathering performance metrics...');
      const [systemStatus, performance, sessions, interfaces] = await Promise.all([
        this.client.get('monitor/system/status').catch(() => ({})),
        this.client.get('monitor/system/resource/usage').catch(() => ({})),
        this.client.get('monitor/system/session').catch(() => ({})),
        this.client.get('monitor/system/interface').catch(() => ({ results: [] }))
      ]);

      // Extract and analyze metrics
      results.metrics = {
        cpu: this._extractCPUMetrics(performance),
        memory: this._extractMemoryMetrics(performance),
        disk: this._extractDiskMetrics(performance),
        sessions: this._extractSessionMetrics(sessions),
        interfaces: this._analyzeInterfaces(interfaces.results || [])
      };

      // Identify bottlenecks
      console.log('  Identifying bottlenecks...');
      results.bottlenecks = this._identifyBottlenecks(results.metrics);

      // Generate optimization recommendations
      console.log('  Generating optimization recommendations...');
      results.optimizations = this._generateOptimizations(results.metrics, results.bottlenecks);

      // Perform deeper analysis
      results.analysis = {
        cpu_analysis: this._analyzeCPU(results.metrics.cpu),
        memory_analysis: this._analyzeMemory(results.metrics.memory),
        session_analysis: this._analyzeSessions(results.metrics.sessions),
        interface_analysis: this._analyzeInterfacePerformance(results.metrics.interfaces)
      };

      // Determine overall health
      results.overall_health = this._determineOverallHealth(results.bottlenecks);

      return results;

    } catch (error) {
      console.error('❌ Performance analysis error:', error.message);
      results.overall_health = 'error';
      results.error = error.message;
      return results;
    }
  }

  /**
   * Extract CPU metrics
   */
  _extractCPUMetrics(performance) {
    const cpuUsage = performance.cpu?.usage || performance.cpu || 0;

    return {
      usage_percent: cpuUsage,
      status: cpuUsage >= 95 ? 'critical' : cpuUsage >= 80 ? 'warning' : 'normal',
      nice: performance.cpu?.nice_usage || 0,
      system: performance.cpu?.system_usage || 0,
      idle: performance.cpu?.idle_usage || (100 - cpuUsage)
    };
  }

  /**
   * Extract memory metrics
   */
  _extractMemoryMetrics(performance) {
    const memUsage = performance.memory?.usage || performance.memory || 0;

    return {
      usage_percent: memUsage,
      status: memUsage >= 95 ? 'critical' : memUsage >= 80 ? 'warning' : 'normal',
      total_kb: performance.memory?.total || 0,
      used_kb: performance.memory?.used || 0,
      free_kb: performance.memory?.free || 0
    };
  }

  /**
   * Extract disk metrics
   */
  _extractDiskMetrics(performance) {
    const diskUsage = performance.disk?.usage || performance.disk || 0;

    return {
      usage_percent: diskUsage,
      status: diskUsage >= 95 ? 'critical' : diskUsage >= 85 ? 'warning' : 'normal',
      total_mb: performance.disk?.total || 0,
      used_mb: performance.disk?.used || 0,
      free_mb: performance.disk?.free || 0
    };
  }

  /**
   * Extract session metrics
   */
  _extractSessionMetrics(sessions) {
    const current = sessions.session_count || sessions.count || 0;
    const max = sessions.session_limit || sessions.max || 100000;
    const percent = max > 0 ? Math.round((current / max) * 100) : 0;

    return {
      current_sessions: current,
      max_sessions: max,
      usage_percent: percent,
      status: percent >= 95 ? 'critical' : percent >= 80 ? 'warning' : 'normal',
      setup_rate: sessions.setup_rate || 0,
      ttl: sessions.ttl || 0
    };
  }

  /**
   * Analyze interfaces
   */
  _analyzeInterfaces(interfaces) {
    const stats = {
      total: interfaces.length,
      up: 0,
      down: 0,
      high_utilization: [],
      high_errors: [],
      total_bandwidth_mbps: 0,
      used_bandwidth_mbps: 0
    };

    interfaces.forEach(iface => {
      // Count up/down
      if (iface.link === true || iface.status === 'up') {
        stats.up++;
      } else {
        stats.down++;
      }

      // Check utilization (if available)
      const speed = iface.speed || 0;
      const bandwidth = iface.bandwidth || 0;
      if (speed > 0 && bandwidth > 0) {
        const utilization = (bandwidth / speed) * 100;
        if (utilization > 80) {
          stats.high_utilization.push({
            name: iface.name,
            utilization_percent: Math.round(utilization),
            speed_mbps: speed,
            bandwidth_mbps: bandwidth
          });
        }
      }

      // Check errors
      const rxErrors = iface.rx_error || iface.rx_errors || 0;
      const txErrors = iface.tx_error || iface.tx_errors || 0;
      if (rxErrors > 1000 || txErrors > 1000) {
        stats.high_errors.push({
          name: iface.name,
          rx_errors: rxErrors,
          tx_errors: txErrors
        });
      }

      // Sum bandwidth
      stats.total_bandwidth_mbps += speed;
      stats.used_bandwidth_mbps += bandwidth;
    });

    return stats;
  }

  /**
   * Identify performance bottlenecks
   */
  _identifyBottlenecks(metrics) {
    const bottlenecks = [];

    // CPU bottleneck
    if (metrics.cpu.status === 'critical') {
      bottlenecks.push({
        type: 'cpu',
        severity: 'critical',
        current_value: metrics.cpu.usage_percent,
        threshold: 95,
        impact: 'System performance severely degraded. Packet processing delays expected.',
        recommendation: 'Immediate action required to reduce CPU load'
      });
    } else if (metrics.cpu.status === 'warning') {
      bottlenecks.push({
        type: 'cpu',
        severity: 'warning',
        current_value: metrics.cpu.usage_percent,
        threshold: 80,
        impact: 'System approaching performance limits. May impact latency.',
        recommendation: 'Review and optimize firewall policies and features'
      });
    }

    // Memory bottleneck
    if (metrics.memory.status === 'critical') {
      bottlenecks.push({
        type: 'memory',
        severity: 'critical',
        current_value: metrics.memory.usage_percent,
        threshold: 95,
        impact: 'Memory exhaustion imminent. System may enter conserve mode.',
        recommendation: 'Free memory immediately or system stability at risk'
      });
    } else if (metrics.memory.status === 'warning') {
      bottlenecks.push({
        type: 'memory',
        severity: 'warning',
        current_value: metrics.memory.usage_percent,
        threshold: 80,
        impact: 'Memory pressure detected. Performance may degrade.',
        recommendation: 'Review memory-intensive features and reduce session count'
      });
    }

    // Disk bottleneck
    if (metrics.disk.status === 'critical') {
      bottlenecks.push({
        type: 'disk',
        severity: 'critical',
        current_value: metrics.disk.usage_percent,
        threshold: 95,
        impact: 'Disk space critically low. Logging and reporting may fail.',
        recommendation: 'Clear disk space immediately to prevent system issues'
      });
    } else if (metrics.disk.status === 'warning') {
      bottlenecks.push({
        type: 'disk',
        severity: 'warning',
        current_value: metrics.disk.usage_percent,
        threshold: 85,
        impact: 'Disk space running low. May impact logging and reports.',
        recommendation: 'Clean up old logs and reports'
      });
    }

    // Session bottleneck
    if (metrics.sessions.status === 'critical') {
      bottlenecks.push({
        type: 'sessions',
        severity: 'critical',
        current_value: metrics.sessions.current_sessions,
        max_sessions: metrics.sessions.max_sessions,
        usage_percent: metrics.sessions.usage_percent,
        threshold: 95,
        impact: 'Session table nearly full. New connections may be rejected.',
        recommendation: 'Reduce session timeout or increase session table size'
      });
    } else if (metrics.sessions.status === 'warning') {
      bottlenecks.push({
        type: 'sessions',
        severity: 'warning',
        current_value: metrics.sessions.current_sessions,
        max_sessions: metrics.sessions.max_sessions,
        usage_percent: metrics.sessions.usage_percent,
        threshold: 80,
        impact: 'Session table filling up. Monitor for connection issues.',
        recommendation: 'Review session timeout settings and identify session hogs'
      });
    }

    // Interface bottlenecks
    if (metrics.interfaces.high_utilization.length > 0) {
      bottlenecks.push({
        type: 'interface_bandwidth',
        severity: 'warning',
        interfaces: metrics.interfaces.high_utilization,
        impact: 'Interface(s) experiencing high bandwidth utilization.',
        recommendation: 'Consider upgrading link speed or implementing QoS'
      });
    }

    if (metrics.interfaces.high_errors.length > 0) {
      bottlenecks.push({
        type: 'interface_errors',
        severity: 'warning',
        interfaces: metrics.interfaces.high_errors,
        impact: 'Interface(s) experiencing high error rates.',
        recommendation: 'Check physical connections and interface settings'
      });
    }

    return bottlenecks;
  }

  /**
   * Generate optimization recommendations
   */
  _generateOptimizations(metrics, bottlenecks) {
    const optimizations = [];

    // CPU optimizations
    if (bottlenecks.some(b => b.type === 'cpu')) {
      optimizations.push({
        category: 'cpu',
        priority: 'high',
        title: 'CPU Optimization',
        actions: [
          'Enable hardware offloading (NP processors if available)',
          'Review and simplify complex firewall policies',
          'Disable unused security features (IPS, AV, Web Filter on low-risk zones)',
          'Implement policy-based routing to offload traffic',
          'Check for traffic spikes and implement rate limiting',
          'Consider upgrading to higher-performance hardware'
        ]
      });
    }

    // Memory optimizations
    if (bottlenecks.some(b => b.type === 'memory')) {
      optimizations.push({
        category: 'memory',
        priority: 'high',
        title: 'Memory Optimization',
        actions: [
          'Enable conserve mode: config system global set memory-use-threshold-extreme 95',
          'Reduce session timeout values',
          'Clear session table: diag sys session clear',
          'Disable unused features to free memory',
          'Review FortiGuard services and disable unnecessary ones',
          'Upgrade memory or move to higher-capacity model'
        ]
      });
    }

    // Disk optimizations
    if (bottlenecks.some(b => b.type === 'disk')) {
      optimizations.push({
        category: 'disk',
        priority: 'high',
        title: 'Disk Space Optimization',
        actions: [
          'Clear old log files: execute disk format logdisk',
          'Delete old configuration backups',
          'Configure log rotation: config log disk setting',
          'Send logs to FortiAnalyzer instead of local storage',
          'Delete old reports and quarantine files',
          'Reduce log levels for verbose categories'
        ]
      });
    }

    // Session optimizations
    if (bottlenecks.some(b => b.type === 'sessions')) {
      optimizations.push({
        category: 'sessions',
        priority: 'high',
        title: 'Session Table Optimization',
        actions: [
          'Reduce TCP session timeout: config system session-ttl',
          'Identify and block abusive sources consuming sessions',
          'Check for DDoS or port scanning activity',
          'Review applications using excessive sessions',
          'Implement connection limits per policy',
          'Upgrade to model with larger session table'
        ]
      });
    }

    // Interface optimizations
    if (bottlenecks.some(b => b.type === 'interface_bandwidth')) {
      optimizations.push({
        category: 'bandwidth',
        priority: 'medium',
        title: 'Bandwidth Optimization',
        actions: [
          'Implement traffic shaping and QoS policies',
          'Identify and limit bandwidth-intensive applications',
          'Upgrade interface speed (1G to 10G, etc.)',
          'Implement link aggregation (LACP) for redundancy',
          'Schedule large transfers during off-peak hours'
        ]
      });
    }

    if (bottlenecks.some(b => b.type === 'interface_errors')) {
      optimizations.push({
        category: 'interface_errors',
        priority: 'medium',
        title: 'Interface Error Resolution',
        actions: [
          'Check and replace faulty network cables',
          'Verify duplex and speed settings match switch configuration',
          'Clean fiber optic connectors if using fiber',
          'Check for electromagnetic interference',
          'Review switch port configuration for errors',
          'Consider replacing network interface hardware'
        ]
      });
    }

    // General optimizations if no bottlenecks
    if (bottlenecks.length === 0) {
      optimizations.push({
        category: 'general',
        priority: 'low',
        title: 'Proactive Optimizations',
        actions: [
          'Performance is healthy - consider these proactive measures:',
          'Review and remove unused firewall policies',
          'Implement policy-based routing for optimal traffic flow',
          'Enable logging only for critical policies to reduce overhead',
          'Schedule regular performance reviews',
          'Establish baseline metrics for trend analysis'
        ]
      });
    }

    return optimizations;
  }

  /**
   * Analyze CPU usage patterns
   */
  _analyzeCPU(cpuMetrics) {
    const usage = cpuMetrics.usage_percent;

    let analysis = {
      status: cpuMetrics.status,
      description: '',
      concerns: []
    };

    if (usage < 50) {
      analysis.description = 'CPU usage is normal and healthy.';
    } else if (usage < 80) {
      analysis.description = 'CPU usage is moderate. Monitor during peak hours.';
      analysis.concerns.push('May experience latency spikes during traffic bursts');
    } else if (usage < 95) {
      analysis.description = 'CPU usage is high. Performance degradation likely.';
      analysis.concerns.push('Packet processing delays expected');
      analysis.concerns.push('New sessions may experience slowness');
    } else {
      analysis.description = 'CPU usage is critical. System performance severely impacted.';
      analysis.concerns.push('Severe packet processing delays');
      analysis.concerns.push('Possible packet drops');
      analysis.concerns.push('New connections may be rejected');
    }

    return analysis;
  }

  /**
   * Analyze memory usage patterns
   */
  _analyzeMemory(memMetrics) {
    const usage = memMetrics.usage_percent;

    let analysis = {
      status: memMetrics.status,
      description: '',
      concerns: []
    };

    if (usage < 50) {
      analysis.description = 'Memory usage is normal and healthy.';
    } else if (usage < 80) {
      analysis.description = 'Memory usage is moderate. Continue monitoring.';
    } else if (usage < 95) {
      analysis.description = 'Memory usage is high. System may enter conserve mode soon.';
      analysis.concerns.push('Risk of entering conserve mode');
      analysis.concerns.push('Performance degradation possible');
    } else {
      analysis.description = 'Memory usage is critical. Conserve mode likely active.';
      analysis.concerns.push('System in or approaching conserve mode');
      analysis.concerns.push('Features may be disabled to preserve memory');
      analysis.concerns.push('System stability at risk');
    }

    return analysis;
  }

  /**
   * Analyze session usage
   */
  _analyzeSessions(sessionMetrics) {
    const usage = sessionMetrics.usage_percent;

    let analysis = {
      status: sessionMetrics.status,
      description: '',
      concerns: []
    };

    if (usage < 50) {
      analysis.description = 'Session table usage is normal.';
    } else if (usage < 80) {
      analysis.description = 'Session table usage is moderate.';
      analysis.concerns.push('Monitor for session-intensive applications');
    } else if (usage < 95) {
      analysis.description = 'Session table usage is high.';
      analysis.concerns.push('Approaching session table limits');
      analysis.concerns.push('May impact new connections');
    } else {
      analysis.description = 'Session table is nearly full.';
      analysis.concerns.push('New connections may be rejected');
      analysis.concerns.push('Possible DDoS or scanning activity');
      analysis.concerns.push('Review session timeout settings');
    }

    return analysis;
  }

  /**
   * Analyze interface performance
   */
  _analyzeInterfacePerformance(interfaceMetrics) {
    return {
      total_interfaces: interfaceMetrics.total,
      active_interfaces: interfaceMetrics.up,
      down_interfaces: interfaceMetrics.down,
      high_utilization_count: interfaceMetrics.high_utilization.length,
      high_error_count: interfaceMetrics.high_errors.length,
      overall_status: interfaceMetrics.high_errors.length > 0 ? 'degraded' : 'normal'
    };
  }

  /**
   * Determine overall health from bottlenecks
   */
  _determineOverallHealth(bottlenecks) {
    if (bottlenecks.length === 0) return 'healthy';

    const criticalBottlenecks = bottlenecks.filter(b => b.severity === 'critical');
    if (criticalBottlenecks.length > 0) return 'critical';

    return 'degraded';
  }
}

module.exports = PerformanceAnalyzer;
