# MCP Server Integration Guide for FortiAP/Switch Dashboard

This guide explains how to integrate the Fortinet MCP Server with your FortiAP/Switch Dashboard application.

## 🎯 Overview

The MCP (Model Context Protocol) integration brings advanced AI-powered network analysis capabilities to your dashboard, including:

- **Enhanced Network Topology**: AI-generated network diagrams with intelligent device relationships
- **Advanced Security Analysis**: Comprehensive security posture assessment
- **Performance Optimization**: AI-driven performance analysis and recommendations
- **Policy Analysis**: Intelligent firewall policy optimization suggestions
- **Automated Health Checks**: Comprehensive network health assessments

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                FortiAP/Switch Dashboard                    │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────┐ │
│  │   Dashboard UI  │  │   MCP Panel     │  │   Enhanced  │ │
│  │                 │  │                 │  │   Features  │ │
│  └─────────────────┘  └─────────────────┘  └─────────────┘ │
│           │                     │                     │     │
│           └─────────────────────┼─────────────────────┘     │
│                                 │                           │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │              Dashboard Server (server.js)              │ │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐ │ │
│  │  │   Regular   │  │   MCP       │  │   Enhanced      │ │ │
│  │  │   API       │  │   Endpoints │  │   Endpoints     │ │ │
│  │  │   Endpoints │  │             │  │                 │ │ │
│  │  └─────────────┘  └─────────────┘  └─────────────────┘ │ │
│  └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────┐
│                Fortinet MCP Server                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │   Resources │  │    Tools    │  │      Prompts        │ │
│  │             │  │             │  │                     │ │
│  │ • System    │  │ • Interface │  │ • Health Check      │ │
│  │ • Firewall  │  │ • Security  │  │ • Security Analysis │ │
│  │ • VPN       │  │ • Performance│  │ • Policy Optimization│ │
│  │ • Logs      │  │ • Traffic   │  │                     │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────┐
│                Fortinet Devices                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │  FortiGate  │  │ FortiManager│  │   FortiAnalyzer     │ │
│  │             │  │             │  │                     │ │
│  │ • FortiAP   │  │ • Policies  │  │ • Logs              │ │
│  │ • FortiSwitch│  │ • Devices   │  │ • Reports           │ │
│  │ • VPN       │  │ • Monitoring│  │ • Analytics         │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## 🚀 Installation & Setup

### Prerequisites

1. **FortiAP/Switch Dashboard** - Your existing dashboard application
2. **Fortinet MCP Server** - Located at `../fortinet_mcp/`
3. **Node.js 18+** - For the dashboard server
4. **Python 3.8+** - For the MCP server

### Step 1: Install MCP Integration Files

The following files have been added to your dashboard:

```
fortiap-switch-dashboard/
├── mcp-integration.js          # MCP server integration module
├── mcp-dashboard.js            # Frontend MCP dashboard
├── mcp-panel.html              # MCP panel HTML structure
└── MCP_INTEGRATION_GUIDE.md    # This guide
```

### Step 2: Update Dashboard HTML

Add the MCP panel to your main dashboard HTML file:

```html
<!-- Add to your main dashboard HTML file -->
<script src="mcp-dashboard.js"></script>

<!-- Add the MCP panel to your dashboard layout -->
<div id="mcpTab" class="tab-content">
    <!-- Include the MCP panel HTML -->
    <div id="mcpPanelContainer">
        <!-- Content from mcp-panel.html goes here -->
    </div>
</div>
```

### Step 3: Add MCP Tab to Navigation

Add a new tab for MCP integration in your dashboard navigation:

```html
<nav class="nav-tabs">
    <button class="nav-tab" data-tab="overview">Overview</button>
    <button class="nav-tab" data-tab="fortiaps">FortiAPs</button>
    <button class="nav-tab" data-tab="fortiswitches">FortiSwitches</button>
    <button class="nav-tab" data-tab="topology">Topology</button>
    <button class="nav-tab" data-tab="mcp">MCP Integration</button>
</nav>
```

### Step 4: Configure Environment Variables

Update your `.env` file to include MCP server configuration:

```bash
# Existing FortiGate configuration
FGT_URL=https://192.168.0.254
FGT_USERNAME=admin
FGT_PASSWORD=your_password
FGT_TOKEN=your_api_token
ALLOW_SELF_SIGNED=true
PORT=59169

# MCP Server configuration (optional - will use FortiGate settings)
MCP_SERVER_PATH=../fortinet_mcp
MCP_SERVER_PORT=8000
```

## 🔧 Configuration

### MCP Server Path

The integration automatically looks for the MCP server at `../fortinet_mcp/`. If your MCP server is in a different location, update the path in `mcp-integration.js`:

```javascript
// In mcp-integration.js, line 8
this.mcpServerPath = path.join(__dirname, '../fortinet_mcp');
```

### Environment Variables

The MCP integration automatically uses your existing FortiGate configuration:

- `FGT_URL` → `FORTIGATE_HOST`
- `FGT_USERNAME` → `FORTIGATE_USERNAME`
- `FGT_PASSWORD` → `FORTIGATE_PASSWORD`
- `FGT_TOKEN` → `FORTIGATE_API_TOKEN`
- `ALLOW_SELF_SIGNED` → `VERIFY_SSL`

## 📡 API Endpoints

### MCP Server Management

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/mcp/start` | POST | Start MCP server |
| `/api/mcp/stop` | POST | Stop MCP server |
| `/api/mcp/status` | GET | Get MCP server status |
| `/api/mcp/logs` | GET | Get MCP server logs |
| `/api/mcp/test` | GET | Test MCP server connection |

### MCP Resources and Tools

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/mcp/resources` | GET | Get available MCP resources |
| `/api/mcp/tools` | GET | Get available MCP tools |
| `/api/mcp/tools/:toolName` | POST | Execute MCP tool |
| `/api/mcp/prompts` | GET | Get available MCP prompts |
| `/api/mcp/prompts/:promptName` | POST | Execute MCP prompt |

### Enhanced Dashboard Features

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/network/topology/enhanced` | GET | Enhanced network topology |
| `/api/security/analysis/enhanced` | GET | Enhanced security analysis |
| `/api/performance/analysis/enhanced` | GET | Enhanced performance analysis |
| `/api/firewall/analysis/enhanced` | GET | Enhanced policy analysis |

## 🎨 UI Components

### MCP Panel Features

1. **Server Status**: Real-time MCP server status and uptime
2. **Server Controls**: Start/stop/test MCP server
3. **Tools & Prompts**: Access to MCP tools and prompts
4. **Logs**: Real-time MCP server logs
5. **Enhanced Features**: AI-powered analysis tools

### Integration with Existing Dashboard

The MCP integration enhances your existing dashboard features:

- **Network Topology**: Enhanced with AI-generated insights
- **Security Analysis**: Advanced threat assessment
- **Performance Monitoring**: AI-driven optimization recommendations
- **Policy Management**: Intelligent policy optimization

## 🔄 Usage Workflow

### 1. Start the Dashboard

```bash
cd fortiap-switch-dashboard
node server.js
```

### 2. Access MCP Integration

1. Open your dashboard in a browser
2. Navigate to the "MCP Integration" tab
3. Click "Start MCP Server" to initialize the MCP server
4. Wait for the status to show "Connected"

### 3. Use Enhanced Features

- **Network Health Check**: Click "Network Health Check" for comprehensive analysis
- **Security Analysis**: Click "Security Analysis" for advanced threat assessment
- **Performance Analysis**: Click "Performance Analysis" for optimization insights
- **Policy Analysis**: Click "Policy Analysis" for policy optimization
- **Enhanced Topology**: Click "Enhanced Topology" for AI-generated network diagrams

## 🛠️ Development

### Adding New MCP Tools

To add new MCP tools to the dashboard:

1. **Add the tool to MCP server** (in `fortinet_mcp/fortinet_server.py`)
2. **Add endpoint to dashboard** (in `server.js`)
3. **Add UI button** (in `mcp-panel.html`)
4. **Add JavaScript handler** (in `mcp-dashboard.js`)

Example:

```javascript
// In mcp-dashboard.js
async runCustomTool() {
    try {
        const response = await fetch('/api/mcp/tools/custom_tool', { method: 'POST' });
        const result = await response.json();
        this.showMCPResult('Custom Tool', result.data);
    } catch (error) {
        this.showError(`Error: ${error.message}`);
    }
}
```

### Customizing MCP Integration

You can customize the MCP integration by:

1. **Modifying the MCP server path** in `mcp-integration.js`
2. **Adding custom environment variables** for MCP configuration
3. **Creating custom UI components** for specific MCP features
4. **Integrating MCP results** with your existing dashboard visualizations

## 🚨 Troubleshooting

### Common Issues

1. **MCP Server Not Starting**
   - Check if the MCP server directory exists
   - Verify Python virtual environment is set up
   - Check MCP server logs for errors

2. **Connection Failed**
   - Verify FortiGate credentials in `.env`
   - Check network connectivity to FortiGate
   - Ensure FortiGate API is enabled

3. **Tools Not Working**
   - Check MCP server status
   - Verify tool parameters
   - Review MCP server logs

### Debug Mode

Enable debug logging by setting environment variable:

```bash
DEBUG=mcp:*
node server.js
```

### Logs

Check MCP server logs in the dashboard:
1. Go to MCP Integration tab
2. Scroll to "MCP Server Logs" section
3. Review recent log entries

## 📊 Performance Considerations

### Resource Usage

- **MCP Server**: ~50-100MB RAM, minimal CPU when idle
- **Dashboard**: No significant additional overhead
- **Network**: Additional API calls to FortiGate (minimal impact)

### Optimization Tips

1. **Start MCP server only when needed**
2. **Use caching for frequently accessed data**
3. **Limit log retention** to prevent memory issues
4. **Monitor MCP server performance** through logs

## 🔒 Security Considerations

### Credential Management

- MCP server uses the same credentials as your dashboard
- Credentials are passed through environment variables
- No additional credential storage required

### Network Security

- MCP server runs locally (localhost:8000)
- No external network exposure
- Uses existing FortiGate API security

### Access Control

- MCP integration inherits dashboard access controls
- No additional authentication required
- Same security model as existing dashboard

## 🚀 Advanced Features

### Custom MCP Prompts

Create custom MCP prompts for specific use cases:

```python
# In fortinet_mcp/fortinet_server.py
@mcp.prompt()
async def custom_analysis_prompt(device_type: str) -> str:
    """Custom analysis for specific device type."""
    # Your custom analysis logic here
    return analysis_result
```

### Integration with Existing Features

Enhance your existing dashboard features with MCP:

```javascript
// Enhance existing topology with MCP data
async function loadEnhancedTopology() {
    const regularTopology = await fetch('/api/network/topology');
    const mcpTopology = await fetch('/api/network/topology/enhanced');
    
    // Merge and enhance the topology data
    const enhancedData = mergeTopologyData(regularTopology, mcpTopology);
    renderTopology(enhancedData);
}
```

## 📈 Future Enhancements

### Planned Features

- **Real-time MCP monitoring** with WebSocket integration
- **Custom MCP tool creation** through the dashboard UI
- **MCP result visualization** with interactive charts
- **Automated MCP workflows** for routine tasks
- **Multi-device MCP support** for complex environments

### Contributing

To contribute to the MCP integration:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📞 Support

For issues or questions:

1. Check the troubleshooting section
2. Review MCP server logs
3. Verify FortiGate connectivity
4. Check dashboard server logs

## 🎉 Conclusion

The MCP integration brings powerful AI-driven network analysis capabilities to your FortiAP/Switch Dashboard. With minimal setup and configuration, you can now access advanced network insights, security analysis, and performance optimization recommendations directly from your dashboard interface.

The integration is designed to be:
- **Easy to use**: Simple UI with one-click access to MCP features
- **Non-intrusive**: Works alongside your existing dashboard features
- **Extensible**: Easy to add new MCP tools and capabilities
- **Secure**: Uses existing authentication and security models

Start exploring the enhanced capabilities of your network infrastructure today!
