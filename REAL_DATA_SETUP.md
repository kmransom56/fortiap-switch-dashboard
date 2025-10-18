# FortiAP Switch Dashboard - Real Data Setup Guide

Your FortiAP Switch Dashboard is now configured to load real data from FortiGate devices. This guide explains how to connect it to your actual FortiGate infrastructure.

## Current Status

✅ **Dashboard Working**: The dashboard is currently using fallback YAML data  
✅ **Session Authentication**: Configured for secure session-based authentication  
✅ **Data Transformation**: Real FortiGate API responses will be automatically transformed  
✅ **Graceful Fallback**: Falls back to YAML data when FortiGate is unreachable  

## Configuration

### Environment Variables (.env file)

The dashboard supports both session-based authentication (recommended) and API token authentication:

```bash
# FortiGate Connection
FGT_URL=https://192.168.0.254
ALLOW_SELF_SIGNED=true

# Session-based authentication (RECOMMENDED)
FGT_USERNAME=admin
FGT_PASSWORD=your_password_here

# API token authentication (alternative)
#FGT_TOKEN=your_api_token_here

PORT=59169
```

### Session-Based Authentication (Recommended)

Session authentication is more secure and follows FortiGate best practices:

1. **Set credentials in .env**:
   ```bash
   FGT_USERNAME=admin
   FGT_PASSWORD=your_fortigate_password
   ```

2. **The system will**:
   - Automatically login when needed
   - Handle session renewal
   - Logout gracefully on shutdown

### API Token Authentication (Alternative)

If you prefer API tokens:

1. **Create API token in FortiGate**:
   - Go to System > Administrators
   - Create a new administrator with API access
   - Generate an API token

2. **Configure in .env**:
   ```bash
   FGT_TOKEN=your_generated_api_token
   # Comment out username/password when using tokens
   #FGT_USERNAME=admin
   #FGT_PASSWORD=password
   ```

## FortiGate API Requirements

### Required API Endpoints

The dashboard uses these FortiGate API endpoints:

- **FortiAPs**: `/api/v2/monitor/wifi/managed_ap`
- **FortiSwitches**: `/api/v2/monitor/switch/controller/managed_switch`

### Administrator Permissions

Ensure your FortiGate administrator account has:

- **Read access** to WiFi and Switch monitoring
- **API access** enabled
- **Trusted hosts** configured (if using IP restrictions)

### Network Requirements

- **Connectivity**: Dashboard server must reach FortiGate management IP
- **HTTPS**: FortiGate management interface must be accessible
- **Self-signed certificates**: Set `ALLOW_SELF_SIGNED=true` for self-signed certs

## Data Transformation

The dashboard automatically transforms raw FortiGate API data into a unified format:

### FortiAP Data Mapping
- Device status, IP, model, serial
- Wireless channel information and utilization
- Client counts and connection limits
- Temperature and system metrics
- RF information (signal strength, noise)
- Security metrics (rogue APs, interference)

### FortiSwitch Data Mapping
- Device status, IP, model, serial
- Port information and status
- PoE power budget and consumption
- System metrics (CPU, memory, temperature)
- Hardware status (fans, power supplies)
- FortiLink connectivity status

### System Health Generation
- Automatically generates alerts for:
  - Device offline conditions
  - High temperature warnings
  - PoE utilization alerts
  - Hardware failures
- Calculates summary statistics
- Provides real-time health overview

## Testing Real Data Connection

### 1. Update Configuration
```bash
# Update your FortiGate IP address
FGT_URL=https://YOUR_FORTIGATE_IP

# Set your credentials
FGT_USERNAME=admin
FGT_PASSWORD=your_password
```

### 2. Test Connection
```bash
# Test API connectivity
curl http://localhost:59169/api/test

# Check overview data
curl http://localhost:59169/api/overview
```

### 3. View Dashboard
Open your browser to: `http://localhost:59169`

## Troubleshooting

### Connection Issues

**Problem**: Connection timeout or unreachable host
```
Error: Connection timeout: FortiGate API request timed out after 5 seconds
```

**Solutions**:
- Verify FortiGate IP address in `FGT_URL`
- Check network connectivity to FortiGate
- Ensure FortiGate management interface is accessible
- Verify firewall rules allow connection

### Authentication Issues

**Problem**: Login failed or unauthorized access
```
Error: FortiGate request failed 401 Unauthorized
```

**Solutions**:
- Verify username/password in .env file
- Check administrator account permissions
- Ensure API access is enabled for the account
- Verify trusted hosts configuration

### Certificate Issues

**Problem**: TLS/SSL certificate errors
```
Error: unable to verify the first certificate
```

**Solutions**:
- Set `ALLOW_SELF_SIGNED=true` in .env (temporary solution)
- Install proper CA-signed certificates on FortiGate (recommended - see below)
- Update Node.js certificate store if needed

## Installing CA-Signed Certificates on FortiGate

For production use, it's highly recommended to install proper CA-signed certificates on your FortiGate instead of using self-signed certificates. This eliminates certificate warnings and provides better security.

### Automated Certificate Installation

The dashboard includes automated tools to generate and install CA-signed certificates on your FortiGate:

#### Option 1: Full Automation via SSH (Recommended)

Use the bash script for complete automation via SSH:

```bash
# 1. Generate the certificate from CA
node generate-fortigate-cert.js

# 2. Install it on FortiGate via SSH
chmod +x install-fortigate-cert.sh
./install-fortigate-cert.sh
```

**Requirements**:
- SSH access to FortiGate
- `sshpass` utility installed (`sudo apt install sshpass`)
- FortiGate admin credentials

The script will:
- Test SSH connectivity
- Install the CA certificate
- Install the server certificate and private key
- Configure HTTPS to use the new certificate
- Verify the installation

#### Option 2: API-Based Installation

Use the Node.js script for API-based installation:

```bash
# 1. Generate the certificate
node generate-fortigate-cert.js

# 2. Install via FortiGate API
node automate-cert-install.js
```

**Requirements**:
- FortiGate API access enabled
- Valid API token configured
- Network connectivity to FortiGate

The script will:
- Upload the server certificate and private key
- Configure HTTPS to use the new certificate
- Verify the installation
- Wait for changes to propagate
- Test the new certificate

#### Option 3: Manual Installation

If you prefer manual installation or don't have SSH/API access:

```bash
# Generate the certificate
node generate-fortigate-cert.js
```

This creates:
- `certificates/fortigate.crt` - Server certificate
- `certificates/fortigate.key` - Private key
- `certificates/ca.crt` - CA certificate
- `certificates/fortigate-install-commands.txt` - CLI commands

**Manual Installation Steps**:

1. **Access FortiGate GUI**: Navigate to `https://your-fortigate-ip:8443`

2. **Install CA Certificate**:
   - Go to **System > Certificates**
   - Click **Import > CA Certificate**
   - Upload `certificates/ca.crt`
   - Name it "NetIntegrate-CA"

3. **Install Server Certificate**:
   - Go to **System > Certificates**
   - Click **Import > Local Certificate**
   - Upload `certificates/fortigate.crt` and `certificates/fortigate.key`
   - Name it "fortigate.netintegrate.net"

4. **Configure HTTPS**:
   - Go to **System > Settings**
   - Under **Administration Settings**, find **HTTPS server certificate**
   - Select "fortigate.netintegrate.net"
   - Click **Apply**

5. **Verify Installation**:
   - Wait 30 seconds for changes to apply
   - Access FortiGate via `https://fortigate.netintegrate.net:8443`
   - Verify the certificate is trusted

### Certificate Authority Details

The certificates are issued by the NetIntegrate Certificate Authority (`ca.netintegrate.net`):

- **CA URL**: `https://ca.netintegrate.net`
- **Certificate Type**: Server certificate with SHA-256
- **Key Size**: 2048-bit RSA
- **Validity**: 365 days
- **Subject Alternative Name**: Includes FQDN and IP

### After Certificate Installation

Once the certificate is installed on FortiGate:

1. **Update Dashboard Configuration**:
   ```bash
   # In your .env file
   FGT_URL=https://fortigate.netintegrate.net:8443
   ALLOW_SELF_SIGNED=false  # Enable proper certificate validation
   ```

2. **Add CA Certificate to System Trust Store** (if needed):
   ```bash
   # Linux
   sudo cp certificates/ca.crt /usr/local/share/ca-certificates/netintegrate-ca.crt
   sudo update-ca-certificates

   # macOS
   sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain certificates/ca.crt
   ```

3. **Test the Connection**:
   ```bash
   # Test API connectivity with proper certificate validation
   curl http://localhost:59169/api/test

   # Check that certificate validation is working
   openssl s_client -connect fortigate.netintegrate.net:8443 -CAfile certificates/ca.crt
   ```

### DNS Configuration

For the certificate to work properly, ensure DNS resolution for the FQDN:

```bash
# Option 1: Add to /etc/hosts
echo "192.168.0.254 fortigate.netintegrate.net" | sudo tee -a /etc/hosts

# Option 2: Configure in your DNS server
# Add an A record: fortigate.netintegrate.net -> 192.168.0.254
```

### Certificate Renewal

Certificates expire after 365 days. To renew:

```bash
# Generate new certificate
node generate-fortigate-cert.js

# Install using your preferred method (SSH, API, or manual)
./install-fortigate-cert.sh
```

### API Permission Issues

**Problem**: Access denied to specific endpoints
```
Error: FortiGate request failed 403 Forbidden
```

**Solutions**:
- Review administrator account permissions
- Ensure read access to WiFi and Switch monitoring
- Check FortiGate access control policies

## Fallback Behavior

When FortiGate is unreachable, the dashboard:

1. **Attempts connection** with configured authentication
2. **Times out after 5 seconds** to avoid hanging
3. **Logs detailed error** information for troubleshooting
4. **Falls back to YAML data** to keep dashboard functional
5. **Continues serving** the web interface

This ensures the dashboard remains operational during network issues or FortiGate maintenance.

## Production Deployment

### Security Considerations

1. **Use HTTPS**: Deploy dashboard behind HTTPS proxy
2. **Restrict access**: Configure firewall rules for dashboard access
3. **Secure credentials**: Use environment variables, not hardcoded values
4. **Regular rotation**: Rotate passwords and API tokens regularly
5. **Monitoring**: Monitor authentication logs and access patterns

### Performance Optimization

1. **Session caching**: Sessions are cached for 30 minutes
2. **Timeout handling**: 5-second timeouts prevent hanging
3. **Graceful errors**: Proper error handling with fallback data
4. **Connection pooling**: Consider implementing for high-frequency requests

### High Availability

1. **Multiple FortiGates**: Configure multiple FortiGate endpoints
2. **Load balancing**: Use load balancer for dashboard instances
3. **Health monitoring**: Monitor FortiGate connectivity status
4. **Alerting**: Set up alerts for connection failures

## API Endpoints Summary

| Endpoint | Description | Authentication |
|----------|-------------|----------------|
| `/api/health` | Health check | None |
| `/api/test` | Test FortiGate connectivity | Required |
| `/api/overview` | Complete dashboard data | Required |
| `/api/fortiaps` | FortiAP data only | Required |
| `/api/fortiswitches` | FortiSwitch data only | Required |
| `/api/fallback-overview` | YAML fallback data | None |

## Support

If you encounter issues:

1. Check server logs for detailed error messages
2. Verify FortiGate configuration and permissions
3. Test network connectivity to FortiGate
4. Review this documentation for troubleshooting steps

The dashboard is designed to be resilient and will continue working with fallback data even when FortiGate connectivity is interrupted.