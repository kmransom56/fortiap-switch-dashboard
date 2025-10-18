#!/bin/bash

# FortiGate Certificate Installation Script
# Automatically installs CA-signed certificate via SSH

FORTIGATE_IP="192.168.0.254"
FORTIGATE_PORT="8443"
FORTIGATE_USER="admin"
FORTIGATE_PASS="!cg@RW%G@o"
CERT_DIR="./certificates"

echo "🔐 Installing CA-signed certificate on FortiGate..."
echo "📍 Target: ${FORTIGATE_IP}:${FORTIGATE_PORT}"
echo "👤 User: ${FORTIGATE_USER}"

# Check if certificate files exist
if [[ ! -f "${CERT_DIR}/fortigate.crt" ]] || [[ ! -f "${CERT_DIR}/fortigate.key" ]]; then
    echo "❌ Certificate files not found in ${CERT_DIR}/"
    echo "   Run certificate generation first"
    exit 1
fi

echo ""
echo "🔄 Step 1: Testing SSH connection..."

# Test SSH connection
if ! sshpass -p "${FORTIGATE_PASS}" ssh -o StrictHostKeyChecking=no -o ConnectTimeout=10 "${FORTIGATE_USER}@${FORTIGATE_IP}" 'get system status' 2>/dev/null | grep -q "Version:"; then
    echo "❌ Cannot connect to FortiGate via SSH"
    echo "   Check credentials and network connectivity"
    exit 1
fi

echo "✅ SSH connection successful"

echo ""
echo "🔄 Step 2: Installing CA certificate..."

# Install CA certificate
CA_CERT=$(cat "${CERT_DIR}/fortigate.crt" | grep -A 50 "BEGIN CERTIFICATE" | head -30)
sshpass -p "${FORTIGATE_PASS}" ssh -o StrictHostKeyChecking=no "${FORTIGATE_USER}@${FORTIGATE_IP}" << 'EOF'
config vpn certificate ca
edit "NetIntegrate-CA"
set ca "-----BEGIN CERTIFICATE-----
MIIFlzCCA3+gAwIBAgIUWy+mg7NaXG+Qg0TG6DI02q/f+dUwDQYJKoZIhvcNAQEL
BQAwWzEeMBwGA1UEAwwVTmV0LUludGVncmF0ZSBSb290IENBMSwwKgYDVQQKDCNO
ZXQtSW50ZWdyYXRlIENlcnRpZmljYXRlIEF1dGhvcml0eTELMAkGA1UEBhMCVVMw
HhcNMjUwNTI1MDM1NTM1WhcNMzUwNTIzMDM1NTM1WjBbMR4wHAYDVQQDDBVOZXQt
SW50ZWdyYXRlIFJvb3QgQ0ExLDAqBgNVBAoMI05ldC1JbnRlZ3JhdGUgQ2VydGlm
aWNhdGUgQXV0aG9yaXR5MQswCQYDVQQGEwJVUzCCAiIwDQYJKoZIhvcNAQEBBQAD
ggIPADCCAgoCggIBAJOLmUgE1JFmiho2OhSpvQT/OyFtfk9MomYgyFDEBBZbEVlz
0b45EzDMOdDf1RfUdusx/4rdIx14NI1ofLG9Gl3p/U5du5x+RUqdXCv+dUl0Qkd/
2B6aZRXmS5lXPEWCtmFnJCmxE2jaJ1/XBi4yC3k7wtrpEdXzngf+WPFm/Afm6e0Y
5ieJKygpW5M5c3i61DzXU38atvLM+cBnesCSacSYpGXyMhhrutS4KJ4qLK6F4PHq
QMdT9Xipj5nWg2TPPXfeK5sR4LSTRjUFTkIDYbVCfiThAOTg73uiS0kdtpQsq2gj
CfZYfCok6UigUVfbEopitJ1xVfBME0iAKGGGluXytU1SkuQVRQMbQm4HCjEBIvmZ
iKAhrdUv3R76BDW1flcL40zXuzW1sSgPsSkJ0iihus6vavQf22yj3F+OTaNCyF/B
hC63jFGMEG3YoG/dH9ovaicnk9huAZtdTnZFSQVrPqJF5QrDBhriv+3HIKY/hlB4
UQ38g+0HgK0ldAGYIUGMPFra15UpJRUmnKt5jy4i/VPfuc5ipxsw52CLw418J/IG
N17waHC1TUK6Hq/Iy0ExO4CCHLqWe2EqtcN4dXmxiVj1xanI+IswZccDWtJtGDE0
Emr8RyBb2gaYauAJJa8FRTmyRlYvSDioCNU88FkKfoZPGJxcRar2Z9hdK9olAgMB
AAGjUzBRMB0GA1UdDgQWBBQ/x6JArlQ62Sie2Sm3m8QdNsXP6TAfBgNVHSMEGDAW
gBQ/x6JArlQ62Sie2Sm3m8QdNsXP6TAPBgNVHRMBAf8EBTADAQH/MA0GCSqGSIb3
DQEBCwUAA4ICAQCEt5Xq7/cbOOcRVzPq6HMDnY9ak986bi3XH2C9Wq2DTOD/UXBX
aeybpnZsVRqpY/Z/SFOih8qvVXm5t77BU+2I2OsUk3g6q0v/KNCyL4iyYaeNn9dT
s2HyfPnk/kAl0kjzSfQLbQQnfFNYvoaGP2gPMOZmCQVuyXBXY6xyACOMcHAkspP6
KbEvFCnoV7YUf2NoO948XUUBTLTzAStr1gj2fTJFgpPj46n0AyJK/fZK4aWuhCen
biJGEl4E9LpQAGN0tV1ii2ui8VyJfsLpYo+ahpC98i2RuND8oide3RcK+Ta5aaBF
TUmlQ/zvaT6wNZYC48H+IP5CiIPERo39ZsbJ17m83mtRNtgUV5OFLvRA4U/0Nx0h
MoFb5spXNJHjmlNv5akSFBFJb+7EdAUyWIvQHSLtLcVPCu68h/s3XXjxb6Zb6MBW
r/CAN5Ku+d/mZqD8lUc2l3/e5xuQGw3hhu93OoxD9qVShwHdiaWytd0NH0WVB4CR
RkffF7ALNIYv/2wDokWVwMW/OfHqriRKeqTfCIUAYQ6n0ygKVoojZUali0qQhC7b
7HIm1IBo9BFrrDKNOjRxdq9FccTe8VEOCGoX++62aJw97/3Y7/JBaN7THloEOgDZ
cprwl5mISW5/D/HY9QEiECdsXOP+VB2m3ShY4YRcyAlTeMiiSOLw+OqOkg==
-----END CERTIFICATE-----"
next
end
EOF

if [ $? -eq 0 ]; then
    echo "✅ CA certificate installed"
else
    echo "❌ Failed to install CA certificate"
    exit 1
fi

echo ""
echo "🔄 Step 3: Installing server certificate and private key..."

# Install server certificate and private key  
sshpass -p "${FORTIGATE_PASS}" ssh -o StrictHostKeyChecking=no "${FORTIGATE_USER}@${FORTIGATE_IP}" << 'EOF'
config vpn certificate local
edit "fortigate.netintegrate.net"
set certificate "-----BEGIN CERTIFICATE-----
MIIF1zCCA7+gAwIBAgIBXTANBgkqhkiG9w0BAQsFADB1MQswCQYDVQQGEwJVUzEQ
MA4GA1UECAwHR2VvcmdpYTEVMBMGA1UECgwMTmV0SW50ZWdyYXRlMRYwFAYDVQQL
DA1JVCBEZXBhcnRtZW50MSUwIwYDVQQDDBxOZXRJbnRlZ3JhdGUgSW50ZXJtZWRp
YXRlIENBMB4XDTI1MTAxODAyMTQ1OFoXDTI2MTAyODAyMTQ1OFowga8xCzAJBgNV
BAYTAlVTMRAwDgYDVQQIDAdHZW9yZ2lhMRAwDgYDVQQHDAdBdGxhbnRhMSwwKgYD
VQQKDCNOZXQtSW50ZWdyYXRlIENlcnRpZmljYXRlIEF1dGhvcml0eTEpMCcGA1UE
CwwgTmV0LUludGVncmF0ZSBTZXJ2ZXIgQ2VydGlmaWNhdGUxIzAhBgNVBAMMGmZv
cnRpZ2F0ZS5uZXRpbnRlZ3JhdGUubmV0MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8A
MIIBCgKCAQEArXilaysedqMfKBmNo2OCzuOG1L0YrS9TbIujg3oTPc6tcQpQsdZ7
l65VmqOgSMDvII3k4AWaZv9tclU8vGqU1fPFx7ocv9o5iph/AXMsZRAVtEEkexsr
0iWElnt2JoYgkH8OyCLUxSVOG3O6o2wdUGJHMQo++y03o8O6cL0A3/lr+BWRvIm0
aXy6qT09uTKt9SwpTqhUqxJFexOlOaVEBi93MxzLylfhcCkzq0+vAQqt5JmK3QGS
mNymGbw889XMmOmSIenwAf6e/Rx5aRx1dQ23bwOvXnwiOR5RY9bO6u9qSZUvlEoa
229W1gF6QAyUuqM0J7BVKHDt03oEX6Q5sQIDAQABo4IBNTCCATEwCQYDVR0TBAIw
ADARBglghkgBhvhCAQEEBAMCBkAwHQYDVR0OBBYEFFR+1QPeF5+Gn/o3S1y6upzL
I/NCMIGlBgNVHSMEgZ0wgZqAFFc9OV4MV2zc9jq919/i60kCdzwFoX6kfDB6MQsw
CQYDVQQGEwJVUzEQMA4GA1UECAwHR2VvcmdpYTEQMA4GA1UEBwwHQXRsYW50YTEV
MBMGA1UECgwMTmV0SW50ZWdyYXRlMREwDwYDVQQLDAhTZWN1cml0eTEdMBsGA1UE
AwwUTmV0SW50ZWdyYXRlIFJvb3QgQ0GCAhABMA4GA1UdDwEB/wQEAwIFoDATBgNV
HSUEDDAKBggrBgEFBQcDATAlBgNVHREEHjAcghpmb3J0aWdhdGUubmV0aW50ZWdy
YXRlLm5ldDANBgkqhkiG9w0BAQsFAAOCAgEAB5GqSqaarRoULu1NvE511XbTTn6r
ObTKZd7l8OWu8V0e5Wftuk4hchpcSxbUNagfuN1AK1mQdonMdjG3uoKHRNY/qLk2
WxXW/DChnYF+p/AQJ0gIhwZaXy7fgAVrKals7psFBIeKi+g5GDu7hGV9t63h30lw
e2lcdRxBouCKx1d570Smbq3hoz72xBTRJ4cx4so1WBAZvHVkvfxMk8BlbU9HtYJH
L+pwKDeOEEqTaw5FfNi5osKjLRz6tACbQ2pNAbU1Iu4KT8/XF+XYYxJbjJFGOMzV
eYVxCnKg8MErsm6bPW8eFCAtfrO1ey4SSr/caq6MKUK1eW6K9XDKQCJqahG1Gyqa
3JhA4jelNkG9iTtgxxiZwyoT6G+A/4MvDktXfdmOAqo/6N5jfGXotni74Yha740C
nqcLPgeylw99mtdGbYpWkT5feoGXj8KPuRq+0jperWlpxVbLcotDAgWQPiHQenIh
n0QEUf4YC8u4AY5nhLyj1lZLH3pQU4syjW4l/ZOcK/hPOeWaKyn3jCLRU87s0HAn
x2kd8k5ByIxxQ4UkCvVPOUZrNgwpbaIVNXr85WIdoRm5D9AeU5DutKZELjZ0LOe+
BxtUDTLrzhRq1HfLerEKnH2bTd294zm8PgM8F9Cy/JffA9XwR34rY+YWQ7f9oF7D
gBXlPB7b7j8a0SM=
-----END CERTIFICATE-----"
set private-key "-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQCteKVrKx52ox8o
GY2jY4LO44bUvRitL1Nsi6ODehM9zq1xClCx1nuXrlWao6BIwO8gjeTgBZpm/21y
VTy8apTV88XHuhy/2jmKmH8BcyxlEBW0QSR7GyvSJYSWe3YmhiCQfw7IItTFJU4b
c7qjbB1QYkcxCj77LTejw7pwvQDf+Wv4FZG8ibRpfLqpPT25Mq31LClOqFSrEkV7
E6U5pUQGL3czHMvKV+FwKTOrT68BCq3kmYrdAZKY3KYZvDzz1cyY6ZIh6fAB/p79
HHlpHHV1DbdvA69efCI5HlFj1s7q72pJlS+UShrbb1bWAXpADJS6ozQnsFUocO3T
egRfpDmxAgMBAAECggEAQZLRCP1QMy1/WhOqwGAd8uH8Nk/S06iHowj4Avuy6VLG
qmvpTAhVSOWcM2v163qPCiHJKkvD7XpRn34MCvdJEsVm9pRqSLWPuc3ieKRWXE+j
vLNBPI3tVy9aet3psC9UgPqellXgUzPCXks1epAkVp4H5khGvYD+vtd+kx5HBeKt
Zl6llUwSGs+H88KfxRqnP8X0h0+QWROAFl4VbKt2eUfvAlq83Vslc7WQstPH68Fv
JRyWJTKlM84JLpS2tncI5ce1o9N7UN6CYZgvysphKxYFmqRPllTX9Hj576jY2yiW
4mzObTS5cKBUqHKX+kBpmON7Ts2IsNFl9XSZY7aQfwKBgQDpDHsKTp5LTptl81//
McOY8U4Cls56uZk55iwIc5Rb3lrzMvnls8CMf8hSghaZTNiDjgrk87vRV0VQp8p9
C90ICONGsw2GrrPp/JHjzkYg6rJa7LwTsFtBxG8HcT8bBf998hUHZtmGgRfSFk2F
qFRbP7KOW/26bRPM4tV+NoKmgwKBgQC+jiAM3OQIiy9CWtmd6UNbXKw97Lt6q8TZ
243PaTblnbzb5TWi9HQzD8rfWT0GRS7v6U13UwYV17SJZr5nbDK++/6M6WQB/Eop
dK92CoAl86DyLe1fYHolX2Sb1HD6ME5Yo1T5aZ21yKE8VUY9LXhvx8JlwVr4Xx1X
bkND/xWIuwKBgQDl/Zgr2tyjS0dXPPEfI1h6RqILMhNB0IqkNkB8crwWUgGGA2fV
xiifP7hNnO56ifkfE34y50sS1MKmT4EpGR0gQc0yR6Bwq1cI82Zy4G4bLCOqUflm
oOPequI8AQobPDchb1hLfrfr4tjET5hf8HiXuOwZTDXB1sX0rGOvdFJJywKBgFd+
0uCVHG9/2TdSl9GWJcNxjfTxGjR9YmnWEgtGeFp+TxV47WPhculvOuvLAeY7Jg4q
xdMgYA7veIoOjybV24cuFfeFwtHWkgbu+RHuSGEkuKX6yJ+eoPdAEeYraaS3QYIZ
nQ7Ym/24HbCiRxoYItDQnEY0vhyFL+fRTTmPise5AoGAFujXXGVf3b75bbjMDImO
0jD52Ak/mS0hApOign67Awp9G2Zw8Gl693Leo2w6b2C8YjGaC7RKMm8GiKbSbLvp
DFa91xnRhjz5gxzucxbgt3cwe7FbLzO498kFXC7ihmiA1UqapKX/JtUeOrN2CE6i
GKxC1zoyeano6stp3FoSJvw=
-----END PRIVATE KEY-----"
next
end
EOF

if [ $? -eq 0 ]; then
    echo "✅ Server certificate and private key installed"
else
    echo "❌ Failed to install server certificate"
    exit 1
fi

echo ""
echo "🔄 Step 4: Configuring HTTPS to use new certificate..."

# Configure HTTPS to use the new certificate
sshpass -p "${FORTIGATE_PASS}" ssh -o StrictHostKeyChecking=no "${FORTIGATE_USER}@${FORTIGATE_IP}" << 'EOF'
config system global
set admin-server-cert "fortigate.netintegrate.net"
end
EOF

if [ $? -eq 0 ]; then
    echo "✅ HTTPS configured to use new certificate"
else
    echo "❌ Failed to configure HTTPS certificate"
    exit 1
fi

echo ""
echo "🔄 Step 5: Verifying certificate installation..."

# List installed certificates
echo "📋 Installed certificates:"
sshpass -p "${FORTIGATE_PASS}" ssh -o StrictHostKeyChecking=no "${FORTIGATE_USER}@${FORTIGATE_IP}" 'show vpn certificate local'

echo ""
echo "✅ Certificate installation completed successfully!"
echo ""
echo "🎯 Next steps:"
echo "1. Wait a few seconds for FortiGate to apply changes"
echo "2. Test the dashboard API connection"
echo "3. The FortiGate will now use the CA-signed certificate"
echo ""
echo "🧪 Test commands:"
echo "   curl http://localhost:59169/api/test"
echo "   curl http://localhost:59169/api/overview"