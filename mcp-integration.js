/**
 * MCP Server Integration Module
 * Integrates Fortinet MCP Server with the FortiAP/Switch Dashboard
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

class MCPIntegration {
    constructor() {
        this.mcpServerProcess = null;
        this.mcpServerPath = path.join(__dirname, '../fortinet_mcp');
        this.isRunning = false;
        this.port = 8000; // MCP server port
        this.logs = [];
        this.maxLogs = 100;
    }

    /**
     * Start the MCP server
     */
    async startMCPServer() {
        if (this.isRunning) {
            console.log('MCP Server is already running');
            return { success: true, message: 'MCP Server already running' };
        }

        try {
            // Check if MCP server directory exists
            if (!fs.existsSync(this.mcpServerPath)) {
                throw new Error(`MCP server directory not found: ${this.mcpServerPath}`);
            }

            // Check if virtual environment exists
            const venvPath = path.join(this.mcpServerPath, 'venv');
            if (!fs.existsSync(venvPath)) {
                throw new Error(`MCP server virtual environment not found: ${venvPath}`);
            }

            // Start the MCP server
            const pythonPath = path.join(venvPath, 'bin', 'python');
            const serverPath = path.join(this.mcpServerPath, 'fortinet_server.py');

            this.mcpServerProcess = spawn(pythonPath, [serverPath], {
                cwd: this.mcpServerPath,
                stdio: ['pipe', 'pipe', 'pipe'],
                env: {
                    ...process.env,
                    FORTIGATE_HOST: process.env.FGT_URL?.replace('https://', '').replace('http://', '') || '192.168.0.254',
                    FORTIGATE_PORT: '8443',
                    FORTIGATE_USERNAME: process.env.FGT_USERNAME || 'admin',
                    FORTIGATE_PASSWORD: process.env.FGT_PASSWORD || '',
                    FORTIGATE_API_TOKEN: process.env.FGT_TOKEN || '',
                    VERIFY_SSL: process.env.ALLOW_SELF_SIGNED === 'true' ? 'false' : 'true'
                }
            });

            this.mcpServerProcess.stdout.on('data', (data) => {
                const message = data.toString().trim();
                this.addLog('INFO', message);
                console.log(`MCP Server: ${message}`);
            });

            this.mcpServerProcess.stderr.on('data', (data) => {
                const message = data.toString().trim();
                this.addLog('ERROR', message);
                console.error(`MCP Server Error: ${message}`);
            });

            this.mcpServerProcess.on('close', (code) => {
                this.isRunning = false;
                this.addLog('INFO', `MCP Server process exited with code ${code}`);
                console.log(`MCP Server process exited with code ${code}`);
            });

            this.mcpServerProcess.on('error', (error) => {
                this.isRunning = false;
                this.addLog('ERROR', `MCP Server process error: ${error.message}`);
                console.error(`MCP Server process error: ${error.message}`);
            });

            // Wait a moment for the server to start
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Check if server is running
            if (this.mcpServerProcess && !this.mcpServerProcess.killed) {
                this.isRunning = true;
                this.addLog('INFO', 'MCP Server started successfully');
                return { success: true, message: 'MCP Server started successfully' };
            } else {
                throw new Error('Failed to start MCP Server');
            }

        } catch (error) {
            this.addLog('ERROR', `Failed to start MCP Server: ${error.message}`);
            return { success: false, message: error.message };
        }
    }

    /**
     * Stop the MCP server
     */
    async stopMCPServer() {
        if (!this.isRunning || !this.mcpServerProcess) {
            return { success: true, message: 'MCP Server is not running' };
        }

        try {
            this.mcpServerProcess.kill('SIGTERM');
            
            // Wait for graceful shutdown
            await new Promise((resolve) => {
                const timeout = setTimeout(() => {
                    if (this.mcpServerProcess && !this.mcpServerProcess.killed) {
                        this.mcpServerProcess.kill('SIGKILL');
                    }
                    resolve();
                }, 5000);

                this.mcpServerProcess.on('close', () => {
                    clearTimeout(timeout);
                    resolve();
                });
            });

            this.isRunning = false;
            this.addLog('INFO', 'MCP Server stopped successfully');
            return { success: true, message: 'MCP Server stopped successfully' };

        } catch (error) {
            this.addLog('ERROR', `Failed to stop MCP Server: ${error.message}`);
            return { success: false, message: error.message };
        }
    }

    /**
     * Get MCP server status
     */
    getMCPStatus() {
        return {
            isRunning: this.isRunning,
            port: this.port,
            logs: this.logs.slice(-10), // Last 10 logs
            uptime: this.isRunning ? Date.now() - this.startTime : 0
        };
    }

    /**
     * Get MCP server logs
     */
    getMCPLogs(limit = 50) {
        return this.logs.slice(-limit);
    }

    /**
     * Add log entry
     */
    addLog(level, message) {
        const logEntry = {
            timestamp: new Date().toISOString(),
            level: level,
            message: message
        };
        
        this.logs.push(logEntry);
        
        // Keep only the last maxLogs entries
        if (this.logs.length > this.maxLogs) {
            this.logs = this.logs.slice(-this.maxLogs);
        }
    }

    /**
     * Test MCP server connection
     */
    async testMCPConnection() {
        try {
            const response = await fetch(`http://localhost:${this.port}/health`);
            if (response.ok) {
                return { success: true, message: 'MCP Server is responding' };
            } else {
                return { success: false, message: `MCP Server returned status: ${response.status}` };
            }
        } catch (error) {
            return { success: false, message: `MCP Server connection failed: ${error.message}` };
        }
    }

    /**
     * Get MCP server resources
     */
    async getMCPResources() {
        try {
            const response = await fetch(`http://localhost:${this.port}/api/resources`);
            if (response.ok) {
                const data = await response.json();
                return { success: true, data: data };
            } else {
                return { success: false, message: `Failed to get resources: ${response.status}` };
            }
        } catch (error) {
            return { success: false, message: `Failed to get resources: ${error.message}` };
        }
    }

    /**
     * Get MCP server tools
     */
    async getMCPTools() {
        try {
            const response = await fetch(`http://localhost:${this.port}/api/tools`);
            if (response.ok) {
                const data = await response.json();
                return { success: true, data: data };
            } else {
                return { success: false, message: `Failed to get tools: ${response.status}` };
            }
        } catch (error) {
            return { success: false, message: `Failed to get tools: ${error.message}` };
        }
    }

    /**
     * Execute MCP tool
     */
    async executeMCPTool(toolName, parameters = {}) {
        try {
            const response = await fetch(`http://localhost:${this.port}/api/tools/${toolName}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(parameters)
            });

            if (response.ok) {
                const data = await response.json();
                return { success: true, data: data };
            } else {
                return { success: false, message: `Tool execution failed: ${response.status}` };
            }
        } catch (error) {
            return { success: false, message: `Tool execution failed: ${error.message}` };
        }
    }

    /**
     * Get MCP server prompts
     */
    async getMCPPrompts() {
        try {
            const response = await fetch(`http://localhost:${this.port}/api/prompts`);
            if (response.ok) {
                const data = await response.json();
                return { success: true, data: data };
            } else {
                return { success: false, message: `Failed to get prompts: ${response.status}` };
            }
        } catch (error) {
            return { success: false, message: `Failed to get prompts: ${error.message}` };
        }
    }

    /**
     * Execute MCP prompt
     */
    async executeMCPPrompt(promptName, parameters = {}) {
        try {
            const response = await fetch(`http://localhost:${this.port}/api/prompts/${promptName}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(parameters)
            });

            if (response.ok) {
                const data = await response.json();
                return { success: true, data: data };
            } else {
                return { success: false, message: `Prompt execution failed: ${response.status}` };
            }
        } catch (error) {
            return { success: false, message: `Prompt execution failed: ${error.message}` };
        }
    }

    /**
     * Get enhanced network topology using MCP
     */
    async getEnhancedTopology() {
        try {
            // Use MCP network health check prompt for enhanced topology
            const result = await this.executeMCPPrompt('network_health_check_prompt');
            
            if (result.success) {
                return {
                    success: true,
                    data: result.data,
                    enhanced: true,
                    source: 'MCP'
                };
            } else {
                // Fallback to regular topology
                return {
                    success: false,
                    message: result.message,
                    enhanced: false,
                    source: 'fallback'
                };
            }
        } catch (error) {
            return {
                success: false,
                message: error.message,
                enhanced: false,
                source: 'error'
            };
        }
    }

    /**
     * Get security analysis using MCP
     */
    async getSecurityAnalysis() {
        try {
            const result = await this.executeMCPTool('get_security_profile_status');
            
            if (result.success) {
                return {
                    success: true,
                    data: result.data,
                    enhanced: true,
                    source: 'MCP'
                };
            } else {
                return {
                    success: false,
                    message: result.message,
                    enhanced: false,
                    source: 'fallback'
                };
            }
        } catch (error) {
            return {
                success: false,
                message: error.message,
                enhanced: false,
                source: 'error'
            };
        }
    }

    /**
     * Get performance analysis using MCP
     */
    async getPerformanceAnalysis() {
        try {
            const result = await this.executeMCPTool('analyze_system_performance');
            
            if (result.success) {
                return {
                    success: true,
                    data: result.data,
                    enhanced: true,
                    source: 'MCP'
                };
            } else {
                return {
                    success: false,
                    message: result.message,
                    enhanced: false,
                    source: 'fallback'
                };
            }
        } catch (error) {
            return {
                success: false,
                message: error.message,
                enhanced: false,
                source: 'error'
            };
        }
    }

    /**
     * Get policy analysis using MCP
     */
    async getPolicyAnalysis() {
        try {
            const result = await this.executeMCPPrompt('policy_optimization_prompt');
            
            if (result.success) {
                return {
                    success: true,
                    data: result.data,
                    enhanced: true,
                    source: 'MCP'
                };
            } else {
                return {
                    success: false,
                    message: result.message,
                    enhanced: false,
                    source: 'fallback'
                };
            }
        } catch (error) {
            return {
                success: false,
                message: error.message,
                enhanced: false,
                source: 'error'
            };
        }
    }
}

module.exports = MCPIntegration;
