# Enabling FortiLink NAC for Device Detection

## Overview

The `/api/switch/detected-devices` endpoint requires FortiLink NAC (Network Access Control) to be enabled on your FortiGate to track which devices are connected to each switch port.

## What NAC Provides

- **MAC address detection** on each switch port
- **Device profiling** and classification
- **VLAN assignment** based on device type
- **Last seen** timestamps for connected devices
- Integration with 802.1X authentication (optional)

## Configuration Steps

### Option 1: Via FortiGate GUI (Recommended)

1. **Login to FortiGate**
   - Navigate to: https://fortigate.netintegrate.net:8443
   - Username: admin
   - Password: [your password]

2. **Enable Device Detection**
   - Go to: **WiFi & Switch Controller** > **FortiLink**
   - Select your FortiLink interface
   - Enable **DHCP Snooping** (this tracks MAC addresses)

3. **Configure Switch Settings**
   - Go to: **WiFi & Switch Controller** > **Managed FortiSwitches**
   - Select your switch (S124EPTQ22000276)
   - Click **Edit**
   - Under **Settings**, enable:
     - ✅ **DHCP Snooping**
     - ✅ **IGMP Snooping** (optional, for multicast)

4. **Apply Changes**
   - Click **OK** to save
   - Wait 30-60 seconds for changes to propagate

### Option 2: Via CLI (Advanced)

Connect to FortiGate CLI via SSH:

```bash
ssh admin@192.168.0.254
```

Run these commands:

```fortios
config switch-controller global
    set dhcp-snoop-client-req enable
    set mac-event-logging enable
end

config switch-controller managed-switch
    edit "S124EPTQ22000276"
        set dhcp-snooping enable
        set igmp-snooping enable
    next
end
```

### Option 3: Via API (Automated)

**Note**: This requires API write permissions. If your current API token is read-only, you'll need to create a new administrator profile with write access.

```bash
# Enable DHCP snooping globally
curl -X PUT \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"dhcp-snoop-client-req": "enable", "mac-event-logging": "enable"}' \
  "https://fortigate.netintegrate.net:8443/api/v2/cmdb/switch-controller/global"

# Enable DHCP snooping on the switch
curl -X PUT \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"dhcp-snooping": "enable", "igmp-snooping": "enable"}' \
  "https://fortigate.netintegrate.net:8443/api/v2/cmdb/switch-controller/managed-switch/S124EPTQ22000276"
```

## Verification

After enabling NAC, verify it's working:

### 1. Check via Dashboard API

```bash
curl http://localhost:59169/api/switch/detected-devices
```

Expected response:
```json
{
  "total_devices": 3,
  "devices": [
    {
      "mac": "aa:bb:cc:dd:ee:ff",
      "switch_id": "S124EPTQ22000276",
      "port_name": "port5",
      "port_id": 5,
      "vlan_id": 1,
      "last_seen": 10,
      "vdom": "root"
    }
  ]
}
```

### 2. Check via FortiGate GUI

- Go to: **WiFi & Switch Controller** > **FortiLink Devices**
- You should see connected devices with MAC addresses and ports

### 3. Check via FortiGate API

```bash
curl -H "Authorization: Bearer f5q7tgy9tznpHwqxc5fmHtz01nh5Q0" \
  "https://fortigate.netintegrate.net:8443/api/v2/monitor/switch-controller/detected-device"
```

## Troubleshooting

### No devices detected

1. **Check DHCP snooping is enabled**
   ```fortios
   show switch-controller global
   show switch-controller managed-switch S124EPTQ22000276
   ```

2. **Verify devices are getting DHCP**
   - Devices need to request DHCP for MAC detection
   - Static IP devices may not be detected

3. **Wait for detection**
   - New devices appear after DHCP request
   - Can take 30-60 seconds

4. **Check switch connectivity**
   ```bash
   curl http://localhost:59169/api/fortiswitches
   ```
   - Ensure FortiLink status is "up"

### API returns empty array

- This is normal if:
  - No devices have requested DHCP recently
  - All devices use static IPs
  - DHCP snooping is disabled

## Additional NAC Features (Optional)

### 802.1X Authentication

For enterprise environments requiring authentication:

1. **Go to**: WiFi & Switch Controller > 802.1X Settings
2. **Enable**: 802.1X authentication
3. **Configure**: RADIUS server (FortiAuthenticator or other)
4. **Apply**: Per-port or per-VLAN policies

### Device Classification

Automatically categorize devices:

1. **Go to**: WiFi & Switch Controller > Auto Config
2. **Create**: Device classification rules
3. **Assign**: VLANs based on device type (Phones, Cameras, Computers)

### Dynamic Port Policies

Automatically configure ports based on connected device:

1. **Go to**: WiFi & Switch Controller > Dynamic Port Policy
2. **Create**: Policies for different device types
3. **Apply**: QoS, VLAN, PoE settings automatically

## Security Considerations

### DHCP Snooping Security

DHCP snooping prevents rogue DHCP servers:

- **Trusted ports**: Only FortiGate and authorized DHCP servers
- **Untrusted ports**: Client devices (default)
- **Rate limiting**: Prevents DHCP exhaustion attacks

### MAC Address Filtering

Combine with MAC-based access control:

```fortios
config switch-controller security-policy 802-1X
    edit "guest-policy"
        set mac-auth-bypass enable
        set auth-fail-vlan 100
    next
end
```

## Dashboard Integration

Once NAC is enabled, the dashboard will show:

- **Real-time device detection** on switch ports
- **MAC address to port mapping**
- **Device presence timestamps**
- **VLAN assignments per device**
- **Enhanced network topology** with wired device connections

## References

- [FortiOS 7.6 Switch Controller Guide](https://docs.fortinet.com/)
- [FortiLink NAC Documentation](https://docs.fortinet.com/document/fortigate/7.6.0/administration-guide/switch-controller)
- [DHCP Snooping Configuration](https://docs.fortinet.com/document/fortigate/7.6.0/administration-guide/dhcp-snooping)

## Support

If you encounter issues:

1. Check server logs: `curl http://localhost:59169/api/client/stats`
2. Test FortiGate API directly with curl commands above
3. Verify API token has correct permissions
4. Check FortiOS version supports NAC (7.6.4+ recommended)
