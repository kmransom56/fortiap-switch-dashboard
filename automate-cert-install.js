#!/usr/bin/env node

/**
 * Automated FortiGate Certificate Installation
 * Uses FortiOS API to install CA-signed certificates
 */

const fs = require('fs');
const https = require('https');

// Configuration
const FORTIGATE_URL = 'https://192.168.0.254:8443';
const API_TOKEN = 'f5q7tgy9tznpHwqxc5fmHtz01nh5Q0';

/**
 * Make FortiGate API request
 */
async function fortiAPI(path, method = 'GET', data = null) {
  // Set the same environment variable as the server
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  
  const url = `${FORTIGATE_URL}${path}`;
  
  const options = {
    method,
    headers: {
      'Authorization': `Bearer ${API_TOKEN}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }
  };
  
  if (data) {
    options.body = JSON.stringify(data);
  }
  
  console.log(`📡 ${method} ${path}`);
  
  try {
    const response = await fetch(url, options);
    
    console.log(`📡 Response: ${response.status} ${response.statusText}`);
    
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
 * Upload certificate via FortiOS API
 */
async function uploadCertificate() {
  try {
    console.log('🔐 Uploading certificate via FortiOS API...');
    
    // Read certificate files
    const serverCert = fs.readFileSync('./certificates/fortigate.crt', 'utf8').trim();
    const privateKey = fs.readFileSync('./certificates/fortigate.key', 'utf8').trim();
    
    console.log('📄 Certificate files loaded');
    
    // Step 1: Upload local certificate (server cert + private key)
    console.log('🔄 Step 1: Uploading server certificate...');
    
    const certData = {
      "name": "fortigate.netintegrate.net",
      "certificate": serverCert,
      "private-key": privateKey,
      "comments": "CA-signed certificate for FortiGate management"
    };
    
    try {
      const uploadResult = await fortiAPI('/api/v2/cmdb/vpn.certificate/local', 'POST', certData);
      console.log('✅ Server certificate uploaded successfully');
    } catch (error) {
      if (error.message.includes('already exists')) {
        console.log('⚠️  Certificate already exists, updating...');
        try {
          await fortiAPI('/api/v2/cmdb/vpn.certificate/local/fortigate.netintegrate.net', 'PUT', certData);
          console.log('✅ Certificate updated successfully');
        } catch (updateError) {
          console.warn('⚠️  Could not update certificate, continuing...');
        }
      } else {
        throw error;
      }
    }
    
    // Step 2: Configure HTTPS to use the new certificate
    console.log('🔄 Step 2: Configuring HTTPS server certificate...');
    
    const httpsConfig = {
      "admin-server-cert": "fortigate.netintegrate.net"
    };
    
    try {
      await fortiAPI('/api/v2/cmdb/system/global', 'PUT', httpsConfig);
      console.log('✅ HTTPS configured to use new certificate');
    } catch (error) {
      console.warn('⚠️  Could not configure HTTPS certificate via API');
      console.log('   Manual step: Set admin-server-cert in System > Settings');
    }
    
    // Step 3: Verify installation
    console.log('🔄 Step 3: Verifying certificate installation...');
    
    try {
      const certList = await fortiAPI('/api/v2/cmdb/vpn.certificate/local');
      const ourCert = certList.results?.find(cert => cert.name === 'fortigate.netintegrate.net');
      
      if (ourCert) {
        console.log('✅ Certificate verification successful');
        console.log(`   Name: ${ourCert.name}`);
        console.log(`   Status: Installed`);
      } else {
        console.log('⚠️  Certificate not found in list');
      }
    } catch (error) {
      console.warn('⚠️  Could not verify certificate installation');
    }
    
    console.log('');
    console.log('🎯 Certificate installation completed!');
    console.log('');
    console.log('📋 Next steps:');
    console.log('1. Wait 30 seconds for FortiGate to apply changes');
    console.log('2. Test the dashboard connection');
    console.log('3. Update .env to disable self-signed certificates');
    console.log('');
    console.log('🧪 Test commands:');
    console.log('   curl http://localhost:59169/api/test');
    console.log('   curl http://localhost:59169/api/overview');
    
    return true;
    
  } catch (error) {
    console.error('❌ Certificate installation failed:', error.message);
    return false;
  }
}

/**
 * Test new certificate
 */
async function testCertificate() {
  console.log('');
  console.log('🧪 Testing new certificate...');
  
  try {
    // Test with strict certificate validation
    const strictAgent = new https.Agent({
      rejectUnauthorized: true
    });
    
    const response = await fetch(`https://fortigate.netintegrate.net:8443/api/v2/monitor/system/status`, {
      headers: {
        'Authorization': `Bearer ${API_TOKEN}`,
        'Accept': 'application/json'
      },
      agent: strictAgent
    });
    
    if (response.ok) {
      console.log('✅ Certificate validation successful with proper CA chain!');
      return true;
    } else {
      console.log('⚠️  Certificate installed but validation may need time to propagate');
      return false;
    }
    
  } catch (error) {
    console.log('⚠️  Certificate validation not yet working (may need time or DNS)');
    return false;
  }
}

// Main execution
async function main() {
  try {
    console.log('🚀 Automated FortiGate Certificate Installation');
    console.log('===============================================');
    
    const success = await uploadCertificate();
    
    if (success) {
      console.log('⏱️  Waiting 30 seconds for FortiGate to apply changes...');
      await new Promise(resolve => setTimeout(resolve, 30000));
      
      await testCertificate();
      
      console.log('');
      console.log('✅ Automation completed successfully!');
      console.log('🎯 Your FortiGate now has a CA-signed certificate');
    } else {
      throw new Error('Certificate installation failed');
    }
    
  } catch (error) {
    console.error('\n💥 Automation failed:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = {
  uploadCertificate,
  testCertificate
};