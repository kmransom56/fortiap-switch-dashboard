/**
 * Health Monitoring Module with Threshold Alerts
 *
 * Provides advanced health monitoring with proactive alerting based on
 * CPU, memory, and resource usage thresholds.
 *
 * Ported from: AI Agents for Fortinet Firewall Troubleshooting
 * Source: fortios_troubleshooter.py:check_system_health
 */

const FortinetAPIClient = require('./fortinet-api-client');

class HealthMonitor {
  constructor(apiClient) {
    this.client = apiClient || new FortinetAPIClient();

    // Threshold configuration
    this.thresholds = {
      cpu: {
        warning: 80,
        critical: 95
      },
      memory: {
        warning: 80,
        critical: 95
      },
      disk: {
        warning: 85,
        critical: 95
      },
      sessions: {
        warning: 80, // % of max sessions
        critical: 95
      }
    };
  }

  /**
   * Perform comprehensive health check with threshold-based alerting
   * @returns {Object} Health status with alerts and recommendations
   */
  async checkSystemHealth() {
    try {
      console.log('🏥 Performing comprehensive health check...');

      // Gather all health data in parallel
      const [systemStatus, performance, interfaces, sessions] = await Promise.all([
        this.client.get('monitor/system/status').catch(() => ({})),
        this.client.get('monitor/system/resource/usage').catch(() => ({})),
        this.client.get('monitor/system/interface').catch(() => ({ results: [] })),
        this.client.get('monitor/system/session').catch(() => ({}))
      ]);

      // Extract metrics
      const cpuUsage = this._extractCpuUsage(performance);
      const memoryUsage = this._extractMemoryUsage(performance);
      const diskUsage = this._extractDiskUsage(performance);
      const sessionUsage = this._extractSessionUsage(sessions);

      // Analyze interface health
      const interfaceHealth = this._analyzeInterfaces(interfaces.results || []);

      // Determine overall health status
      const healthStatus = this._determineHealthStatus(
        cpuUsage,
        memoryUsage,
        diskUsage,
        sessionUsage
      );

      // Generate alerts based on thresholds
      const alerts = this._generateAlerts(
        cpuUsage,
        memoryUsage,
        diskUsage,
        sessionUsage,
        interfaceHealth
      );

      // Generate recommendations
      const recommendations = this._generateRecommendations(alerts);

      return {
        status: healthStatus,
        timestamp: new Date().toISOString(),
        system_info: {
          version: systemStatus.version || 'Unknown',
          serial: systemStatus.serial || 'Unknown',
          hostname: systemStatus.hostname || 'Unknown',
          uptime: systemStatus.uptime || 0
        },
        metrics: {
          cpu: {
            usage_percent: cpuUsage,
            threshold_warning: this.thresholds.cpu.warning,
            threshold_critical: this.thresholds.cpu.critical,
            status: this._getMetricStatus(cpuUsage, this.thresholds.cpu)
          },
          memory: {
            usage_percent: memoryUsage,
            threshold_warning: this.thresholds.memory.warning,
            threshold_critical: this.thresholds.memory.critical,
            status: this._getMetricStatus(memoryUsage, this.thresholds.memory)
          },
          disk: {
            usage_percent: diskUsage,
            threshold_warning: this.thresholds.disk.warning,
            threshold_critical: this.thresholds.disk.critical,
            status: this._getMetricStatus(diskUsage, this.thresholds.disk)
          },
          sessions: {
            usage_percent: sessionUsage.percent,
            current: sessionUsage.current,
            max: sessionUsage.max,
            threshold_warning: this.thresholds.sessions.warning,
            threshold_critical: this.thresholds.sessions.critical,
            status: this._getMetricStatus(sessionUsage.percent, this.thresholds.sessions)
          }
        },
        interfaces: interfaceHealth,
        alerts: alerts,
        recommendations: recommendations,
        details: {
          raw_performance: performance,
          raw_sessions: sessions
        }
      };

    } catch (error) {
      console.error('❌ Health check failed:', error.message);
      return {
        status: 'Error',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Extract CPU usage from performance data
   */
  _extractCpuUsage(performance) {
    if (performance.cpu) {
      return performance.cpu.usage || performance.cpu || 0;
    }
    if (performance.results && performance.results.cpu) {
      return performance.results.cpu;
    }
    return 0;
  }

  /**
   * Extract memory usage from performance data
   */
  _extractMemoryUsage(performance) {
    if (performance.memory) {
      return performance.memory.usage || performance.memory || 0;
    }
    if (performance.results && performance.results.memory) {
      return performance.results.memory;
    }
    return 0;
  }

  /**
   * Extract disk usage from performance data
   */
  _extractDiskUsage(performance) {
    if (performance.disk) {
      return performance.disk.usage || performance.disk || 0;
    }
    if (performance.results && performance.results.disk) {
      return performance.results.disk;
    }
    return 0;
  }

  /**
   * Extract session usage from session data
   */
  _extractSessionUsage(sessions) {
    const current = sessions.session_count || sessions.count || 0;
    const max = sessions.session_limit || sessions.max || 100000;
    const percent = max > 0 ? Math.round((current / max) * 100) : 0;

    return { current, max, percent };
  }

  /**
   * Analyze interface health
   */
  _analyzeInterfaces(interfaces) {
    const activeInterfaces = interfaces.filter(iface => iface.link === true || iface.status === 'up');
    const totalInterfaces = interfaces.length;

    const interfacesWithErrors = interfaces.filter(iface => {
      const rxErrors = iface.rx_error || iface.rx_errors || 0;
      const txErrors = iface.tx_error || iface.tx_errors || 0;
      return rxErrors > 100 || txErrors > 100; // More than 100 errors is concerning
    });

    return {
      active: activeInterfaces.length,
      total: totalInterfaces,
      down: totalInterfaces - activeInterfaces.length,
      with_errors: interfacesWithErrors.length,
      error_interfaces: interfacesWithErrors.map(iface => ({
        name: iface.name,
        rx_errors: iface.rx_error || iface.rx_errors || 0,
        tx_errors: iface.tx_error || iface.tx_errors || 0
      }))
    };
  }

  /**
   * Determine overall health status based on all metrics
   */
  _determineHealthStatus(cpuUsage, memoryUsage, diskUsage, sessionUsage) {
    // Critical if any metric is in critical zone
    if (cpuUsage >= this.thresholds.cpu.critical ||
        memoryUsage >= this.thresholds.memory.critical ||
        diskUsage >= this.thresholds.disk.critical ||
        sessionUsage.percent >= this.thresholds.sessions.critical) {
      return 'Critical';
    }

    // Warning if any metric is in warning zone
    if (cpuUsage >= this.thresholds.cpu.warning ||
        memoryUsage >= this.thresholds.memory.warning ||
        diskUsage >= this.thresholds.disk.warning ||
        sessionUsage.percent >= this.thresholds.sessions.warning) {
      return 'Warning';
    }

    return 'Healthy';
  }

  /**
   * Get status for individual metric
   */
  _getMetricStatus(value, thresholds) {
    if (value >= thresholds.critical) return 'critical';
    if (value >= thresholds.warning) return 'warning';
    return 'healthy';
  }

  /**
   * Generate alerts based on threshold violations
   */
  _generateAlerts(cpuUsage, memoryUsage, diskUsage, sessionUsage, interfaceHealth) {
    const alerts = [];

    // CPU alerts
    if (cpuUsage >= this.thresholds.cpu.critical) {
      alerts.push({
        severity: 'critical',
        category: 'cpu',
        message: `Critical: CPU usage at ${cpuUsage}% (threshold: ${this.thresholds.cpu.critical}%)`,
        value: cpuUsage,
        threshold: this.thresholds.cpu.critical
      });
    } else if (cpuUsage >= this.thresholds.cpu.warning) {
      alerts.push({
        severity: 'warning',
        category: 'cpu',
        message: `Warning: CPU usage at ${cpuUsage}% (threshold: ${this.thresholds.cpu.warning}%)`,
        value: cpuUsage,
        threshold: this.thresholds.cpu.warning
      });
    }

    // Memory alerts
    if (memoryUsage >= this.thresholds.memory.critical) {
      alerts.push({
        severity: 'critical',
        category: 'memory',
        message: `Critical: Memory usage at ${memoryUsage}% (threshold: ${this.thresholds.memory.critical}%)`,
        value: memoryUsage,
        threshold: this.thresholds.memory.critical
      });
    } else if (memoryUsage >= this.thresholds.memory.warning) {
      alerts.push({
        severity: 'warning',
        category: 'memory',
        message: `Warning: Memory usage at ${memoryUsage}% (threshold: ${this.thresholds.memory.warning}%)`,
        value: memoryUsage,
        threshold: this.thresholds.memory.warning
      });
    }

    // Disk alerts
    if (diskUsage >= this.thresholds.disk.critical) {
      alerts.push({
        severity: 'critical',
        category: 'disk',
        message: `Critical: Disk usage at ${diskUsage}% (threshold: ${this.thresholds.disk.critical}%)`,
        value: diskUsage,
        threshold: this.thresholds.disk.critical
      });
    } else if (diskUsage >= this.thresholds.disk.warning) {
      alerts.push({
        severity: 'warning',
        category: 'disk',
        message: `Warning: Disk usage at ${diskUsage}% (threshold: ${this.thresholds.disk.warning}%)`,
        value: diskUsage,
        threshold: this.thresholds.disk.warning
      });
    }

    // Session alerts
    if (sessionUsage.percent >= this.thresholds.sessions.critical) {
      alerts.push({
        severity: 'critical',
        category: 'sessions',
        message: `Critical: Session usage at ${sessionUsage.percent}% (${sessionUsage.current}/${sessionUsage.max})`,
        value: sessionUsage.percent,
        threshold: this.thresholds.sessions.critical
      });
    } else if (sessionUsage.percent >= this.thresholds.sessions.warning) {
      alerts.push({
        severity: 'warning',
        category: 'sessions',
        message: `Warning: Session usage at ${sessionUsage.percent}% (${sessionUsage.current}/${sessionUsage.max})`,
        value: sessionUsage.percent,
        threshold: this.thresholds.sessions.warning
      });
    }

    // Interface alerts
    if (interfaceHealth.with_errors > 0) {
      alerts.push({
        severity: 'warning',
        category: 'interfaces',
        message: `${interfaceHealth.with_errors} interface(s) with high error counts`,
        interfaces: interfaceHealth.error_interfaces
      });
    }

    if (interfaceHealth.down > 0) {
      alerts.push({
        severity: 'info',
        category: 'interfaces',
        message: `${interfaceHealth.down} interface(s) are down`,
        down_count: interfaceHealth.down
      });
    }

    return alerts;
  }

  /**
   * Generate actionable recommendations based on alerts
   */
  _generateRecommendations(alerts) {
    const recommendations = [];
    const categories = new Set(alerts.map(a => a.category));

    if (categories.has('cpu')) {
      recommendations.push({
        category: 'cpu',
        priority: 'high',
        actions: [
          'Check for traffic spikes in interface statistics',
          'Review running processes and sessions',
          'Consider enabling hardware offloading features',
          'Review firewall policy complexity',
          'Consider upgrading hardware if sustained high usage'
        ]
      });
    }

    if (categories.has('memory')) {
      recommendations.push({
        category: 'memory',
        priority: 'high',
        actions: [
          'Enable conserve mode to free memory',
          'Review and close idle sessions',
          'Disable unused features and services',
          'Check for memory leaks in logs',
          'Consider increasing memory or upgrading hardware'
        ]
      });
    }

    if (categories.has('disk')) {
      recommendations.push({
        category: 'disk',
        priority: 'high',
        actions: [
          'Clear old log files',
          'Review and delete unnecessary reports',
          'Configure log rotation settings',
          'Move logs to external storage (FortiAnalyzer)',
          'Check for large configuration backups'
        ]
      });
    }

    if (categories.has('sessions')) {
      recommendations.push({
        category: 'sessions',
        priority: 'high',
        actions: [
          'Review session timeout settings',
          'Identify and block abusive sources',
          'Check for DDoS or scanning activity',
          'Review firewall policies for session efficiency',
          'Consider upgrading to higher session capacity'
        ]
      });
    }

    if (categories.has('interfaces')) {
      recommendations.push({
        category: 'interfaces',
        priority: 'medium',
        actions: [
          'Check physical cable connections',
          'Review interface error logs for patterns',
          'Verify duplex and speed settings match switch',
          'Check for hardware issues (cable, NIC, switch port)',
          'Monitor for collisions and CRC errors'
        ]
      });
    }

    return recommendations;
  }

  /**
   * Update alert thresholds
   */
  updateThresholds(newThresholds) {
    this.thresholds = {
      ...this.thresholds,
      ...newThresholds
    };
  }

  /**
   * Get current threshold configuration
   */
  getThresholds() {
    return { ...this.thresholds };
  }
}

module.exports = HealthMonitor;
