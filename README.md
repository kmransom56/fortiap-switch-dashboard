# FortiAP & FortiSwitch Dashboard

A comprehensive real-time monitoring and management platform for Fortinet infrastructure, providing unified visibility and advanced analytics for FortiAP wireless access points, FortiSwitch devices, and FortiGate security appliances.

## Features

### Core Monitoring
- **Real-time Monitoring**: Live data from FortiGate API with automatic fallback
- **Unified Dashboard**: Single-pane view of all FortiAP and FortiSwitch devices
- **Health Monitoring**: Automated alerting for device issues and performance degradation
- **Session Authentication**: Secure credential-based authentication with FortiGate
- **Certificate Management**: Automated CA-signed certificate installation tools
- **Responsive Design**: Mobile-friendly interface for monitoring on the go
- **Graceful Degradation**: YAML fallback data when FortiGate is unreachable

### Advanced Features (Option B: Full Integration)
- **Firewall Policy Analysis**: Comprehensive policy optimization and duplicate detection
- **Security Risk Assessment**: Multi-factor risk scoring with actionable recommendations
- **Policy Simulation Engine**: Test packet flows against firewall ruleset
- **Network Topology Visualization**: Auto-generated network diagrams with device relationships
- **Performance Monitoring**: CPU, memory, disk, and session tracking
- **VPN Status Tracking**: IPsec tunnels and SSL-VPN user monitoring
- **Threat Detection**: IPS and antivirus detection statistics

## Quick Start

### Prerequisites

- Node.js 18+ (for native fetch support)
- FortiGate with FortiAP and/or FortiSwitch devices
- Network connectivity to FortiGate management interface
- FortiGate administrator account with API access

### Installation

```bash
# Clone or download the repository
cd fortiap-switch-dashboard

# Install dependencies
npm install

# Create environment configuration
cp .env.example .env
```

### Configuration

Edit the `.env` file with your FortiGate details:

```bash
# FortiGate Connection
FGT_URL=https://192.168.0.254
ALLOW_SELF_SIGNED=true

# Authentication (Session-based - recommended)
FGT_USERNAME=admin
FGT_PASSWORD=your_password_here

# Server Configuration
PORT=59169
```

### Run the Dashboard

```bash
# Start the server
node server.js

# Access the dashboard
# Open your browser to: http://localhost:59169
```

## Architecture

### Components

```
fortiap-switch-dashboard/
├── server.js                    # Main Express server with all API endpoints
├── app.js                       # Core application with FortiGate integration
├── data-transformer.js          # Transforms FortiGate API data
├── fortinet-api-client.js       # Enhanced API client with retry logic
├── policy-analyzer.js           # Firewall policy analysis engine
├── network-topology.js          # Network topology generator
├── index.html                   # Main dashboard interface
├── generate-fortigate-cert.js   # Certificate generation from CA
├── install-fortigate-cert.sh    # Automated SSH certificate installation
├── automate-cert-install.js     # Automated API certificate installation
└── data/
    ├── fortiaps.yaml            # Fallback FortiAP data
    └── fortiswitches.yaml       # Fallback FortiSwitch data
```

### Data Flow

1. **Client Request** → Dashboard web interface
2. **Server API** → Express server (`server.js`)
3. **FortiGate API** → Fetches real-time data
4. **Data Transformer** → Normalizes API response
5. **Response** → JSON data to client
6. **Fallback** → YAML data if FortiGate unreachable

## Authentication

### Session-Based Authentication (Recommended)

The dashboard uses FortiGate session authentication by default:

- Automatically logs in when needed
- Handles session renewal
- Logs out gracefully on shutdown
- More secure than API tokens

Configuration:
```bash
FGT_USERNAME=admin
FGT_PASSWORD=your_password
```

### API Token Authentication (Alternative)

For environments requiring API tokens:

1. Create API token in FortiGate (System > Administrators)
2. Configure in `.env`:
   ```bash
   FGT_TOKEN=your_api_token_here
   #FGT_USERNAME=admin
   #FGT_PASSWORD=password
   ```

## Certificate Installation

For production deployments, install CA-signed certificates on FortiGate to eliminate certificate warnings and improve security.

### Automated Installation (Recommended)

```bash
# 1. Generate CA-signed certificate
node generate-fortigate-cert.js

# 2. Install via SSH (requires sshpass)
chmod +x install-fortigate-cert.sh
./install-fortigate-cert.sh

# 3. Update .env to use proper validation
# FGT_URL=https://fortigate.netintegrate.net:8443
# ALLOW_SELF_SIGNED=false
```

### Alternative Methods

- **API-based**: `node automate-cert-install.js`
- **Manual**: Follow GUI instructions in [REAL_DATA_SETUP.md](REAL_DATA_SETUP.md#installing-ca-signed-certificates-on-fortigate)

See [REAL_DATA_SETUP.md](REAL_DATA_SETUP.md) for complete certificate installation documentation.

## API Endpoints

### Core Dashboard Endpoints

| Endpoint | Method | Description | Authentication |
|----------|--------|-------------|----------------|
| `/` | GET | Dashboard UI | None |
| `/api/health` | GET | Health check | None |
| `/api/test` | GET | Test FortiGate connectivity | Required |
| `/api/overview` | GET | Complete dashboard data | Required |
| `/api/fortiaps` | GET | FortiAP data only | Required |
| `/api/fortiswitches` | GET | FortiSwitch data only | Required |
| `/api/fallback-overview` | GET | YAML fallback data | None |

### Enhanced Monitoring Endpoints

| Endpoint | Method | Description | Authentication |
|----------|--------|-------------|----------------|
| `/api/firewall/policies` | GET | Firewall rules and policies | Required |
| `/api/vpn/status` | GET | VPN tunnels and SSL-VPN users | Required |
| `/api/system/performance` | GET | CPU, memory, disk, sessions | Required |
| `/api/security/threats` | GET | IPS and antivirus detections | Required |
| `/api/client/stats` | GET | API client statistics | Required |

### Firewall Optimizer Endpoints

| Endpoint | Method | Description | Authentication |
|----------|--------|-------------|----------------|
| `/api/firewall/analysis` | GET | Policy analysis & optimization | Required |
| `/api/firewall/simulate` | POST | Packet simulation engine | Required |
| `/api/security/risk-assessment` | GET | Security risk scoring | Required |

### Network Topology Endpoints

| Endpoint | Method | Description | Authentication |
|----------|--------|-------------|----------------|
| `/api/network/topology` | GET | Generate network topology | Required |
| `/api/network/topology/export?format=json\|csv` | GET | Export topology data | Required |

## Dashboard Features

### FortiAP Monitoring

- Device status and connectivity
- Client counts and connection limits
- Wireless channel information and utilization
- RF metrics (signal strength, noise, interference)
- Temperature and hardware status
- Rogue AP detection

### FortiSwitch Monitoring

- Device status and FortiLink connectivity
- Port information and status
- PoE power budget and consumption
- System metrics (CPU, memory, temperature)
- Hardware status (fans, power supplies)
- VLAN and trunk port information

### System Health

- Automated alert generation
- Device offline detection
- High temperature warnings
- PoE utilization alerts
- Hardware failure notifications
- Summary statistics and trends

### Firewall Policy Analysis (NEW)

The policy analyzer provides comprehensive analysis of your firewall ruleset:

**Features:**
- **Duplicate Detection**: Identifies exact duplicate policies using signature-based comparison
- **Similarity Analysis**: Finds highly similar policies (>85% match) using Jaccard similarity coefficient
- **Unused Policy Detection**: Identifies policies with zero hit counts
- **Broad Policy Detection**: Flags overly permissive any-any rules with risk levels
- **Optimization Scoring**: Overall optimization score (0-100) with weighted deductions
- **Actionable Recommendations**: Prioritized recommendations (high/medium/low)

**Usage:**
```bash
curl http://localhost:59169/api/firewall/analysis
```

**Response:**
```json
{
  "total_policies": 50,
  "enabled_policies": 48,
  "duplicates": [...],
  "similar_pairs": [...],
  "unused_policies": [...],
  "broad_policies": [...],
  "optimization_score": 75,
  "recommendations": [...]
}
```

### Security Risk Assessment (NEW)

Multi-factor security risk analysis with detailed scoring:

**Risk Factors:**
- Duplicate policies (20 points max deduction)
- Similar/overlapping policies (15 points)
- Unused policies (25 points)
- Overly broad policies (20 points)

**Risk Levels:**
- **Low** (< 30): Well-optimized ruleset
- **Medium** (30-60): Some optimization opportunities
- **High** (60-80): Significant issues requiring attention
- **Critical** (> 80): Urgent security concerns

**Usage:**
```bash
curl http://localhost:59169/api/security/risk-assessment
```

### Policy Simulation Engine (NEW)

Test packet flows against your firewall ruleset:

**Usage:**
```bash
curl -X POST http://localhost:59169/api/firewall/simulate \
  -H "Content-Type: application/json" \
  -d '{
    "source_ip": "192.168.1.100",
    "destination_ip": "8.8.8.8",
    "destination_port": "443",
    "protocol": "tcp"
  }'
```

**Response:**
```json
{
  "simulation": {...},
  "matched_policy": {
    "id": 1,
    "name": "Allow Internet",
    "action": "accept",
    "nat": "enable"
  },
  "result": "accept",
  "evaluated_policies": 50
}
```

### Network Topology Visualization (NEW)

Auto-generate network topology diagrams from your FortiGate infrastructure:

**Features:**
- **Device Discovery**: Automatically discovers FortiGate, FortiAP, and FortiSwitch devices
- **Connection Inference**: Intelligently infers connections from:
  - FortiLink connections (FortiGate ↔ FortiSwitch)
  - CAPWAP tunnels (FortiGate ↔ FortiAP)
  - Firewall policies
- **Multiple Export Formats**: JSON and CSV formats
- **Graph Visualization Data**: Ready-to-use data for D3.js, Cytoscape.js, etc.
- **Visual Properties**: Color-coded by device type with status indicators

**Device Types:**
- **FortiGate**: Blue square (size: 30)
- **FortiSwitch**: Green rectangle (size: 20)
- **FortiAP**: Orange triangle (size: 18)

**Connection Types:**
- **FortiLink**: Green (width: 3) - Switch management
- **CAPWAP**: Green (width: 2) - AP control tunnel
- **Policy-Inferred**: Gray (width: 1) - Inferred from firewall policies

**Usage:**
```bash
# Get full topology with graph data
curl http://localhost:59169/api/network/topology

# Export as CSV
curl "http://localhost:59169/api/network/topology/export?format=csv"

# Export as JSON
curl "http://localhost:59169/api/network/topology/export?format=json"
```

**Response Structure:**
```json
{
  "success": true,
  "topology": {
    "devices": {
      "FW": { "name": "FW", "device_type": "FortiGate", ... },
      "AP": { "name": "AP", "device_type": "FortiAP", ... },
      "SW": { "name": "SW", "device_type": "FortiSwitch", ... }
    },
    "connections": [
      {
        "source_device": "FW",
        "target_device": "SW",
        "connection_type": "fortilink",
        "bandwidth": "10G",
        "status": "active"
      }
    ]
  },
  "statistics": {
    "total_devices": 4,
    "total_connections": 5,
    "device_types": { "FortiGate": 1, "FortiAP": 2, "FortiSwitch": 1 }
  },
  "graph": {
    "nodes": [...],
    "edges": [...]
  }
}
```

## Deployment

### Development

```bash
node server.js
```

### Production

#### Using PM2

```bash
# Install PM2
npm install -g pm2

# Start the dashboard
pm2 start server.js --name fortiap-dashboard

# Save configuration
pm2 save

# Setup auto-start on reboot
pm2 startup
```

#### Using systemd

Create `/etc/systemd/system/fortiap-dashboard.service`:

```ini
[Unit]
Description=FortiAP Switch Dashboard
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/fortiap-switch-dashboard
ExecStart=/usr/bin/node server.js
Restart=on-failure
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl enable fortiap-dashboard
sudo systemctl start fortiap-dashboard
```

### Reverse Proxy (nginx)

```nginx
server {
    listen 80;
    server_name dashboard.example.com;

    location / {
        proxy_pass http://localhost:59169;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## Security Considerations

1. **HTTPS**: Deploy behind HTTPS proxy (nginx/Apache)
2. **Firewall**: Restrict access to dashboard port
3. **Credentials**: Never commit `.env` file
4. **API Tokens**: Rotate regularly and use minimal permissions
5. **Network**: Isolate management network from production
6. **Certificates**: Use CA-signed certificates in production
7. **Updates**: Keep Node.js and dependencies updated

## Troubleshooting

### Connection Issues

**Problem**: Cannot connect to FortiGate
```
Error: Connection timeout: FortiGate API request timed out
```

**Solutions**:
- Verify FortiGate IP address in `FGT_URL`
- Check network connectivity: `ping 192.168.0.254`
- Ensure management interface is accessible
- Check firewall rules

### Authentication Issues

**Problem**: Login failed
```
Error: FortiGate request failed 401 Unauthorized
```

**Solutions**:
- Verify credentials in `.env`
- Check administrator permissions
- Ensure API access is enabled
- Verify trusted hosts configuration

### Certificate Issues

**Problem**: Certificate validation errors
```
Error: unable to verify the first certificate
```

**Solutions**:
- Set `ALLOW_SELF_SIGNED=true` (temporary)
- Install CA-signed certificates (recommended)
- See [Certificate Installation](#certificate-installation)

### No Data Displayed

**Problem**: Dashboard shows no devices

**Solutions**:
- Check API endpoint permissions
- Verify FortiAP/FortiSwitch devices are managed by FortiGate
- Test API: `curl http://localhost:59169/api/test`
- Check server logs for errors

## FortiGate Requirements

### API Endpoints Used

**Core Monitoring:**
- `/api/v2/monitor/wifi/managed_ap` - FortiAP data
- `/api/v2/monitor/switch-controller/managed-switch/status` - FortiSwitch data
- `/api/v2/monitor/system/status` - FortiGate system information

**Enhanced Monitoring:**
- `/api/v2/cmdb/firewall/policy` - Firewall policies (for analysis)
- `/api/v2/monitor/vpn/ipsec` - IPsec VPN tunnels
- `/api/v2/monitor/vpn/ssl` - SSL-VPN users
- `/api/v2/monitor/system/resource` - CPU, memory, disk
- `/api/v2/monitor/ips/session` - IPS statistics
- `/api/v2/monitor/antivirus/stats` - Antivirus statistics

### Required Permissions

- Read access to WiFi monitoring
- Read access to Switch monitoring
- Read access to Firewall configuration (for policy analysis)
- Read access to VPN monitoring
- Read access to System monitoring
- Read access to Security (IPS/AV) monitoring
- API access enabled
- Trusted hosts configured (if using IP restrictions)

### Network Requirements

- HTTPS access to FortiGate management interface
- Port 8443 (default) or configured management port
- DNS resolution (if using FQDN)

## Development

### Project Structure

- `server.js` - HTTP server with all API endpoints
- `app.js` - Core business logic and FortiGate API integration
- `data-transformer.js` - Data normalization and transformation
- `fortinet-api-client.js` - Enhanced API client with retry logic
- `policy-analyzer.js` - Firewall policy analysis engine
- `network-topology.js` - Network topology generator
- `index.html` - Frontend dashboard interface
- `data/` - YAML fallback data for testing and offline mode

### Adding New Features

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test with both real and fallback data
5. Submit a pull request

### Testing

```bash
# Test with fallback data
curl http://localhost:59169/api/fallback-overview

# Test FortiGate connectivity
curl http://localhost:59169/api/test

# Test real data
curl http://localhost:59169/api/overview
```

## Performance

- **Session Caching**: 30-minute session lifetime
- **Timeout Handling**: 5-second API timeouts
- **Graceful Fallback**: Automatic switch to YAML data
- **Efficient Polling**: Dashboard refreshes every 30 seconds
- **Minimal Dependencies**: Lightweight Express server

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Dependencies

- `express` - Web server framework
- `node-fetch` - HTTP client for FortiGate API
- `yaml` - YAML parsing for fallback data
- `dotenv` - Environment configuration

## License

ISC

## Contributing

Contributions are welcome! Please:

1. Test your changes thoroughly
2. Update documentation as needed
3. Follow existing code style
4. Add comments for complex logic

## Support

For issues or questions:

1. Check [REAL_DATA_SETUP.md](REAL_DATA_SETUP.md) for configuration help
2. Review server logs for error details
3. Verify FortiGate configuration and permissions
4. Test network connectivity

## Roadmap

- [ ] Multi-FortiGate support
- [ ] Historical data and trending
- [ ] Email/SMS alerting
- [ ] Custom dashboard layouts
- [ ] Export to CSV/PDF
- [ ] User authentication and RBAC
- [ ] Dark mode
- [ ] Mobile app

## Acknowledgments

Built for monitoring Fortinet infrastructure with love for network administrators.

## Links

- [FortiGate API Documentation](https://docs.fortinet.com/)
- [Express.js Documentation](https://expressjs.com/)
- [Node.js Documentation](https://nodejs.org/)
