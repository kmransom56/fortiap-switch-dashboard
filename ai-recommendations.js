/**
 * AI-Driven Recommendations Engine
 *
 * Provides intelligent troubleshooting recommendations based on pattern matching,
 * knowledge base, and historical issue resolution.
 *
 * Ported from: AI Agents for Fortinet Firewall Troubleshooting
 * Source: fortinet_ai_reasoning.py
 */

const FortinetAPIClient = require('./fortinet-api-client');

class AIRecommendations {
  constructor(apiClient) {
    this.client = apiClient || new FortinetAPIClient();
    this.knowledgeBase = this._initializeKnowledgeBase();
    this.issueHistory = [];
  }

  /**
   * Analyze an issue and provide AI-driven recommendations
   * @param {Object} diagnosticData - Diagnostic results from troubleshooting modules
   * @param {string} issueType - Type of issue (connectivity, vpn, performance, security)
   * @returns {Object} AI-driven analysis and recommendations
   */
  async analyzeIssue(diagnosticData, issueType) {
    console.log(`🤖 AI analyzing ${issueType} issue...`);

    const analysis = {
      timestamp: new Date().toISOString(),
      issue_type: issueType,
      confidence: 0,
      root_cause: null,
      issue_classification: null,
      severity: 'unknown',
      remediation_steps: [],
      related_articles: [],
      similar_past_issues: [],
      preventive_measures: []
    };

    try {
      // Match against knowledge base patterns
      const matches = this._matchKnowledgeBase(diagnosticData, issueType);

      if (matches.length > 0) {
        const bestMatch = matches[0];
        analysis.confidence = bestMatch.confidence;
        analysis.root_cause = bestMatch.root_cause;
        analysis.issue_classification = bestMatch.classification;
        analysis.severity = bestMatch.severity;
        analysis.remediation_steps = bestMatch.solutions;
        analysis.related_articles = bestMatch.articles;
      }

      // Check for similar past issues
      analysis.similar_past_issues = this._findSimilarPastIssues(diagnosticData, issueType);

      // Generate preventive measures
      analysis.preventive_measures = this._generatePreventiveMeasures(issueType, analysis);

      // Enhance with contextual recommendations
      analysis.contextual_recommendations = await this._getContextualRecommendations(diagnosticData, issueType);

      // Record this analysis for future learning
      this._recordIssue(diagnosticData, issueType, analysis);

      return analysis;

    } catch (error) {
      console.error('❌ AI analysis error:', error.message);
      analysis.error = error.message;
      return analysis;
    }
  }

  /**
   * Initialize knowledge base with common issues and solutions
   */
  _initializeKnowledgeBase() {
    return {
      connectivity: [
        {
          pattern: 'no_route',
          classification: 'routing_problem',
          root_cause: 'No route to destination network',
          severity: 'critical',
          confidence: 0.95,
          solutions: [
            '1. Check routing table: diagnose ip route list',
            '2. Add static route if needed: config router static',
            '3. Verify default gateway is configured',
            '4. Check if dynamic routing (OSPF/BGP) is working',
            '5. Verify interface is up and has correct IP'
          ],
          articles: [
            'KB-1001: Configuring Static Routes',
            'KB-1015: Troubleshooting Routing Issues',
            'KB-1025: Dynamic Routing Configuration'
          ]
        },
        {
          pattern: 'policy_deny',
          classification: 'firewall_policy_block',
          root_cause: 'Traffic blocked by firewall policy',
          severity: 'high',
          confidence: 0.90,
          solutions: [
            '1. Review firewall policies: config firewall policy',
            '2. Check policy order - policies evaluated top to bottom',
            '3. Create allow policy with correct source/destination',
            '4. Verify NAT configuration if crossing zones',
            '5. Check address objects match actual IPs'
          ],
          articles: [
            'KB-2001: Firewall Policy Configuration',
            'KB-2010: Policy Troubleshooting Guide',
            'KB-2020: NAT Configuration Best Practices'
          ]
        },
        {
          pattern: 'ping_fail',
          classification: 'network_connectivity_issue',
          root_cause: 'ICMP packets not reaching destination',
          severity: 'high',
          confidence: 0.85,
          solutions: [
            '1. Verify routing to destination',
            '2. Check if firewall allows ICMP',
            '3. Verify destination is reachable (cable, switch, etc.)',
            '4. Check for ICMP rate limiting',
            '5. Try traceroute to see where packets stop'
          ],
          articles: [
            'KB-3001: Network Connectivity Troubleshooting',
            'KB-3010: ICMP and Ping Configuration'
          ]
        }
      ],
      vpn: [
        {
          pattern: 'phase1_down',
          classification: 'ike_negotiation_failure',
          root_cause: 'Phase 1 (IKE) negotiation failed',
          severity: 'critical',
          confidence: 0.95,
          solutions: [
            '1. Verify pre-shared key matches on both ends',
            '2. Check IKE version compatibility (IKEv1 vs IKEv2)',
            '3. Verify encryption/auth proposals match peer',
            '4. Ensure UDP 500 is not blocked by firewall',
            '5. Check logs: diagnose debug application ike -1',
            '6. Verify remote gateway IP is correct'
          ],
          articles: [
            'KB-4001: IPsec VPN Configuration Guide',
            'KB-4010: Phase 1 Troubleshooting',
            'KB-4015: IKE Proposal Mismatch Resolution'
          ]
        },
        {
          pattern: 'phase2_down',
          classification: 'ipsec_negotiation_failure',
          root_cause: 'Phase 2 (IPsec) negotiation failed',
          severity: 'critical',
          confidence: 0.90,
          solutions: [
            '1. Verify Phase 2 proposals match both ends',
            '2. Check local/remote subnet configuration',
            '3. Verify proxy-id settings match',
            '4. Ensure Phase 1 is up first',
            '5. Check for PFS group mismatch',
            '6. Verify UDP 4500 (NAT-T) is not blocked if behind NAT'
          ],
          articles: [
            'KB-4020: Phase 2 Configuration',
            'KB-4025: Proxy-ID Configuration',
            'KB-4030: NAT Traversal Setup'
          ]
        },
        {
          pattern: 'no_traffic',
          classification: 'vpn_routing_issue',
          root_cause: 'VPN up but no traffic flowing',
          severity: 'high',
          confidence: 0.85,
          solutions: [
            '1. Verify firewall policies allow VPN traffic',
            '2. Check routing - traffic must be routed to VPN',
            '3. Verify remote subnet is accessible',
            '4. Check interesting traffic selectors',
            '5. Verify NAT exemption is configured',
            '6. Test with ping across VPN tunnel'
          ],
          articles: [
            'KB-4040: VPN Traffic Routing',
            'KB-4045: NAT Exemption for VPN',
            'KB-4050: VPN Policy Configuration'
          ]
        }
      ],
      performance: [
        {
          pattern: 'high_cpu',
          classification: 'cpu_overload',
          root_cause: 'CPU usage exceeds recommended thresholds',
          severity: 'critical',
          confidence: 0.90,
          solutions: [
            '1. Enable hardware offloading (NP processors)',
            '2. Review and simplify complex firewall policies',
            '3. Disable unused security features on low-risk traffic',
            '4. Check for traffic spikes: diagnose sys session stat',
            '5. Implement policy-based routing to distribute load',
            '6. Consider upgrading to higher-performance hardware'
          ],
          articles: [
            'KB-5001: CPU Optimization Guide',
            'KB-5010: Hardware Offloading Configuration',
            'KB-5020: Performance Tuning Best Practices'
          ]
        },
        {
          pattern: 'high_memory',
          classification: 'memory_pressure',
          root_cause: 'Memory usage approaching critical levels',
          severity: 'critical',
          confidence: 0.90,
          solutions: [
            '1. Enable conserve mode thresholds',
            '2. Reduce session timeout values',
            '3. Clear session table: diagnose sys session clear',
            '4. Disable unused features to free memory',
            '5. Review FortiGuard services and disable unnecessary ones',
            '6. Consider memory upgrade or higher-capacity model'
          ],
          articles: [
            'KB-5030: Memory Management',
            'KB-5035: Conserve Mode Configuration',
            'KB-5040: Session Timeout Optimization'
          ]
        },
        {
          pattern: 'high_sessions',
          classification: 'session_table_exhaustion',
          root_cause: 'Session table approaching capacity',
          severity: 'high',
          confidence: 0.85,
          solutions: [
            '1. Reduce TCP session timeout',
            '2. Identify and block abusive sources',
            '3. Check for DDoS or port scanning activity',
            '4. Review applications using excessive sessions',
            '5. Implement connection limits per policy',
            '6. Upgrade to model with larger session capacity'
          ],
          articles: [
            'KB-5050: Session Table Management',
            'KB-5055: DDoS Protection Configuration',
            'KB-5060: Connection Rate Limiting'
          ]
        }
      ],
      security: [
        {
          pattern: 'critical_threats',
          classification: 'active_security_threat',
          root_cause: 'Critical security threats detected',
          severity: 'critical',
          confidence: 0.95,
          solutions: [
            '1. Isolate affected systems immediately',
            '2. Review security logs for attack patterns',
            '3. Check if known vulnerabilities are exploited',
            '4. Update IPS signatures to latest version',
            '5. Scan affected systems with antivirus',
            '6. Review and strengthen firewall policies'
          ],
          articles: [
            'KB-6001: Incident Response Guide',
            'KB-6010: Threat Investigation Procedures',
            'KB-6020: Security Hardening Checklist'
          ]
        },
        {
          pattern: 'virus_detected',
          classification: 'malware_infection',
          root_cause: 'Virus or malware detected on network',
          severity: 'high',
          confidence: 0.90,
          solutions: [
            '1. Identify and isolate infected systems',
            '2. Update antivirus signatures',
            '3. Scan all affected systems thoroughly',
            '4. Review file transfer policies',
            '5. Block malicious file types if applicable',
            '6. Educate users about malware prevention'
          ],
          articles: [
            'KB-6030: Malware Response Procedures',
            'KB-6035: Antivirus Configuration',
            'KB-6040: File Security Best Practices'
          ]
        }
      ]
    };
  }

  /**
   * Match diagnostic data against knowledge base
   */
  _matchKnowledgeBase(diagnosticData, issueType) {
    const matches = [];
    const patterns = this.knowledgeBase[issueType] || [];

    for (const entry of patterns) {
      const confidence = this._calculatePatternMatch(diagnosticData, entry.pattern, issueType);

      if (confidence > 0.5) {
        matches.push({
          ...entry,
          confidence: confidence * entry.confidence
        });
      }
    }

    // Sort by confidence
    return matches.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Calculate how well diagnostic data matches a pattern
   */
  _calculatePatternMatch(diagnosticData, pattern, issueType) {
    let confidence = 0;

    switch (issueType) {
      case 'connectivity':
        if (pattern === 'no_route' && diagnosticData.tests?.routing?.has_route === false) {
          confidence = 0.95;
        } else if (pattern === 'policy_deny' && diagnosticData.tests?.policies?.allowed === false) {
          confidence = 0.90;
        } else if (pattern === 'ping_fail' && diagnosticData.tests?.ping?.success === false) {
          confidence = 0.85;
        }
        break;

      case 'vpn':
        if (pattern === 'phase1_down' && diagnosticData.status?.phase1 !== 'up') {
          confidence = 0.95;
        } else if (pattern === 'phase2_down' && diagnosticData.status?.phase2 !== 'up') {
          confidence = 0.90;
        } else if (pattern === 'no_traffic' && diagnosticData.traffic_stats?.bytes_sent === 0) {
          confidence = 0.85;
        }
        break;

      case 'performance':
        if (pattern === 'high_cpu' && diagnosticData.metrics?.cpu?.usage_percent > 80) {
          confidence = 0.90;
        } else if (pattern === 'high_memory' && diagnosticData.metrics?.memory?.usage_percent > 80) {
          confidence = 0.90;
        } else if (pattern === 'high_sessions' && diagnosticData.metrics?.sessions?.usage_percent > 80) {
          confidence = 0.85;
        }
        break;

      case 'security':
        if (pattern === 'critical_threats' && diagnosticData.summary?.critical > 0) {
          confidence = 0.95;
        } else if (pattern === 'virus_detected' && diagnosticData.categories?.antivirus?.total > 0) {
          confidence = 0.90;
        }
        break;
    }

    return confidence;
  }

  /**
   * Find similar past issues from history
   */
  _findSimilarPastIssues(diagnosticData, issueType) {
    return this.issueHistory
      .filter(issue => issue.issueType === issueType)
      .slice(0, 3)
      .map(issue => ({
        timestamp: issue.timestamp,
        classification: issue.analysis.issue_classification,
        resolution: issue.analysis.remediation_steps[0], // First step of resolution
        time_to_resolve: 'N/A' // Would track in production
      }));
  }

  /**
   * Generate preventive measures
   */
  _generatePreventiveMeasures(issueType, analysis) {
    const measures = [];

    switch (issueType) {
      case 'connectivity':
        measures.push({
          category: 'monitoring',
          action: 'Set up connectivity monitoring alerts',
          benefit: 'Detect connectivity issues before users report them'
        });
        measures.push({
          category: 'documentation',
          action: 'Document network topology and routing',
          benefit: 'Faster troubleshooting when issues occur'
        });
        break;

      case 'vpn':
        measures.push({
          category: 'maintenance',
          action: 'Schedule regular VPN health checks',
          benefit: 'Proactive detection of VPN issues'
        });
        measures.push({
          category: 'monitoring',
          action: 'Enable VPN logging and alerting',
          benefit: 'Immediate notification of VPN failures'
        });
        break;

      case 'performance':
        measures.push({
          category: 'capacity_planning',
          action: 'Monitor performance trends monthly',
          benefit: 'Plan upgrades before performance degrades'
        });
        measures.push({
          category: 'optimization',
          action: 'Review and optimize policies quarterly',
          benefit: 'Maintain optimal performance over time'
        });
        break;

      case 'security':
        measures.push({
          category: 'updates',
          action: 'Keep security signatures up to date',
          benefit: 'Protection against latest threats'
        });
        measures.push({
          category: 'training',
          action: 'Conduct security awareness training',
          benefit: 'Reduce user-initiated security incidents'
        });
        break;
    }

    return measures;
  }

  /**
   * Get contextual recommendations based on current system state
   */
  async _getContextualRecommendations(diagnosticData, issueType) {
    try {
      // Get current system status for context
      const systemStatus = await this.client.get('monitor/system/status').catch(() => ({}));

      const recommendations = [];

      // Check firmware version
      if (systemStatus.version) {
        recommendations.push({
          context: 'firmware',
          recommendation: `Running FortiOS ${systemStatus.version}`,
          action: 'Check for firmware updates that may address this issue'
        });
      }

      // Check license status
      if (systemStatus.license_status) {
        recommendations.push({
          context: 'licensing',
          recommendation: 'Verify FortiGuard services are active',
          action: 'Some features require active subscriptions'
        });
      }

      return recommendations;
    } catch (error) {
      return [];
    }
  }

  /**
   * Record issue for future learning
   */
  _recordIssue(diagnosticData, issueType, analysis) {
    this.issueHistory.push({
      timestamp: new Date().toISOString(),
      issueType,
      diagnosticData,
      analysis
    });

    // Keep only last 100 issues
    if (this.issueHistory.length > 100) {
      this.issueHistory = this.issueHistory.slice(-100);
    }
  }

  /**
   * Get issue statistics for reporting
   */
  getIssueStatistics() {
    const stats = {
      total_issues: this.issueHistory.length,
      by_type: {},
      by_severity: {
        critical: 0,
        high: 0,
        medium: 0,
        low: 0
      },
      avg_confidence: 0
    };

    this.issueHistory.forEach(issue => {
      // Count by type
      stats.by_type[issue.issueType] = (stats.by_type[issue.issueType] || 0) + 1;

      // Count by severity
      if (issue.analysis.severity) {
        stats.by_severity[issue.analysis.severity]++;
      }
    });

    // Calculate average confidence
    if (this.issueHistory.length > 0) {
      const totalConfidence = this.issueHistory.reduce((sum, issue) =>
        sum + (issue.analysis.confidence || 0), 0);
      stats.avg_confidence = totalConfidence / this.issueHistory.length;
    }

    return stats;
  }
}

module.exports = AIRecommendations;
