#!/usr/bin/env node

/**
 * FortiGate Certificate Generator
 * Uses ca.netintegrate.net API to generate a CA-signed certificate for FortiGate
 */

// Using built-in fetch in Node.js 18+
const fs = require('fs');
const path = require('path');

// Configuration
const config = {
  caUrl: 'https://ca.netintegrate.net',
  fortigateFqdn: 'fortigate.netintegrate.net',  // Change this to your FortiGate FQDN
  fortigateIp: '192.168.0.254',
  outputDir: './certificates',
  certificateRequest: {
    serverName: 'fortigate.netintegrate.net',
    serverIp: '192.168.0.254',
    certificateType: 'server',
    outputFormat: 'pem',
    keySize: 2048,
    validityDays: 365,
    includeContent: true
  }
};

/**
 * Generate certificate for FortiGate
 */
async function generateFortiGateCertificate() {
  try {
    console.log('🔐 Generating CA-signed certificate for FortiGate...');
    console.log(`📍 Server: ${config.certificateRequest.serverName}`);
    console.log(`🌐 IP: ${config.certificateRequest.serverIp}`);
    console.log(`🔑 Key Size: ${config.certificateRequest.keySize} bits`);
    console.log(`⏰ Validity: ${config.certificateRequest.validityDays} days`);
    
    // Create output directory
    if (!fs.existsSync(config.outputDir)) {
      fs.mkdirSync(config.outputDir, { recursive: true });
      console.log(`📁 Created directory: ${config.outputDir}`);
    }
    
    // Make API request to generate certificate
    console.log('\n🔄 Requesting certificate from CA...');

    // Disable certificate validation for the CA request
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

    const response = await fetch(`${config.caUrl}/api/generate-cert`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(config.certificateRequest)
    });
    
    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }
    
    const result = await response.json();
    console.log('✅ Certificate generated successfully');

    // Save certificate files
    if (result.certificate && result.certificate.certificateContent) {
      const certPath = path.join(config.outputDir, 'fortigate.crt');
      fs.writeFileSync(certPath, result.certificate.certificateContent);
      console.log(`💾 Certificate saved: ${certPath}`);
    }

    if (result.certificate && result.certificate.privateKeyContent) {
      const keyPath = path.join(config.outputDir, 'fortigate.key');
      fs.writeFileSync(keyPath, result.certificate.privateKeyContent);
      console.log(`🔑 Private key saved: ${keyPath}`);
    }

    if (result.certificate && result.certificate.fullChainContent) {
      const caPath = path.join(config.outputDir, 'ca.crt');
      fs.writeFileSync(caPath, result.certificate.fullChainContent);
      console.log(`🏛️  CA full chain saved: ${caPath}`);
    }

    // Display certificate information
    console.log('\n📋 Certificate Information:');
    console.log(`   Subject: ${result.certificate?.subject || 'N/A'}`);
    console.log(`   Issuer: ${result.certificate?.issuer || 'ca.netintegrate.net'}`);
    console.log(`   Serial: ${result.certificate?.serial || 'N/A'}`);
    console.log(`   Valid From: ${result.certificate?.notBefore || 'N/A'}`);
    console.log(`   Valid To: ${result.certificate?.notAfter || 'N/A'}`);
    
    // Generate FortiGate installation commands
    generateFortiGateCommands(result);
    
    return result;
    
  } catch (error) {
    console.error('❌ Certificate generation failed:', error.message);
    
    if (error.cause?.code === 'ECONNREFUSED') {
      console.error('🚫 Cannot connect to certificate authority');
      console.error('   Check if ca.netintegrate.net is accessible');
    }
    
    throw error;
  }
}

/**
 * Generate FortiGate CLI commands for certificate installation
 */
function generateFortiGateCommands(certResult) {
  console.log('\n🔧 FortiGate Installation Commands:');
  console.log('Execute these commands in FortiGate CLI:');
  console.log('\n# 1. Upload CA certificate');
  console.log('config vpn certificate ca');
  console.log('edit "ca.netintegrate.net"');
  console.log('set ca "-----BEGIN CERTIFICATE-----');
  console.log('# Paste CA certificate content here');
  console.log('-----END CERTIFICATE-----"');
  console.log('next');
  console.log('end');
  
  console.log('\n# 2. Upload server certificate and private key');
  console.log('config vpn certificate local');
  console.log('edit "fortigate.netintegrate.net"');
  console.log('set certificate "-----BEGIN CERTIFICATE-----');
  console.log('# Paste server certificate content here');
  console.log('-----END CERTIFICATE-----"');
  console.log('set private-key "-----BEGIN PRIVATE KEY-----');
  console.log('# Paste private key content here');
  console.log('-----END PRIVATE KEY-----"');
  console.log('next');
  console.log('end');
  
  console.log('\n# 3. Configure HTTPS to use the new certificate');
  console.log('config system global');
  console.log('set admin-server-cert "fortigate.netintegrate.net"');
  console.log('end');
  
  console.log('\n# 4. Restart HTTPS service (optional)');
  console.log('execute reboot');
  
  // Save commands to file
  const commandsPath = path.join(config.outputDir, 'fortigate-install-commands.txt');
  const commands = `
# FortiGate Certificate Installation Commands
# Generated: ${new Date().toISOString()}

# 1. Upload CA certificate
config vpn certificate ca
edit "ca.netintegrate.net"
set ca "-----BEGIN CERTIFICATE-----
# Paste content from ca.crt file here
-----END CERTIFICATE-----"
next
end

# 2. Upload server certificate and private key  
config vpn certificate local
edit "fortigate.netintegrate.net"
set certificate "-----BEGIN CERTIFICATE-----
# Paste content from fortigate.crt file here
-----END CERTIFICATE-----"
set private-key "-----BEGIN PRIVATE KEY-----
# Paste content from fortigate.key file here
-----END PRIVATE KEY-----"
next
end

# 3. Configure HTTPS to use the new certificate
config system global
set admin-server-cert "fortigate.netintegrate.net"
end

# 4. Restart HTTPS service (optional)
execute reboot
`;
  
  fs.writeFileSync(commandsPath, commands.trim());
  console.log(`📝 Installation commands saved: ${commandsPath}`);
}

/**
 * Test certificate against FortiGate
 */
async function testCertificate() {
  try {
    console.log('\n🧪 Testing certificate against FortiGate...');
    
    // Test HTTPS connection with proper certificate validation
    const response = await fetch(`https://${config.certificateRequest.serverName}:8443`, {
      method: 'HEAD',
      timeout: 5000
    });
    
    console.log('✅ Certificate validation successful');
    return true;
    
  } catch (error) {
    console.log('⚠️  Certificate not yet installed or configured on FortiGate');
    console.log('   This is expected if you haven\'t installed it yet');
    return false;
  }
}

// Main execution
async function main() {
  try {
    console.log('🚀 FortiGate Certificate Generator');
    console.log('==================================');
    
    const result = await generateFortiGateCertificate();
    
    console.log('\n🎯 Next Steps:');
    console.log('1. Copy the certificate files to your FortiGate');
    console.log('2. Execute the CLI commands in FortiGate');
    console.log('3. Update your dashboard .env file to use proper certificate validation');
    console.log('4. Test the dashboard connection');
    
    // Update dashboard configuration
    console.log('\n🔧 Dashboard Configuration Update:');
    console.log('Update your .env file:');
    console.log(`FGT_URL=https://${config.certificateRequest.serverName}:8443`);
    console.log('ALLOW_SELF_SIGNED=false  # Enable proper certificate validation');
    
  } catch (error) {
    console.error('\n💥 Process failed:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = {
  generateFortiGateCertificate,
  testCertificate,
  config
};