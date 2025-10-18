# Copilot Instructions for AI Coding Agents

## Project Overview
- **Purpose:** Real-time monitoring and management dashboard for Fortinet infrastructure (FortiAP, FortiSwitch, FortiGate).
- **Stack:** Node.js (Express), YAML for fallback data, minimal dependencies.
- **Key Files:**
  - `server.js`: Express server, all API endpoints.
  - `app.js`: Core FortiGate integration logic.
  - `data-transformer.js`: Normalizes FortiGate API data.
  - `fortinet-api-client.js`: API client with retry/session logic.
  - `policy-analyzer.js`: Firewall policy analysis.
  - `network-topology.js`: Network topology generation.
  - `index.html`, `style.css`: Main dashboard UI.
  - `dashboard_data.yaml`, `data/`: Fallback/test data.

## Architecture & Data Flow
- **Client** (browser) → **Express API** (`server.js`) → **FortiGate API** (live) or **YAML fallback**
- **Data normalization** via `data-transformer.js` before sending to client
- **Session-based authentication** with FortiGate (see `.env`)
- **Fallback**: If FortiGate is unreachable, YAML data is served

## Developer Workflows
- **Install:** `npm install`
- **Run (dev):** `node server.js` (default port: 59169)
- **Config:** Copy `.env.example` to `.env` and fill in FortiGate details
- **Test endpoints:** Use `curl` or browser (see README for examples)
- **Certificate automation:**
  - Generate: `node generate-fortigate-cert.js`
  - Install (SSH): `./install-fortigate-cert.sh`
  - Install (API): `node automate-cert-install.js`
- **Fallback data:** Test with `/api/fallback-overview` if FortiGate is offline

## Project Conventions
- **API endpoints**: All under `/api/`, see README for full list
- **YAML fallback**: Used for offline/dev mode, keep in sync with real API structure
- **Minimal dependencies**: Only use new packages if justified
- **Session handling**: Use session-based auth by default, token as alternative
- **Error handling**: Return clear JSON errors, fallback gracefully
- **No frontend build step**: Static HTML/CSS/JS only

## Integration Points
- **FortiGate API**: Main data source, see README for required endpoints/permissions
- **Certificates**: Automated scripts for CA-signed certs, see `generate-fortigate-cert.js` and `install-fortigate-cert.sh`
- **YAML data**: For dev/offline, structure must match live API

## Examples
- **API usage:** `curl http://localhost:59169/api/overview`
- **Simulate packet:** `curl -X POST http://localhost:59169/api/firewall/simulate -d '{...}'`
- **Fallback:** `curl http://localhost:59169/api/fallback-overview`

## Special Notes
- **Do not commit `.env` or real credentials**
- **Keep fallback YAML data up to date with API changes**
- **Update README.md if adding new endpoints or workflows**
