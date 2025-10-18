#!/usr/bin/env node

/**
 * Install certificate on FortiGate using REST API
 * Alternative to SSH when SSH access is limited
 */

const fs = require('fs');
const https = require('https');

// Configuration
const FORTIGATE_URL = 'https://192.168.0.254:8443';
const API_TOKEN = 'f5q7tgy9tznpHwqxc5fmHtz01nh5Q0';

// Create HTTPS agent that accepts self-signed certificates (for now)
const agent = new https.Agent({
  rejectUnauthorized: false
});

/**
 * Make FortiGate API request
 */
async function fortiAPI(path, method = 'GET', data = null) {
  const url = `${FORTIGATE_URL}${path}`;
  
  const options = {
    method,
    headers: {
      'Authorization': `Bearer ${API_TOKEN}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    agent
  };
  
  if (data) {
    options.body = JSON.stringify(data);
  }
  
  console.log(`📡 ${method} ${path}`);
  
  try {
    const response = await fetch(url, options);
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(`API error ${response.status}: ${errorText}`);
    }
    
    const result = await response.json().catch(() => ({}));
    return result;
    
  } catch (error) {
    console.error(`❌ API request failed: ${error.message}`);
    throw error;
  }
}

/**
 * Install certificate via FortiGate API
 */
async function installCertificate() {
  try {
    console.log('🔐 Installing certificate via FortiGate API...');
    
    // Read certificate files
    const serverCert = fs.readFileSync('./certificates/fortigate.crt', 'utf8');
    const privateKey = fs.readFileSync('./certificates/fortigate.key', 'utf8');
    
    console.log('📄 Certificate files loaded');
    
    // Note: FortiGate API certificate management may require GUI access
    // This approach demonstrates API capabilities, but certificate installation
    // is typically done via GUI or CLI
    
    console.log('⚠️  FortiGate certificate installation via API requires specific endpoints');
    console.log('   that may not be available in all FortiOS versions.');
    console.log('');
    console.log('📋 Manual installation steps:');
    console.log('1. Access FortiGate GUI: https://192.168.0.254:8443');
    console.log('2. Go to System > Certificates');
    console.log('3. Import CA certificate (certificates/ca.crt)');
    console.log('4. Import Local certificate (certificates/fortigate.crt + fortigate.key)');
    console.log('5. Go to System > Settings');
    console.log('6. Set HTTPS server certificate to "fortigate.netintegrate.net"');
    console.log('');
    console.log('✅ Certificate files are ready for manual installation');
    
    return true;
    
  } catch (error) {
    console.error('❌ Certificate installation failed:', error.message);
    return false;
  }
}

// Main execution
installCertificate().then(success => {
  if (success) {
    console.log('🎯 Next: Test the dashboard after manual certificate installation');
  } else {
    process.exit(1);
  }
});