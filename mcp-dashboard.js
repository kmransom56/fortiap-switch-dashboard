/**
 * MCP Dashboard Integration
 * Frontend JavaScript for MCP server integration with FortiAP/Switch Dashboard
 */

class MCPDashboard {
    constructor() {
        this.mcpStatus = null;
        this.mcpLogs = [];
        this.isConnected = false;
        this.refreshInterval = null;
        
        this.init();
    }

    async init() {
        this.setupEventListeners();
        await this.loadMCPStatus();
        this.renderMCPPanel();
        this.startStatusRefresh();
    }

    setupEventListeners() {
        // MCP Server Control Buttons
        document.getElementById('mcpStartBtn')?.addEventListener('click', () => this.startMCPServer());
        document.getElementById('mcpStopBtn')?.addEventListener('click', () => this.stopMCPServer());
        document.getElementById('mcpTestBtn')?.addEventListener('click', () => this.testMCPConnection());
        document.getElementById('mcpRefreshBtn')?.addEventListener('click', () => this.refreshMCPStatus());

        // MCP Tools and Prompts
        document.getElementById('mcpHealthCheckBtn')?.addEventListener('click', () => this.runHealthCheck());
        document.getElementById('mcpSecurityAnalysisBtn')?.addEventListener('click', () => this.runSecurityAnalysis());
        document.getElementById('mcpPerformanceAnalysisBtn')?.addEventListener('click', () => this.runPerformanceAnalysis());
        document.getElementById('mcpPolicyAnalysisBtn')?.addEventListener('click', () => this.runPolicyAnalysis());

        // Enhanced Topology
        document.getElementById('mcpEnhancedTopologyBtn')?.addEventListener('click', () => this.loadEnhancedTopology());
    }

    async loadMCPStatus() {
        try {
            const response = await fetch('/api/mcp/status');
            this.mcpStatus = await response.json();
            this.isConnected = this.mcpStatus.isRunning;
            this.updateMCPStatusDisplay();
        } catch (error) {
            console.error('Failed to load MCP status:', error);
            this.isConnected = false;
        }
    }

    async startMCPServer() {
        try {
            this.showLoading('Starting MCP Server...');
            const response = await fetch('/api/mcp/start', { method: 'POST' });
            const result = await response.json();
            
            if (result.success) {
                this.showSuccess('MCP Server started successfully');
                await this.loadMCPStatus();
            } else {
                this.showError(`Failed to start MCP Server: ${result.message}`);
            }
        } catch (error) {
            this.showError(`Error starting MCP Server: ${error.message}`);
        }
    }

    async stopMCPServer() {
        try {
            this.showLoading('Stopping MCP Server...');
            const response = await fetch('/api/mcp/stop', { method: 'POST' });
            const result = await response.json();
            
            if (result.success) {
                this.showSuccess('MCP Server stopped successfully');
                await this.loadMCPStatus();
            } else {
                this.showError(`Failed to stop MCP Server: ${result.message}`);
            }
        } catch (error) {
            this.showError(`Error stopping MCP Server: ${error.message}`);
        }
    }

    async testMCPConnection() {
        try {
            this.showLoading('Testing MCP connection...');
            const response = await fetch('/api/mcp/test');
            const result = await response.json();
            
            if (result.success) {
                this.showSuccess('MCP Server connection successful');
            } else {
                this.showError(`MCP connection failed: ${result.message}`);
            }
        } catch (error) {
            this.showError(`Error testing MCP connection: ${error.message}`);
        }
    }

    async refreshMCPStatus() {
        await this.loadMCPStatus();
        await this.loadMCPLogs();
    }

    async loadMCPLogs() {
        try {
            const response = await fetch('/api/mcp/logs?limit=20');
            const result = await response.json();
            
            if (result.success) {
                this.mcpLogs = result.logs;
                this.renderMCPLogs();
            }
        } catch (error) {
            console.error('Failed to load MCP logs:', error);
        }
    }

    async runHealthCheck() {
        try {
            this.showLoading('Running network health check...');
            const response = await fetch('/api/mcp/prompts/network_health_check_prompt', { method: 'POST' });
            const result = await response.json();
            
            if (result.success) {
                this.showMCPResult('Network Health Check', result.data);
            } else {
                this.showError(`Health check failed: ${result.message}`);
            }
        } catch (error) {
            this.showError(`Error running health check: ${error.message}`);
        }
    }

    async runSecurityAnalysis() {
        try {
            this.showLoading('Running security analysis...');
            const response = await fetch('/api/security/analysis/enhanced');
            const result = await response.json();
            
            if (result.success) {
                this.showMCPResult('Security Analysis', result.data);
            } else {
                this.showError(`Security analysis failed: ${result.message}`);
            }
        } catch (error) {
            this.showError(`Error running security analysis: ${error.message}`);
        }
    }

    async runPerformanceAnalysis() {
        try {
            this.showLoading('Running performance analysis...');
            const response = await fetch('/api/performance/analysis/enhanced');
            const result = await response.json();
            
            if (result.success) {
                this.showMCPResult('Performance Analysis', result.data);
            } else {
                this.showError(`Performance analysis failed: ${result.message}`);
            }
        } catch (error) {
            this.showError(`Error running performance analysis: ${error.message}`);
        }
    }

    async runPolicyAnalysis() {
        try {
            this.showLoading('Running policy analysis...');
            const response = await fetch('/api/firewall/analysis/enhanced');
            const result = await response.json();
            
            if (result.success) {
                this.showMCPResult('Policy Analysis', result.data);
            } else {
                this.showError(`Policy analysis failed: ${result.message}`);
            }
        } catch (error) {
            this.showError(`Error running policy analysis: ${error.message}`);
        }
    }

    async loadEnhancedTopology() {
        try {
            this.showLoading('Loading enhanced topology...');
            const response = await fetch('/api/network/topology/enhanced');
            const result = await response.json();
            
            if (result.success) {
                this.showMCPResult('Enhanced Network Topology', result.data);
                // You can also integrate this with your existing topology visualization
                this.updateTopologyVisualization(result.data);
            } else {
                this.showError(`Enhanced topology failed: ${result.message}`);
            }
        } catch (error) {
            this.showError(`Error loading enhanced topology: ${error.message}`);
        }
    }

    updateMCPStatusDisplay() {
        const statusElement = document.getElementById('mcpStatus');
        const statusIndicator = document.getElementById('mcpStatusIndicator');
        const startBtn = document.getElementById('mcpStartBtn');
        const stopBtn = document.getElementById('mcpStopBtn');

        if (statusElement) {
            statusElement.textContent = this.isConnected ? 'Connected' : 'Disconnected';
            statusElement.className = this.isConnected ? 'status-connected' : 'status-disconnected';
        }

        if (statusIndicator) {
            statusIndicator.className = this.isConnected ? 'indicator-green' : 'indicator-red';
        }

        if (startBtn) {
            startBtn.disabled = this.isConnected;
        }

        if (stopBtn) {
            stopBtn.disabled = !this.isConnected;
        }

        // Update uptime if connected
        if (this.isConnected && this.mcpStatus) {
            const uptimeElement = document.getElementById('mcpUptime');
            if (uptimeElement && this.mcpStatus.uptime) {
                const uptime = this.formatUptime(this.mcpStatus.uptime);
                uptimeElement.textContent = uptime;
            }
        }
    }

    renderMCPLogs() {
        const logsContainer = document.getElementById('mcpLogs');
        if (!logsContainer) return;

        logsContainer.innerHTML = '';
        
        this.mcpLogs.slice(-10).forEach(log => {
            const logElement = document.createElement('div');
            logElement.className = `log-entry log-${log.level.toLowerCase()}`;
            logElement.innerHTML = `
                <span class="log-time">${new Date(log.timestamp).toLocaleTimeString()}</span>
                <span class="log-level">${log.level}</span>
                <span class="log-message">${log.message}</span>
            `;
            logsContainer.appendChild(logElement);
        });
    }

    renderMCPPanel() {
        // This will be called to render the MCP panel in the dashboard
        // The HTML structure should be added to your main dashboard HTML
    }

    showMCPResult(title, data) {
        const modal = document.createElement('div');
        modal.className = 'mcp-result-modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>${title}</h3>
                    <button class="close-btn" onclick="this.parentElement.parentElement.parentElement.remove()">&times;</button>
                </div>
                <div class="modal-body">
                    <pre>${JSON.stringify(data, null, 2)}</pre>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    showLoading(message) {
        // Show loading indicator
        const loadingElement = document.getElementById('mcpLoading');
        if (loadingElement) {
            loadingElement.textContent = message;
            loadingElement.style.display = 'block';
        }
    }

    showSuccess(message) {
        this.hideLoading();
        this.showNotification(message, 'success');
    }

    showError(message) {
        this.hideLoading();
        this.showNotification(message, 'error');
    }

    hideLoading() {
        const loadingElement = document.getElementById('mcpLoading');
        if (loadingElement) {
            loadingElement.style.display = 'none';
        }
    }

    showNotification(message, type) {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        document.body.appendChild(notification);

        setTimeout(() => {
            notification.remove();
        }, 5000);
    }

    formatUptime(ms) {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        
        if (hours > 0) {
            return `${hours}h ${minutes % 60}m`;
        } else if (minutes > 0) {
            return `${minutes}m ${seconds % 60}s`;
        } else {
            return `${seconds}s`;
        }
    }

    updateTopologyVisualization(data) {
        // Integrate with your existing topology visualization
        // This is a placeholder - you'll need to adapt this to your specific topology implementation
        console.log('Enhanced topology data:', data);
    }

    startStatusRefresh() {
        // Refresh MCP status every 30 seconds
        this.refreshInterval = setInterval(() => {
            this.loadMCPStatus();
        }, 30000);
    }

    stopStatusRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
    }
}

// Initialize MCP Dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.mcpDashboard = new MCPDashboard();
});
