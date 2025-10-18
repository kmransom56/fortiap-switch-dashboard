/**
 * Policy Analyzer Module
 * Ported from firewall_optimizer/policy_analyzer.py
 * Analyzes firewall policies for optimization opportunities, duplicates, and effectiveness
 */

class PolicyAnalyzer {
  constructor() {
    this.anyAddressTokens = new Set(['all', 'any']);
    this.anyServiceTokens = new Set(['ALL', 'ALL_SERVICES', 'ANY', 'ALL_ICMP']);
  }

  /**
   * Analyze a set of firewall policies
   * @param {Array} policies - Array of policy objects from FortiGate API
   * @returns {Object} - Analysis results with recommendations
   */
  analyzePolicies(policies) {
    if (!Array.isArray(policies) || policies.length === 0) {
      return {
        total_policies: 0,
        enabled_policies: 0,
        disabled_policies: 0,
        duplicates: [],
        similar_pairs: [],
        unused_policies: [],
        broad_policies: [],
        optimization_score: 100,
        recommendations: []
      };
    }

    const enabledPolicies = policies.filter(p => p.status === 'enable');
    const disabledPolicies = policies.filter(p => p.status === 'disable');

    // Normalize policies for comparison
    const normalizedPolicies = policies.map(p => this.normalizePolicy(p));

    // Find duplicates
    const duplicates = this.findDuplicates(normalizedPolicies);

    // Find similar policies
    const similarPairs = this.findSimilarPolicies(normalizedPolicies, 0.85);

    // Find unused policies (no hits)
    const unusedPolicies = this.findUnusedPolicies(policies);

    // Find overly broad policies
    const broadPolicies = this.findBroadPolicies(policies);

    // Calculate optimization score
    const optimizationScore = this.calculateOptimizationScore({
      total: policies.length,
      duplicates: duplicates.length,
      similar: similarPairs.length,
      unused: unusedPolicies.length,
      broad: broadPolicies.length
    });

    // Generate recommendations
    const recommendations = this.generateRecommendations({
      duplicates,
      similarPairs,
      unusedPolicies,
      broadPolicies,
      totalPolicies: policies.length
    });

    return {
      total_policies: policies.length,
      enabled_policies: enabledPolicies.length,
      disabled_policies: disabledPolicies.length,
      duplicates,
      similar_pairs: similarPairs,
      unused_policies: unusedPolicies,
      broad_policies: broadPolicies,
      optimization_score: optimizationScore,
      recommendations,
      summary: {
        duplicate_count: duplicates.length,
        similar_count: similarPairs.length,
        unused_count: unusedPolicies.length,
        broad_count: broadPolicies.length,
        potential_savings: duplicates.length + unusedPolicies.length
      }
    };
  }

  /**
   * Normalize a policy for comparison
   */
  normalizePolicy(policy) {
    return {
      id: policy.policyid,
      name: policy.name || `Policy ${policy.policyid}`,
      action: (policy.action || 'accept').toLowerCase(),
      status: (policy.status || 'enable').toLowerCase(),
      srcintf: this.normalizeArray(policy.srcintf),
      dstintf: this.normalizeArray(policy.dstintf),
      srcaddr: this.normalizeArray(policy.srcaddr),
      dstaddr: this.normalizeArray(policy.dstaddr),
      service: this.normalizeArray(policy.service),
      schedule: (policy.schedule || 'always').toLowerCase(),
      nat: (policy.nat || 'disable').toLowerCase(),
      hits: policy.hit_count || 0,
      bytes: policy.bytes || 0,
      raw: policy
    };
  }

  /**
   * Normalize an array field (extract names)
   */
  normalizeArray(field) {
    if (!field) return [];
    if (Array.isArray(field)) {
      return field.map(item => typeof item === 'object' ? (item.name || item.q_origin_key) : item)
        .filter(Boolean);
    }
    return [];
  }

  /**
   * Find exact duplicate policies
   */
  findDuplicates(policies) {
    const duplicates = [];
    const signatureMap = new Map();

    for (const policy of policies) {
      const signature = this.getPolicySignature(policy);

      if (signatureMap.has(signature)) {
        duplicates.push({
          policy1: signatureMap.get(signature),
          policy2: policy,
          reason: 'Exact duplicate - all fields match'
        });
      } else {
        signatureMap.set(signature, policy);
      }
    }

    return duplicates;
  }

  /**
   * Generate a signature for duplicate detection
   */
  getPolicySignature(policy) {
    return JSON.stringify({
      srcintf: [...policy.srcintf].sort(),
      dstintf: [...policy.dstintf].sort(),
      srcaddr: [...policy.srcaddr].sort(),
      dstaddr: [...policy.dstaddr].sort(),
      service: [...policy.service].sort(),
      action: policy.action,
      schedule: policy.schedule,
      nat: policy.nat
    });
  }

  /**
   * Find similar policies (not exact duplicates but highly similar)
   */
  findSimilarPolicies(policies, threshold = 0.85) {
    const similarPairs = [];

    for (let i = 0; i < policies.length; i++) {
      for (let j = i + 1; j < policies.length; j++) {
        const similarity = this.calculateSimilarity(policies[i], policies[j]);

        if (similarity >= threshold && similarity < 1.0) {
          similarPairs.push({
            policy1: policies[i],
            policy2: policies[j],
            similarity: Math.round(similarity * 100),
            reason: this.getSimilarityReason(policies[i], policies[j], similarity)
          });
        }
      }
    }

    return similarPairs.sort((a, b) => b.similarity - a.similarity);
  }

  /**
   * Calculate similarity score between two policies
   */
  calculateSimilarity(policy1, policy2) {
    const weights = {
      srcintf: 0.15,
      dstintf: 0.15,
      srcaddr: 0.25,
      dstaddr: 0.25,
      service: 0.15,
      action: 0.05
    };

    let totalSimilarity = 0;

    // Compare each field
    totalSimilarity += this.setJaccardSimilarity(policy1.srcintf, policy2.srcintf) * weights.srcintf;
    totalSimilarity += this.setJaccardSimilarity(policy1.dstintf, policy2.dstintf) * weights.dstintf;
    totalSimilarity += this.setJaccardSimilarity(policy1.srcaddr, policy2.srcaddr) * weights.srcaddr;
    totalSimilarity += this.setJaccardSimilarity(policy1.dstaddr, policy2.dstaddr) * weights.dstaddr;
    totalSimilarity += this.setJaccardSimilarity(policy1.service, policy2.service) * weights.service;
    totalSimilarity += (policy1.action === policy2.action ? 1 : 0) * weights.action;

    return totalSimilarity;
  }

  /**
   * Calculate Jaccard similarity between two sets
   */
  setJaccardSimilarity(set1, set2) {
    const s1 = new Set(set1);
    const s2 = new Set(set2);

    const intersection = new Set([...s1].filter(x => s2.has(x)));
    const union = new Set([...s1, ...s2]);

    if (union.size === 0) return 0;
    return intersection.size / union.size;
  }

  /**
   * Get human-readable reason for similarity
   */
  getSimilarityReason(policy1, policy2, similarity) {
    const reasons = [];

    if (this.setJaccardSimilarity(policy1.srcaddr, policy2.srcaddr) > 0.8) {
      reasons.push('Similar source addresses');
    }
    if (this.setJaccardSimilarity(policy1.dstaddr, policy2.dstaddr) > 0.8) {
      reasons.push('Similar destination addresses');
    }
    if (this.setJaccardSimilarity(policy1.service, policy2.service) > 0.8) {
      reasons.push('Similar services');
    }
    if (policy1.action === policy2.action) {
      reasons.push('Same action');
    }

    return reasons.length > 0 ? reasons.join(', ') : 'Multiple overlapping criteria';
  }

  /**
   * Find unused policies (no hits)
   */
  findUnusedPolicies(policies) {
    return policies
      .filter(p => (p.hit_count || 0) === 0 && p.status === 'enable')
      .map(p => ({
        id: p.policyid,
        name: p.name || `Policy ${p.policyid}`,
        reason: 'No traffic hits recorded',
        recommendation: 'Consider disabling or removing if confirmed unused'
      }));
  }

  /**
   * Find overly broad policies (e.g., any-any rules)
   */
  findBroadPolicies(policies) {
    return policies
      .filter(p => this.isPolicyBroad(p))
      .map(p => ({
        id: p.policyid,
        name: p.name || `Policy ${p.policyid}`,
        reason: this.getBroadReason(p),
        risk_level: this.calculateBroadPolicyRisk(p)
      }));
  }

  /**
   * Check if a policy is overly broad
   */
  isPolicyBroad(policy) {
    const srcaddr = this.normalizeArray(policy.srcaddr);
    const dstaddr = this.normalizeArray(policy.dstaddr);
    const service = this.normalizeArray(policy.service);

    const hasAnySource = srcaddr.some(addr => this.anyAddressTokens.has(addr.toLowerCase()));
    const hasAnyDest = dstaddr.some(addr => this.anyAddressTokens.has(addr.toLowerCase()));
    const hasAnyService = service.some(svc => this.anyServiceTokens.has(svc));

    // Broad if at least 2 out of 3 are "any"
    const broadCount = [hasAnySource, hasAnyDest, hasAnyService].filter(Boolean).length;
    return broadCount >= 2;
  }

  /**
   * Get reason why policy is broad
   */
  getBroadReason(policy) {
    const reasons = [];
    const srcaddr = this.normalizeArray(policy.srcaddr);
    const dstaddr = this.normalizeArray(policy.dstaddr);
    const service = this.normalizeArray(policy.service);

    if (srcaddr.some(addr => this.anyAddressTokens.has(addr.toLowerCase()))) {
      reasons.push('Any source');
    }
    if (dstaddr.some(addr => this.anyAddressTokens.has(addr.toLowerCase()))) {
      reasons.push('Any destination');
    }
    if (service.some(svc => this.anyServiceTokens.has(svc))) {
      reasons.push('Any service');
    }

    return reasons.join(' + ');
  }

  /**
   * Calculate risk level for broad policies
   */
  calculateBroadPolicyRisk(policy) {
    const srcaddr = this.normalizeArray(policy.srcaddr);
    const dstaddr = this.normalizeArray(policy.dstaddr);
    const service = this.normalizeArray(policy.service);

    const hasAnySource = srcaddr.some(addr => this.anyAddressTokens.has(addr.toLowerCase()));
    const hasAnyDest = dstaddr.some(addr => this.anyAddressTokens.has(addr.toLowerCase()));
    const hasAnyService = service.some(svc => this.anyServiceTokens.has(svc));

    // All three are any = critical
    if (hasAnySource && hasAnyDest && hasAnyService) {
      return 'critical';
    }
    // Two are any = high
    const broadCount = [hasAnySource, hasAnyDest, hasAnyService].filter(Boolean).length;
    if (broadCount === 2) {
      return 'high';
    }
    return 'medium';
  }

  /**
   * Calculate overall optimization score (0-100)
   */
  calculateOptimizationScore(metrics) {
    const { total, duplicates, similar, unused, broad } = metrics;

    if (total === 0) return 100;

    // Deduct points for issues
    let score = 100;
    score -= (duplicates / total) * 20;  // Duplicates cost 20 points max
    score -= (similar / total) * 15;     // Similar policies cost 15 points max
    score -= (unused / total) * 25;      // Unused policies cost 25 points max
    score -= (broad / total) * 20;       // Broad policies cost 20 points max

    return Math.max(0, Math.round(score));
  }

  /**
   * Generate optimization recommendations
   */
  generateRecommendations(analysis) {
    const recommendations = [];

    // Duplicates
    if (analysis.duplicates.length > 0) {
      recommendations.push({
        priority: 'high',
        category: 'duplicates',
        title: `Found ${analysis.duplicates.length} duplicate policies`,
        description: 'Remove duplicate policies to simplify rule base and improve performance',
        action: 'Review and consolidate duplicate policies',
        potential_savings: `${analysis.duplicates.length} policies can be removed`
      });
    }

    // Similar policies
    if (analysis.similarPairs.length > 0) {
      recommendations.push({
        priority: 'medium',
        category: 'similar',
        title: `Found ${analysis.similarPairs.length} similar policy pairs`,
        description: 'Consider consolidating similar policies to reduce complexity',
        action: 'Review similar policies and merge where appropriate',
        potential_savings: `Up to ${Math.floor(analysis.similarPairs.length / 2)} policies could be consolidated`
      });
    }

    // Unused policies
    if (analysis.unusedPolicies.length > 0) {
      recommendations.push({
        priority: 'medium',
        category: 'unused',
        title: `Found ${analysis.unusedPolicies.length} unused policies`,
        description: 'Policies with zero traffic hits may be unnecessary',
        action: 'Disable or remove policies with no traffic',
        potential_savings: `${analysis.unusedPolicies.length} policies can be removed if confirmed unused`
      });
    }

    // Broad policies
    if (analysis.broadPolicies.length > 0) {
      const criticalCount = analysis.broadPolicies.filter(p => p.risk_level === 'critical').length;
      recommendations.push({
        priority: criticalCount > 0 ? 'high' : 'medium',
        category: 'security',
        title: `Found ${analysis.broadPolicies.length} overly broad policies`,
        description: 'Broad policies (any-any rules) pose security risks',
        action: 'Review and restrict broad policies to specific sources/destinations/services',
        critical_count: criticalCount
      });
    }

    // General optimization
    if (recommendations.length === 0) {
      recommendations.push({
        priority: 'low',
        category: 'optimization',
        title: 'Firewall policies are well-optimized',
        description: 'No critical optimization opportunities found',
        action: 'Continue regular policy reviews and monitoring'
      });
    }

    return recommendations;
  }
}

module.exports = { PolicyAnalyzer };
