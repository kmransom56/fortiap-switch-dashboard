// Test network connectivity to FortiGate
require('dotenv').config();
const { exec } = require('child_process');
const net = require('net');
const https = require('https');
const url = require('url');

// Load configuration
const FGT_URL = process.env.FGT_URL || process.env.FORTIGATE_URL;

// Validate configuration
if (!FGT_URL) {
  console.error('Error: FortiGate URL not configured. Add FORTIGATE_URL to .env file.');
  process.exit(1);
}

// Parse URL to get hostname and port
const parsedUrl = new URL(FGT_URL);
const hostname = parsedUrl.hostname;
const port = parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80);

console.log('=== FortiGate Connection Test Tool ===');
console.log('URL:', FGT_URL);
console.log('Hostname:', hostname);
console.log('Port:', port);
console.log('');

// Test 1: Ping the host
function pingTest() {
  return new Promise((resolve) => {
    console.log(`Test 1: Ping to ${hostname}`);
    
    // Use appropriate ping command based on platform
    const pingCmd = process.platform === 'win32' 
      ? `ping -n 4 ${hostname}` 
      : `ping -c 4 ${hostname}`;
    
    exec(pingCmd, (error, stdout, stderr) => {
      if (error) {
        console.log('❌ Ping failed:');
        console.log(stderr || stdout);
        console.log('Suggestion: Check if the FortiGate IP address is correct and reachable from this machine.');
        resolve(false);
        return;
      }
      
      // Check ping output
      const output = stdout.toString();
      console.log(output);
      
      if (output.includes('Request timed out') || 
          output.includes('100% packet loss') ||
          output.includes('Destination host unreachable')) {
        console.log('❌ Host is not responding to ping');
        console.log('Suggestions:');
        console.log(' - Verify FortiGate IP address is correct');
        console.log(' - Check network connectivity and firewalls');
        console.log(' - FortiGate might be configured to not respond to ping');
        console.log(' - If host doesn\'t respond to ping, port test may still succeed');
        resolve(false);
      } else {
        console.log('✅ Ping successful');
        resolve(true);
      }
    });
  });
}

// Test 2: Test TCP port connectivity
function portTest() {
  return new Promise((resolve) => {
    console.log(`\nTest 2: TCP port check on ${hostname}:${port}`);
    
    const socket = new net.Socket();
    let connected = false;
    
    // Set a timeout for the connection attempt
    socket.setTimeout(5000);
    
    socket.on('connect', () => {
      console.log(`✅ Successfully connected to ${hostname}:${port}`);
      connected = true;
      socket.end();
      resolve(true);
    });
    
    socket.on('timeout', () => {
      console.log(`❌ Connection to ${hostname}:${port} timed out`);
      console.log('Suggestions:');
      console.log(' - Verify the port number is correct');
      console.log(' - Check if a firewall is blocking the connection');
      console.log(' - Ensure FortiGate is listening on this port');
      socket.destroy();
      resolve(false);
    });
    
    socket.on('error', (error) => {
      console.log(`❌ Error connecting to ${hostname}:${port}: ${error.message}`);
      
      if (error.code === 'ENOTFOUND') {
        console.log('Suggestions:');
        console.log(' - Check if the hostname is correct');
        console.log(' - Verify DNS resolution is working');
      } else if (error.code === 'ECONNREFUSED') {
        console.log('Suggestions:');
        console.log(' - Verify FortiGate is running and accepting connections on this port');
        console.log(' - Check if the port number is correct');
        console.log(' - Ensure no firewall is blocking connections');
      } else if (error.code === 'ECONNRESET') {
        console.log('Suggestions:');
        console.log(' - The server actively refused the connection');
        console.log(' - This might be due to security settings or SSL/TLS requirements');
      }
      
      resolve(false);
    });
    
    socket.on('close', () => {
      if (!connected) {
        console.log('Connection closed without establishing connection');
        resolve(false);
      }
    });
    
    // Attempt to connect
    console.log(`Attempting to connect to ${hostname}:${port}...`);
    socket.connect(port, hostname);
  });
}

// Test 3: HTTPS Handshake Test
function httpsHandshakeTest() {
  return new Promise((resolve) => {
    if (parsedUrl.protocol !== 'https:') {
      console.log('\nTest 3: HTTPS Handshake - Skipped (not an HTTPS URL)');
      resolve(true);
      return;
    }
    
    console.log(`\nTest 3: HTTPS Handshake with ${hostname}:${port}`);
    
    // Create HTTPS request options
    const options = {
      hostname: hostname,
      port: port,
      path: '/',
      method: 'GET',
      timeout: 5000,
      // This would normally be unsafe, but for testing we can try both ways
      rejectUnauthorized: false
    };
    
    const req = https.request(options, (res) => {
      console.log('✅ HTTPS handshake successful');
      console.log(`Status code: ${res.statusCode}`);
      console.log('Response headers:', res.headers);
      
      // Consume response data to free up memory
      res.on('data', () => {});
      
      resolve(true);
    });
    
    req.on('timeout', () => {
      console.log('❌ HTTPS request timed out');
      console.log('Suggestions:');
      console.log(' - Check if HTTPS is enabled on the FortiGate');
      console.log(' - Verify port number for HTTPS (usually 443 or 8443)');
      req.destroy();
      resolve(false);
    });
    
    req.on('error', (error) => {
      console.log(`❌ HTTPS error: ${error.message}`);
      
      if (error.message.includes('certificate')) {
        console.log('Certificate issue detected:');
        console.log(' - FortiGate likely uses a self-signed certificate');
        console.log(' - Add ALLOW_SELF_SIGNED=true to your .env file');
        console.log(' - For API requests, set NODE_TLS_REJECT_UNAUTHORIZED=0');
      }
      
      console.log('Suggestions:');
      console.log(' - Verify HTTPS is properly configured on FortiGate');
      console.log(' - Check if your network allows HTTPS connections');
      
      resolve(false);
    });
    
    req.end();
  });
}

// Run all tests
async function runTests() {
  let pingResult = await pingTest();
  let portResult = await portTest();
  let httpsResult = await httpsHandshakeTest();
  
  console.log('\n=== Summary ===');
  console.log('Ping test:', pingResult ? '✅ Passed' : '❌ Failed');
  console.log('Port test:', portResult ? '✅ Passed' : '❌ Failed');
  console.log('HTTPS test:', httpsResult ? '✅ Passed' : '❌ Failed/Skipped');
  
  if (!portResult) {
    console.log('\nTroubleshooting Next Steps:');
    console.log('1. Verify the FortiGate URL in .env (should be https://ipaddress:port)');
    console.log('2. Check if you can access FortiGate\'s web interface in a browser');
    console.log('3. Ensure the FortiGate\'s REST API is enabled (in the GUI: System > Feature Visibility)');
    console.log('4. Verify network connectivity and firewall rules');
    console.log('5. Check if the FortiGate is configured to accept connections on this port');
    console.log('\nRun test-api.js after fixing connectivity to test the API specifically');
  } else {
    console.log('\nNetwork connectivity to FortiGate appears OK. Run test-api.js next to test API connectivity.');
  }
}

// Run all tests
runTests().catch(error => {
  console.error('Unexpected error:', error);
});