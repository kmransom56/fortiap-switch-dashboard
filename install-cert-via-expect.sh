#!/bin/bash

# FortiGate Certificate Installation via Expect
# This script automates SSH login and certificate installation

FORTIGATE_IP="192.168.0.254"
FORTIGATE_USER="admin"
FORTIGATE_PASS="!cg@RW%G@o"
CERT_DIR="./certificates"

echo "🔐 Installing CA-signed certificate on FortiGate via SSH..."
echo "📍 Target: ${FORTIGATE_IP}"
echo "👤 User: ${FORTIGATE_USER}"

# Check if certificate files exist
if [[ ! -f "${CERT_DIR}/fortigate.crt" ]] || [[ ! -f "${CERT_DIR}/fortigate.key" ]]; then
    echo "❌ Certificate files not found in ${CERT_DIR}/"
    echo "   Run: node generate-fortigate-cert.js first"
    exit 1
fi

# Read the full chain certificate (includes intermediate and root CAs)
CA_CERT=$(cat "${CERT_DIR}/ca.crt")
SERVER_CERT=$(cat "${CERT_DIR}/fortigate.crt")
PRIVATE_KEY=$(cat "${CERT_DIR}/fortigate.key")

echo ""
echo "🔄 Installing certificate via SSH..."
echo ""

# Create temporary script for SSH commands
cat > /tmp/fortigate_cert_install.exp << 'EXPECT_SCRIPT'
#!/usr/bin/expect -f
set timeout 30
set fortigate_ip [lindex $argv 0]
set fortigate_user [lindex $argv 1]
set fortigate_pass [lindex $argv 2]
set server_cert [lindex $argv 3]
set private_key [lindex $argv 4]

spawn ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null ${fortigate_user}@${fortigate_ip}

expect {
    "password:" {
        send "${fortigate_pass}\r"
    }
    timeout {
        puts "❌ Connection timeout"
        exit 1
    }
}

expect {
    "#" {
        send "config vpn certificate local\r"
    }
    timeout {
        puts "❌ Login failed"
        exit 1
    }
}

expect "#"
send "edit \"fortigate.netintegrate.net\"\r"

expect "#"
send "set certificate \"${server_cert}\"\r"

expect "#"
send "set private-key \"${private_key}\"\r"

expect "#"
send "set comments \"CA-signed certificate from NetIntegrate CA\"\r"

expect "#"
send "next\r"

expect "#"
send "end\r"

expect "#"
send "config system global\r"

expect "#"
send "set admin-server-cert \"fortigate.netintegrate.net\"\r"

expect "#"
send "end\r"

expect "#"
send "exit\r"

expect eof
EXPECT_SCRIPT

chmod +x /tmp/fortigate_cert_install.exp

# Escape special characters in certificates for expect
SERVER_CERT_ESCAPED=$(echo "$SERVER_CERT" | sed 's/"/\\"/g' | tr '\n' ' ')
PRIVATE_KEY_ESCAPED=$(echo "$PRIVATE_KEY" | sed 's/"/\\"/g' | tr '\n' ' ')

# Run expect script
/tmp/fortigate_cert_install.exp "$FORTIGATE_IP" "$FORTIGATE_USER" "$FORTIGATE_PASS" "$SERVER_CERT_ESCAPED" "$PRIVATE_KEY_ESCAPED"

if [ $? -eq 0 ]; then
    echo "✅ Certificate installed successfully!"
    echo ""
    echo "🎯 Next steps:"
    echo "1. Wait 30 seconds for FortiGate to apply changes"
    echo "2. Update your .env file:"
    echo "   FGT_URL=https://fortigate.netintegrate.net:8443"
    echo "   ALLOW_SELF_SIGNED=false"
    echo "3. Add DNS entry: echo '192.168.0.254 fortigate.netintegrate.net' | sudo tee -a /etc/hosts"
    echo "4. Test the dashboard"
else
    echo "❌ Certificate installation failed"
    exit 1
fi

# Cleanup
rm -f /tmp/fortigate_cert_install.exp
