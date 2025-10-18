#!/usr/bin/env python3
"""
FortiGate Certificate Installation via SSH
Installs CA-signed certificates on FortiGate using SSH
"""

import subprocess
import sys
import os
import time

# Configuration
FORTIGATE_IP = "192.168.0.254"
FORTIGATE_USER = "admin"
FORTIGATE_PASS = "!cg@RW%G@o"
CERT_DIR = "./certificates"

def run_ssh_command(command, expect_prompts=["#"]):
    """Run SSH command using expect"""
    expect_script = f"""
spawn ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null {FORTIGATE_USER}@{FORTIGATE_IP}
expect "password:"
send "{FORTIGATE_PASS}\\r"
expect "#"
send "{command}\\r"
expect "#"
send "exit\\r"
expect eof
"""

    proc = subprocess.Popen(
        ['expect'],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True
    )

    stdout, stderr = proc.communicate(expect_script)
    return proc.returncode, stdout, stderr

def read_file(filepath):
    """Read file content"""
    with open(filepath, 'r') as f:
        return f.read().strip()

def main():
    print("🔐 Installing CA-signed certificate on FortiGate via SSH...")
    print(f"📍 Target: {FORTIGATE_IP}")
    print(f"👤 User: {FORTIGATE_USER}")
    print()

    # Check certificate files
    cert_file = os.path.join(CERT_DIR, "fortigate.crt")
    key_file = os.path.join(CERT_DIR, "fortigate.key")

    if not os.path.exists(cert_file) or not os.path.exists(key_file):
        print(f"❌ Certificate files not found in {CERT_DIR}/")
        print("   Run: node generate-fortigate-cert.js first")
        sys.exit(1)

    # Read certificates
    print("📄 Reading certificate files...")
    server_cert = read_file(cert_file)
    private_key = read_file(key_file)

    # Escape quotes for FortiGate CLI
    server_cert_escaped = server_cert.replace('"', '\\"')
    private_key_escaped = private_key.replace('"', '\\"')

    print("🔄 Step 1: Testing SSH connection...")

    test_script = f"""
spawn ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null {FORTIGATE_USER}@{FORTIGATE_IP}
expect "password:"
send "{FORTIGATE_PASS}\\r"
expect "#"
send "get system status\\r"
expect "#"
send "exit\\r"
expect eof
"""

    proc = subprocess.Popen(['expect'], stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    stdout, stderr = proc.communicate(test_script)

    if proc.returncode != 0 or "Version:" not in stdout:
        print("❌ Cannot connect to FortiGate via SSH")
        print("   Check credentials and network connectivity")
        sys.exit(1)

    print("✅ SSH connection successful")
    print()

    print("🔄 Step 2: Installing server certificate and private key...")

    # Create FortiGate CLI commands
    install_script = f"""
spawn ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null {FORTIGATE_USER}@{FORTIGATE_IP}
set timeout 60
expect "password:"
send "{FORTIGATE_PASS}\\r"
expect "#"

send "config vpn certificate local\\r"
expect "#"

send "edit \\"fortigate.netintegrate.net\\"\\r"
expect "#"

send "set certificate \\"{server_cert_escaped}\\"\\r"
expect "#"

send "set private-key \\"{private_key_escaped}\\"\\r"
expect "#"

send "set comments \\"CA-signed certificate from NetIntegrate CA\\"\\r"
expect "#"

send "next\\r"
expect "#"

send "end\\r"
expect "#"

send "exit\\r"
expect eof
"""

    proc = subprocess.Popen(['expect'], stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    stdout, stderr = proc.communicate(install_script)

    if proc.returncode != 0:
        print("❌ Failed to install certificate")
        print(f"Error: {stderr}")
        sys.exit(1)

    print("✅ Server certificate and private key installed")
    print()

    print("🔄 Step 3: Configuring HTTPS to use new certificate...")

    config_script = f"""
spawn ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null {FORTIGATE_USER}@{FORTIGATE_IP}
expect "password:"
send "{FORTIGATE_PASS}\\r"
expect "#"

send "config system global\\r"
expect "#"

send "set admin-server-cert \\"fortigate.netintegrate.net\\"\\r"
expect "#"

send "end\\r"
expect "#"

send "exit\\r"
expect eof
"""

    proc = subprocess.Popen(['expect'], stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    stdout, stderr = proc.communicate(config_script)

    if proc.returncode != 0:
        print("❌ Failed to configure HTTPS certificate")
        sys.exit(1)

    print("✅ HTTPS configured to use new certificate")
    print()

    print("✅ Certificate installation completed successfully!")
    print()
    print("🎯 Next steps:")
    print("1. Wait 30 seconds for FortiGate to apply changes")
    print("2. Add DNS entry:")
    print("   echo '192.168.0.254 fortigate.netintegrate.net' | sudo -S tee -a /etc/hosts")
    print("3. Update your .env file:")
    print("   FGT_URL=https://fortigate.netintegrate.net:8443")
    print("   ALLOW_SELF_SIGNED=false")
    print("4. Test the dashboard: curl http://localhost:59169/api/test")
    print()

if __name__ == "__main__":
    main()
