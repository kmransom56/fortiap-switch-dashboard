#!/usr/bin/env node

/**
 * MCP Integration Setup Script
 * Helps integrate MCP server with FortiAP/Switch Dashboard
 */

const fs = require('fs');
const path = require('path');

class MCPIntegrationSetup {
    constructor() {
        this.dashboardPath = __dirname;
        this.mcpServerPath = path.join(__dirname, '../fortinet_mcp');
        this.backupPath = path.join(__dirname, 'backup');
    }

    async run() {
        console.log('🚀 Setting up MCP Integration for FortiAP/Switch Dashboard...\n');

        try {
            // Check prerequisites
            await this.checkPrerequisites();
            
            // Create backup
            await this.createBackup();
            
            // Update main HTML file
            await this.updateMainHTML();
            
            // Update package.json
            await this.updatePackageJson();
            
            // Create integration files
            await this.createIntegrationFiles();
            
            // Test integration
            await this.testIntegration();
            
            console.log('\n✅ MCP Integration setup completed successfully!');
            console.log('\nNext steps:');
            console.log('1. Start your dashboard: node server.js');
            console.log('2. Open the dashboard in your browser');
            console.log('3. Navigate to the "MCP Integration" tab');
            console.log('4. Click "Start MCP Server" to begin using MCP features');
            console.log('\n📖 See MCP_INTEGRATION_GUIDE.md for detailed usage instructions');
            
        } catch (error) {
            console.error('\n❌ Setup failed:', error.message);
            console.log('\n🔄 Restoring backup...');
            await this.restoreBackup();
            process.exit(1);
        }
    }

    async checkPrerequisites() {
        console.log('🔍 Checking prerequisites...');
        
        // Check if MCP server directory exists
        if (!fs.existsSync(this.mcpServerPath)) {
            throw new Error(`MCP server directory not found: ${this.mcpServerPath}`);
        }
        
        // Check if MCP server files exist
        const requiredFiles = [
            'fortinet_server.py',
            'config.py',
            'requirements.txt'
        ];
        
        for (const file of requiredFiles) {
            const filePath = path.join(this.mcpServerPath, file);
            if (!fs.existsSync(filePath)) {
                throw new Error(`Required MCP server file not found: ${file}`);
            }
        }
        
        // Check if virtual environment exists
        const venvPath = path.join(this.mcpServerPath, 'venv');
        if (!fs.existsSync(venvPath)) {
            console.log('⚠️  MCP server virtual environment not found. Please run setup.sh in the MCP server directory first.');
        }
        
        console.log('✅ Prerequisites check passed');
    }

    async createBackup() {
        console.log('💾 Creating backup...');
        
        if (!fs.existsSync(this.backupPath)) {
            fs.mkdirSync(this.backupPath, { recursive: true });
        }
        
        const filesToBackup = ['index.html', 'package.json'];
        
        for (const file of filesToBackup) {
            const sourcePath = path.join(this.dashboardPath, file);
            const backupPath = path.join(this.backupPath, file);
            
            if (fs.existsSync(sourcePath)) {
                fs.copyFileSync(sourcePath, backupPath);
                console.log(`   Backed up: ${file}`);
            }
        }
        
        console.log('✅ Backup created');
    }

    async updateMainHTML() {
        console.log('📝 Updating main HTML file...');
        
        const htmlPath = path.join(this.dashboardPath, 'index.html');
        
        if (!fs.existsSync(htmlPath)) {
            console.log('⚠️  index.html not found, skipping HTML update');
            return;
        }
        
        let htmlContent = fs.readFileSync(htmlPath, 'utf8');
        
        // Add MCP dashboard script
        if (!htmlContent.includes('mcp-dashboard.js')) {
            const scriptTag = '<script src="mcp-dashboard.js"></script>';
            htmlContent = htmlContent.replace('</body>', `    ${scriptTag}\n</body>`);
        }
        
        // Add MCP tab to navigation
        if (!htmlContent.includes('data-tab="mcp"')) {
            const mcpTab = '<button class="nav-tab" data-tab="mcp">MCP Integration</button>';
            htmlContent = htmlContent.replace(
                /(<button class="nav-tab"[^>]*>.*<\/button>\s*)+/,
                `$&${mcpTab}\n        `
            );
        }
        
        // Add MCP panel content
        if (!htmlContent.includes('id="mcpPanel"')) {
            const mcpPanelPath = path.join(this.dashboardPath, 'mcp-panel.html');
            if (fs.existsSync(mcpPanelPath)) {
                const mcpPanelContent = fs.readFileSync(mcpPanelPath, 'utf8');
                htmlContent = htmlContent.replace(
                    '</body>',
                    `    <!-- MCP Integration Panel -->\n    <div id="mcpTab" class="tab-content" style="display: none;">\n        ${mcpPanelContent}\n    </div>\n</body>`
                );
            }
        }
        
        fs.writeFileSync(htmlPath, htmlContent);
        console.log('✅ HTML file updated');
    }

    async updatePackageJson() {
        console.log('📦 Updating package.json...');
        
        const packagePath = path.join(this.dashboardPath, 'package.json');
        
        if (!fs.existsSync(packagePath)) {
            console.log('⚠️  package.json not found, skipping package update');
            return;
        }
        
        const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
        
        // Add MCP-related scripts
        if (!packageJson.scripts) {
            packageJson.scripts = {};
        }
        
        packageJson.scripts['mcp:start'] = 'node -e "require(\'./mcp-integration.js\').startMCPServer()"';
        packageJson.scripts['mcp:stop'] = 'node -e "require(\'./mcp-integration.js\').stopMCPServer()"';
        packageJson.scripts['mcp:test'] = 'node -e "require(\'./mcp-integration.js\').testMCPConnection()"';
        
        fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2));
        console.log('✅ package.json updated');
    }

    async createIntegrationFiles() {
        console.log('📁 Creating integration files...');
        
        // Check if integration files already exist
        const integrationFiles = [
            'mcp-integration.js',
            'mcp-dashboard.js',
            'mcp-panel.html'
        ];
        
        for (const file of integrationFiles) {
            const filePath = path.join(this.dashboardPath, file);
            if (fs.existsSync(filePath)) {
                console.log(`   ${file} already exists, skipping`);
            } else {
                console.log(`   ⚠️  ${file} not found - please ensure it was created`);
            }
        }
        
        console.log('✅ Integration files checked');
    }

    async testIntegration() {
        console.log('🧪 Testing integration...');
        
        // Test if server.js can be loaded
        try {
            const serverPath = path.join(this.dashboardPath, 'server.js');
            if (fs.existsSync(serverPath)) {
                // Basic syntax check
                const serverContent = fs.readFileSync(serverPath, 'utf8');
                if (serverContent.includes('MCPIntegration')) {
                    console.log('✅ MCP integration found in server.js');
                } else {
                    console.log('⚠️  MCP integration not found in server.js - please add it manually');
                }
            }
        } catch (error) {
            console.log('⚠️  Could not test server.js:', error.message);
        }
        
        console.log('✅ Integration test completed');
    }

    async restoreBackup() {
        console.log('🔄 Restoring backup...');
        
        if (!fs.existsSync(this.backupPath)) {
            console.log('⚠️  No backup found to restore');
            return;
        }
        
        const filesToRestore = ['index.html', 'package.json'];
        
        for (const file of filesToRestore) {
            const backupPath = path.join(this.backupPath, file);
            const targetPath = path.join(this.dashboardPath, file);
            
            if (fs.existsSync(backupPath)) {
                fs.copyFileSync(backupPath, targetPath);
                console.log(`   Restored: ${file}`);
            }
        }
        
        console.log('✅ Backup restored');
    }
}

// Run the setup
if (require.main === module) {
    const setup = new MCPIntegrationSetup();
    setup.run().catch(console.error);
}

module.exports = MCPIntegrationSetup;
