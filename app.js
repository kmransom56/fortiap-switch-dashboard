// Dashboard Application
class FortDashboard {
    constructor() {
        this.data = null;
        this.charts = {};
        this.currentTab = 'overview';
        this.darkMode = false;
        
        this.init();
    }

    async init() {
        this.setupEventListeners();
        await this.loadData();
        this.render();
        this.setupAutoRefresh();
    }

    setupEventListeners() {
        // Tab navigation
        document.querySelectorAll('.nav-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                this.switchTab(e.target.dataset.tab);
            });
        });

        // Theme toggle
        document.getElementById('themeToggle').addEventListener('click', () => {
            this.toggleTheme();
        });

        // Refresh button
        document.getElementById('refreshBtn').addEventListener('click', () => {
            this.refreshData();
        });

        // Export button
        document.getElementById('exportBtn').addEventListener('click', () => {
            this.exportData();
        });

        // Search and filters
        document.getElementById('apSearchInput')?.addEventListener('input', (e) => {
            this.filterDevices('ap', e.target.value);
        });

        document.getElementById('switchSearchInput')?.addEventListener('input', (e) => {
            this.filterDevices('switch', e.target.value);
        });

        document.getElementById('apStatusFilter')?.addEventListener('change', (e) => {
            this.filterByStatus('ap', e.target.value);
        });

        document.getElementById('switchStatusFilter')?.addEventListener('change', (e) => {
            this.filterByStatus('switch', e.target.value);
        });

        // Modal close
        document.querySelector('.modal-close')?.addEventListener('click', () => {
            this.closeModal();
        });

        document.getElementById('deviceModal')?.addEventListener('click', (e) => {
            if (e.target.id === 'deviceModal') {
                this.closeModal();
            }
        });

        // Time range selector
        document.getElementById('timeRangeSelector')?.addEventListener('change', (e) => {
            this.updateHistoricalCharts(e.target.value);
        });
    }

    async loadData() {
        try {
            console.log('Loading data from API...');
            try {
                // First attempt to load from the real API
                const response = await fetch('/api/overview');
                if (!response.ok) {
                    throw new Error(`Failed to load data: ${response.status} ${response.statusText}`);
                }
                
                const apiData = await response.json();
                
                // Set the data
                this.data = apiData;
                
                console.log('Successfully loaded data from API endpoint');
            } catch (apiError) {
                console.error('Primary API failed, trying fallback endpoint:', apiError);
                
                // If the main API fails, try our special fallback endpoint that serves YAML data
                const fallbackResponse = await fetch('/api/fallback-overview');
                if (!fallbackResponse.ok) {
                    throw new Error(`Fallback endpoint failed: ${fallbackResponse.status}`);
                }
                
                const fallbackData = await fallbackResponse.json();
                
                // Set the data from fallback source
                this.data = fallbackData;
                console.log('Successfully loaded data from fallback endpoint');
            }
            
            // If historical data isn't included in the API response, use the YAML data
            if (!this.data.historical_data || this.data.historical_data.length === 0) {
                await this.loadHistoricalData();
            }
            
            // Calculate system health metrics if not provided by API
            this.calculateSystemHealth();
            
        } catch (error) {
            console.error('All data loading attempts failed:', error);
            
            // Last resort - create minimal data structure to prevent UI errors
            this.data = {
                last_updated: new Date().toISOString(),
                fortiaps: [],
                fortiswitches: [],
                historical_data: [],
                system_health: {
                    alerts: [{
                        device: "System",
                        message: "Failed to load data: " + error.message,
                        severity: "high",
                        type: "error"
                    }],
                    aps_offline: 0,
                    aps_online: 0,
                    total_aps: 0,
                    switches_offline: 0,
                    switches_online: 0,
                    total_switches: 0,
                    total_clients: 0,
                    total_poe_power_budget: 0,
                    total_poe_power_consumption: 0,
                    avg_poe_utilization: 0
                }
            };
            
            console.error('Created minimal data structure to prevent UI errors');
        }
    }

    render() {
        this.updateLastUpdated();
        this.renderOverview();
        this.renderFortiAPs();
        this.renderFortiSwitches();
        this.renderPOEMonitoring();
        this.renderTopology();
        this.renderHistorical();
    }

    switchTab(tabName) {
        // Update active tab
        document.querySelectorAll('.nav-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

        // Update active content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById(tabName).classList.add('active');

        this.currentTab = tabName;

        // Refresh charts when switching to historical tab
        if (tabName === 'historical') {
            setTimeout(() => this.renderHistorical(), 100);
        }
    }

    updateLastUpdated() {
        const lastUpdated = new Date(this.data.last_updated);
        document.getElementById('lastUpdatedTime').textContent = lastUpdated.toLocaleString();
    }

    renderOverview() {
        const health = this.data.system_health;
        
        // Update summary cards
        document.getElementById('totalAPs').textContent = health.total_aps;
        document.getElementById('apsOnline').textContent = health.aps_online;
        document.getElementById('apsOffline').textContent = health.aps_offline;
        
        document.getElementById('totalSwitches').textContent = health.total_switches;
        document.getElementById('switchesOnline').textContent = health.switches_online;
        document.getElementById('switchesOffline').textContent = health.switches_offline;
        
        document.getElementById('totalClients').textContent = health.total_clients;
        document.getElementById('totalPOEPower').textContent = health.total_poe_power_consumption;
        document.getElementById('poeBudget').textContent = health.total_poe_power_budget;

        // Render alerts
        this.renderAlerts();

        // Render overview chart
        this.renderOverviewChart();
    }

    renderAlerts() {
        const alertsList = document.getElementById('alertsList');
        const alerts = this.data.system_health.alerts;
        
        if (alerts.length === 0) {
            alertsList.innerHTML = '<p class="text-center">No active alerts</p>';
            return;
        }

        alertsList.innerHTML = alerts.map(alert => `
            <div class="alert-item ${alert.severity}">
                <div class="alert-icon">
                    <i class="fas ${alert.type === 'error' ? 'fa-exclamation-circle' : 'fa-exclamation-triangle'}"></i>
                </div>
                <div class="alert-content">
                    <div class="alert-device">${alert.device}</div>
                    <div class="alert-message">${alert.message}</div>
                </div>
            </div>
        `).join('');
    }

    renderOverviewChart() {
        const ctx = document.getElementById('overviewChart');
        if (!ctx) return;

        if (this.charts.overview) {
            this.charts.overview.destroy();
        }

        const health = this.data.system_health;
        
        this.charts.overview = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['APs Online', 'APs Offline', 'Switches Online', 'Switches Warning'],
                datasets: [{
                    data: [health.aps_online, health.aps_offline, health.switches_online, 1],
                    backgroundColor: ['#1FB8CD', '#B4413C', '#FFC185', '#D2BA4C']
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom'
                    }
                }
            }
        });
    }

    renderFortiAPs() {
        const apGrid = document.getElementById('apGrid');
        if (!apGrid) return;

        apGrid.innerHTML = this.data.fortiaps.map(ap => `
            <div class="device-card" onclick="dashboard.showDeviceDetails('ap', '${ap.name}')">
                <div class="device-header">
                    <div class="device-title">
                        <h3>${ap.name}</h3>
                        <div class="device-model">${ap.model}</div>
                    </div>
                    <div class="device-status ${ap.status}">${ap.status}</div>
                </div>
                
                <div class="device-info">
                    <div class="info-item">
                        <span class="info-label">IP Address</span>
                        <span class="info-value">${ap.ip_address}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Clients</span>
                        <span class="info-value">${ap.clients_connected}/${ap.clients_limit}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Temperature</span>
                        <span class="info-value">${ap.temperature}°C</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Signal</span>
                        <span class="info-value">${ap.signal_strength} dBm</span>
                    </div>
                </div>
                
                ${ap.status === 'up' ? `
                    <div class="progress-item">
                        <div class="progress-header">
                            <span class="progress-label">2.4GHz Utilization</span>
                            <span class="progress-value">${ap.channel_utilization_2_4ghz}%</span>
                        </div>
                        <div class="progress-bar">
                            <div class="progress-fill ${this.getUtilizationClass(ap.channel_utilization_2_4ghz)}" 
                                 style="width: ${ap.channel_utilization_2_4ghz}%"></div>
                        </div>
                    </div>
                    
                    <div class="progress-item">
                        <div class="progress-header">
                            <span class="progress-label">5GHz Utilization</span>
                            <span class="progress-value">${ap.channel_utilization_5ghz}%</span>
                        </div>
                        <div class="progress-bar">
                            <div class="progress-fill ${this.getUtilizationClass(ap.channel_utilization_5ghz)}" 
                                 style="width: ${ap.channel_utilization_5ghz}%"></div>
                        </div>
                    </div>
                ` : ''}
            </div>
        `).join('');
    }

    renderFortiSwitches() {
        const switchGrid = document.getElementById('switchGrid');
        if (!switchGrid) return;

        switchGrid.innerHTML = this.data.fortiswitches.map(sw => `
            <div class="device-card" onclick="dashboard.showDeviceDetails('switch', '${sw.name}')">
                <div class="device-header">
                    <div class="device-title">
                        <h3>${sw.name}</h3>
                        <div class="device-model">${sw.model}</div>
                    </div>
                    <div class="device-status ${sw.status}">${sw.status}</div>
                </div>
                
                <div class="device-info">
                    <div class="info-item">
                        <span class="info-label">IP Address</span>
                        <span class="info-value">${sw.ip_address}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Ports Up/Down</span>
                        <span class="info-value">${sw.ports_up}/${sw.ports_down}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Temperature</span>
                        <span class="info-value">${sw.temperature}°C</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">POE Power</span>
                        <span class="info-value">${sw.poe_power_consumption}W</span>
                    </div>
                </div>
                
                <div class="progress-item">
                    <div class="progress-header">
                        <span class="progress-label">POE Utilization</span>
                        <span class="progress-value">${sw.poe_power_percentage}%</span>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-fill ${this.getUtilizationClass(sw.poe_power_percentage)}" 
                             style="width: ${sw.poe_power_percentage}%"></div>
                    </div>
                </div>
                
                <div class="progress-item">
                    <div class="progress-header">
                        <span class="progress-label">CPU Usage</span>
                        <span class="progress-value">${sw.cpu_usage}%</span>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-fill ${this.getUtilizationClass(sw.cpu_usage)}" 
                             style="width: ${sw.cpu_usage}%"></div>
                    </div>
                </div>
            </div>
        `).join('');
    }

    renderPOEMonitoring() {
        const health = this.data.system_health;
        const totalBudget = health.total_poe_power_budget;
        const totalConsumption = health.total_poe_power_consumption;
        const utilization = ((totalConsumption / totalBudget) * 100).toFixed(1);

        // Update POE overview
        document.getElementById('poeTotalBudget').textContent = `${totalBudget}W`;
        document.getElementById('poeTotalConsumption').textContent = `${totalConsumption}W`;
        document.getElementById('poeUtilization').textContent = `${utilization}%`;
        
        const progressBar = document.getElementById('poeProgressBar');
        if (progressBar) {
            progressBar.style.width = `${utilization}%`;
            progressBar.className = `progress-fill ${this.getUtilizationClass(parseFloat(utilization))}`;
        }

        // Render POE by switch
        const poeBySwitch = document.getElementById('poeBySwitch');
        if (poeBySwitch) {
            poeBySwitch.innerHTML = this.data.fortiswitches.map(sw => `
                <div class="card">
                    <div class="card__header">
                        <h3>${sw.name}</h3>
                    </div>
                    <div class="card__body">
                        <div class="poe-summary">
                            <div class="poe-stat">
                                <span class="poe-label">Budget:</span>
                                <span class="poe-value">${sw.poe_power_budget}W</span>
                            </div>
                            <div class="poe-stat">
                                <span class="poe-label">Consumption:</span>
                                <span class="poe-value">${sw.poe_power_consumption}W</span>
                            </div>
                            <div class="poe-stat">
                                <span class="poe-label">Ports:</span>
                                <span class="poe-value">${sw.poe_enabled_ports}/${sw.poe_ports}</span>
                            </div>
                        </div>
                        
                        <div class="progress-item">
                            <div class="progress-header">
                                <span class="progress-label">POE Utilization</span>
                                <span class="progress-value">${sw.poe_power_percentage}%</span>
                            </div>
                            <div class="progress-bar">
                                <div class="progress-fill ${this.getUtilizationClass(sw.poe_power_percentage)}" 
                                     style="width: ${sw.poe_power_percentage}%"></div>
                            </div>
                        </div>
                    </div>
                </div>
            `).join('');
        }
    }

    renderTopology() {
        const topologyView = document.getElementById('topologyView');
        if (!topologyView) return;

        const topology = this.data.network_topology;
        const fortigate = topology.fortigate;
        const switches = this.data.fortiswitches;
        const aps = this.data.fortiaps;

        topologyView.innerHTML = `
            <!-- FortiGate -->
            <div class="topology-level">
                <div class="topology-device fortigate">
                    <i class="fas fa-shield-alt"></i>
                    <div><strong>${fortigate.model}</strong></div>
                    <div>${fortigate.ip}</div>
                </div>
            </div>
            
            <!-- Switches -->
            <div class="topology-level">
                ${switches.map(sw => `
                    <div class="topology-device switch ${sw.status === 'down' ? 'offline' : ''}" 
                         onclick="dashboard.showDeviceDetails('switch', '${sw.name}')">
                        <i class="fas fa-sitemap"></i>
                        <div><strong>${sw.name}</strong></div>
                        <div>${sw.model}</div>
                        <div class="status ${sw.status}">${sw.status}</div>
                    </div>
                `).join('')}
            </div>
            
            <!-- Access Points -->
            <div class="topology-level">
                ${aps.map(ap => `
                    <div class="topology-device ap ${ap.status === 'down' ? 'offline' : ''}" 
                         onclick="dashboard.showDeviceDetails('ap', '${ap.name}')">
                        <i class="fas fa-wifi"></i>
                        <div><strong>${ap.name}</strong></div>
                        <div>${ap.model}</div>
                        <div class="status ${ap.status}">${ap.status}</div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    renderHistorical() {
        this.renderClientsChart();
        this.renderPOEChart();
        this.renderTemperatureChart();
        this.renderChannelChart();
    }

    renderClientsChart() {
        const ctx = document.getElementById('clientsChart');
        if (!ctx) return;

        if (this.charts.clients) {
            this.charts.clients.destroy();
        }

        const historical = this.data.historical_data;
        const labels = historical.map(h => new Date(h.timestamp).toLocaleTimeString());
        const data = historical.map(h => h.total_clients);

        this.charts.clients = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Connected Clients',
                    data: data,
                    borderColor: '#1FB8CD',
                    backgroundColor: 'rgba(31, 184, 205, 0.1)',
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
    }

    renderPOEChart() {
        const ctx = document.getElementById('poeChart');
        if (!ctx) return;

        if (this.charts.poe) {
            this.charts.poe.destroy();
        }

        const historical = this.data.historical_data;
        const labels = historical.map(h => new Date(h.timestamp).toLocaleTimeString());
        const data = historical.map(h => h.total_poe_power);

        this.charts.poe = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'POE Power (W)',
                    data: data,
                    borderColor: '#FFC185',
                    backgroundColor: 'rgba(255, 193, 133, 0.1)',
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
    }

    renderTemperatureChart() {
        const ctx = document.getElementById('temperatureChart');
        if (!ctx) return;

        if (this.charts.temperature) {
            this.charts.temperature.destroy();
        }

        const historical = this.data.historical_data;
        const labels = historical.map(h => new Date(h.timestamp).toLocaleTimeString());

        this.charts.temperature = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'AP Temperature (°C)',
                        data: historical.map(h => h.avg_ap_temperature),
                        borderColor: '#B4413C',
                        backgroundColor: 'rgba(180, 65, 60, 0.1)',
                        fill: false,
                        tension: 0.4
                    },
                    {
                        label: 'Switch Temperature (°C)',
                        data: historical.map(h => h.avg_switch_temperature),
                        borderColor: '#D2BA4C',
                        backgroundColor: 'rgba(210, 186, 76, 0.1)',
                        fill: false,
                        tension: 0.4
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top'
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Temperature (°C)'
                        }
                    }
                }
            }
        });
    }

    renderChannelChart() {
        const ctx = document.getElementById('channelChart');
        if (!ctx) return;

        if (this.charts.channel) {
            this.charts.channel.destroy();
        }

        const historical = this.data.historical_data;
        const labels = historical.map(h => new Date(h.timestamp).toLocaleTimeString());

        this.charts.channel = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: '2.4GHz Utilization (%)',
                        data: historical.map(h => h.avg_channel_utilization_2_4),
                        borderColor: '#5D878F',
                        backgroundColor: 'rgba(93, 135, 143, 0.1)',
                        fill: false,
                        tension: 0.4
                    },
                    {
                        label: '5GHz Utilization (%)',
                        data: historical.map(h => h.avg_channel_utilization_5),
                        borderColor: '#964325',
                        backgroundColor: 'rgba(150, 67, 37, 0.1)',
                        fill: false,
                        tension: 0.4
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top'
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100,
                        title: {
                            display: true,
                            text: 'Utilization (%)'
                        }
                    }
                }
            }
        });
    }

    showDeviceDetails(type, name) {
        const device = type === 'ap' ? 
            this.data.fortiaps.find(ap => ap.name === name) :
            this.data.fortiswitches.find(sw => sw.name === name);

        if (!device) return;

        const modal = document.getElementById('deviceModal');
        const modalTitle = document.getElementById('modalTitle');
        const modalBody = document.getElementById('modalBody');

        modalTitle.textContent = `${device.name} Details`;

        if (type === 'ap') {
            modalBody.innerHTML = this.renderAPDetails(device);
        } else {
            modalBody.innerHTML = this.renderSwitchDetails(device);
        }

        modal.classList.add('active');
    }

    renderAPDetails(ap) {
        return `
            <div class="modal-section">
                <h4>Basic Information</h4>
                <div class="modal-grid">
                    <div class="info-item">
                        <span class="info-label">Model</span>
                        <span class="info-value">${ap.model}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Serial</span>
                        <span class="info-value">${ap.serial}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">IP Address</span>
                        <span class="info-value">${ap.ip_address}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Status</span>
                        <span class="info-value">
                            <span class="device-status ${ap.status}">${ap.status}</span>
                        </span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Firmware</span>
                        <span class="info-value">${ap.firmware_version}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Uptime</span>
                        <span class="info-value">${ap.uptime}</span>
                    </div>
                </div>
            </div>
            
            ${ap.status === 'up' ? `
            <div class="modal-section">
                <h4>Wireless Information</h4>
                <div class="modal-grid">
                    <div class="info-item">
                        <span class="info-label">2.4GHz Channel</span>
                        <span class="info-value">${ap.channel_2_4ghz}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">5GHz Channel</span>
                        <span class="info-value">${ap.channel_5ghz}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">2.4GHz Utilization</span>
                        <span class="info-value">${ap.channel_utilization_2_4ghz}%</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">5GHz Utilization</span>
                        <span class="info-value">${ap.channel_utilization_5ghz}%</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Signal Strength</span>
                        <span class="info-value">${ap.signal_strength} dBm</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Noise Level</span>
                        <span class="info-value">${ap.noise_level} dBm</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Clients</span>
                        <span class="info-value">${ap.clients_connected}/${ap.clients_limit}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">SSIDs</span>
                        <span class="info-value">${ap.ssids.join(', ') || 'None'}</span>
                    </div>
                </div>
            </div>
            
            <div class="modal-section">
                <h4>System Status</h4>
                <div class="modal-grid">
                    <div class="info-item">
                        <span class="info-label">Temperature</span>
                        <span class="info-value">${ap.temperature}°C</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">CPU Usage</span>
                        <span class="info-value">${ap.cpu_usage}%</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Memory Usage</span>
                        <span class="info-value">${ap.memory_usage}%</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Interfering APs</span>
                        <span class="info-value">${ap.interfering_aps}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Rogue APs</span>
                        <span class="info-value">${ap.rogue_aps}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Login Failures</span>
                        <span class="info-value">${ap.login_failures}</span>
                    </div>
                </div>
            </div>
            ` : ''}
        `;
    }

    renderSwitchDetails(sw) {
        return `
            <div class="modal-section">
                <h4>Basic Information</h4>
                <div class="modal-grid">
                    <div class="info-item">
                        <span class="info-label">Model</span>
                        <span class="info-value">${sw.model}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Serial</span>
                        <span class="info-value">${sw.serial}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">IP Address</span>
                        <span class="info-value">${sw.ip_address}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Status</span>
                        <span class="info-value">
                            <span class="device-status ${sw.status}">${sw.status}</span>
                        </span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Firmware</span>
                        <span class="info-value">${sw.firmware_version}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Uptime</span>
                        <span class="info-value">${sw.uptime}</span>
                    </div>
                </div>
            </div>
            
            <div class="modal-section">
                <h4>Port Information</h4>
                <div class="modal-grid">
                    <div class="info-item">
                        <span class="info-label">Total Ports</span>
                        <span class="info-value">${sw.total_ports}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Ports Up</span>
                        <span class="info-value">${sw.ports_up}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Ports Down</span>
                        <span class="info-value">${sw.ports_down}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">FortiLink Status</span>
                        <span class="info-value">
                            <span class="device-status ${sw.fortilink_status}">${sw.fortilink_status}</span>
                        </span>
                    </div>
                </div>
            </div>
            
            <div class="modal-section">
                <h4>POE Information</h4>
                <div class="modal-grid">
                    <div class="info-item">
                        <span class="info-label">POE Ports</span>
                        <span class="info-value">${sw.poe_ports}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">POE Enabled</span>
                        <span class="info-value">${sw.poe_enabled_ports}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Power Budget</span>
                        <span class="info-value">${sw.poe_power_budget}W</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Power Consumption</span>
                        <span class="info-value">${sw.poe_power_consumption}W</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">POE Utilization</span>
                        <span class="info-value">${sw.poe_power_percentage}%</span>
                    </div>
                </div>
            </div>
            
            <div class="modal-section">
                <h4>System Status</h4>
                <div class="modal-grid">
                    <div class="info-item">
                        <span class="info-label">Temperature</span>
                        <span class="info-value">${sw.temperature}°C</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">CPU Usage</span>
                        <span class="info-value">${sw.cpu_usage}%</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Memory Usage</span>
                        <span class="info-value">${sw.memory_usage}%</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Fan Status</span>
                        <span class="info-value">
                            <span class="device-status ${sw.fan_status === 'ok' ? 'up' : 'warning'}">${sw.fan_status}</span>
                        </span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Power Supply 1</span>
                        <span class="info-value">
                            <span class="device-status ${sw.power_supply_1 === 'ok' ? 'up' : 'warning'}">${sw.power_supply_1}</span>
                        </span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Power Supply 2</span>
                        <span class="info-value">
                            <span class="device-status ${sw.power_supply_2 === 'ok' ? 'up' : sw.power_supply_2 === 'n/a' ? 'info' : 'warning'}">${sw.power_supply_2}</span>
                        </span>
                    </div>
                </div>
            </div>
            
            ${sw.ports && sw.ports.length > 0 ? `
            <div class="modal-section">
                <h4>Port Details</h4>
                <div style="overflow-x: auto;">
                    <table style="width: 100%; border-collapse: collapse; margin-top: 12px;">
                        <thead>
                            <tr style="border-bottom: 1px solid var(--color-border);">
                                <th style="text-align: left; padding: 8px;">Port</th>
                                <th style="text-align: left; padding: 8px;">Device</th>
                                <th style="text-align: left; padding: 8px;">Status</th>
                                <th style="text-align: left; padding: 8px;">Speed</th>
                                <th style="text-align: left; padding: 8px;">POE Status</th>
                                <th style="text-align: left; padding: 8px;">POE Power</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${sw.ports.map(port => `
                                <tr style="border-bottom: 1px solid var(--color-card-border);">
                                    <td style="padding: 8px; font-weight: 500;">${port.port}</td>
                                    <td style="padding: 8px;">${port.device || '-'}</td>
                                    <td style="padding: 8px;">
                                        <span class="device-status ${port.status}">${port.status}</span>
                                    </td>
                                    <td style="padding: 8px;">${port.speed}</td>
                                    <td style="padding: 8px;">
                                        <span class="device-status ${port.poe_status === 'enabled' ? 'up' : 'down'}">${port.poe_status}</span>
                                    </td>
                                    <td style="padding: 8px;">${port.poe_power}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
            ` : ''}
        `;
    }

    closeModal() {
        document.getElementById('deviceModal').classList.remove('active');
    }

    getUtilizationClass(percentage) {
        if (percentage < 50) return 'low';
        if (percentage < 80) return 'medium';
        return 'high';
    }

    filterDevices(type, searchTerm) {
        const cards = document.querySelectorAll(`#${type}Grid .device-card`);
        const search = searchTerm.toLowerCase();
        
        cards.forEach(card => {
            const title = card.querySelector('.device-title h3').textContent.toLowerCase();
            const model = card.querySelector('.device-model').textContent.toLowerCase();
            
            if (title.includes(search) || model.includes(search)) {
                card.style.display = 'block';
            } else {
                card.style.display = 'none';
            }
        });
    }

    filterByStatus(type, status) {
        const cards = document.querySelectorAll(`#${type}Grid .device-card`);
        
        cards.forEach(card => {
            const deviceStatus = card.querySelector('.device-status').textContent;
            
            if (status === 'all' || deviceStatus === status) {
                card.style.display = 'block';
            } else {
                card.style.display = 'none';
            }
        });
    }

    toggleTheme() {
        this.darkMode = !this.darkMode;
        document.documentElement.setAttribute('data-color-scheme', this.darkMode ? 'dark' : 'light');
        
        const themeIcon = document.querySelector('#themeToggle i');
        themeIcon.className = this.darkMode ? 'fas fa-sun' : 'fas fa-moon';
    }

    async refreshData() {
        const refreshBtn = document.getElementById('refreshBtn');
        const refreshIcon = refreshBtn.querySelector('i');
        
        refreshIcon.classList.add('fa-spin');
        refreshBtn.disabled = true;
        
        try {
            await this.loadData();
            this.render();
        } catch (error) {
            console.error('Error refreshing data:', error);
            alert('Failed to refresh data. Please try again.');
        }
        
        refreshIcon.classList.remove('fa-spin');
        refreshBtn.disabled = false;
    }

    exportData() {
        const exportData = {
            timestamp: new Date().toISOString(),
            system_health: this.data.system_health,
            devices: {
                fortiaps: this.data.fortiaps,
                fortiswitches: this.data.fortiswitches
            }
        };
        
        const dataStr = JSON.stringify(exportData, null, 2);
        const dataBlob = new Blob([dataStr], {type: 'application/json'});
        
        const link = document.createElement('a');
        link.href = URL.createObjectURL(dataBlob);
        link.download = `fortinet-dashboard-export-${new Date().toISOString().split('T')[0]}.json`;
        link.click();
    }

    updateHistoricalCharts(timeRange) {
        // In a real application, you would filter the data based on the time range
        // For now, we'll just re-render with the existing data
        this.renderHistorical();
    }

    setupAutoRefresh() {
        // Auto-refresh every 30 seconds
        setInterval(() => {
            this.refreshData();
        }, 30000);
    }

    async loadHistoricalData() {
        try {
            // This would typically come from an API endpoint that provides historical data
            // For now, we'll use the static YAML data or generate simulated data
            const response = await fetch('/dashboard_data.yaml');
            if (response.ok) {
                const yamlData = await response.text();
                // This is a simplified approach. In a real app, you'd use a YAML parser
                // For now, we're assuming the data is properly structured
                this.data.historical_data = this.parseHistoricalDataFromYaml(yamlData);
            } else {
                // If YAML isn't available, generate some mock historical data
                this.data.historical_data = this.generateMockHistoricalData();
            }
        } catch (error) {
            console.error('Error loading historical data:', error);
            this.data.historical_data = this.generateMockHistoricalData();
        }
    }
    
    parseHistoricalDataFromYaml(yamlText) {
        // This is a simplified parsing approach for demo purposes
        // In a real app, you would use a proper YAML parser
        const historicalData = [];
        
        try {
            // Look for the historical_data section
            const historicalSection = yamlText.split('historical_data:')[1];
            if (historicalSection) {
                const entries = historicalSection.split('- ');
                
                for (let i = 1; i < entries.length; i++) {
                    const entry = entries[i];
                    const lines = entry.split('\n');
                    const dataPoint = {};
                    
                    for (const line of lines) {
                        if (!line.trim()) continue;
                        if (!line.includes(':')) continue;
                        
                        const [key, value] = line.split(':').map(s => s.trim());
                        if (key && value !== undefined) {
                            // Convert numeric values
                            const numValue = Number(value);
                            dataPoint[key] = isNaN(numValue) ? value.replace(/^['"](.*)['"]$/, '$1') : numValue;
                        }
                    }
                    
                    if (Object.keys(dataPoint).length > 0) {
                        historicalData.push(dataPoint);
                    }
                }
            }
        } catch (error) {
            console.error('Error parsing YAML historical data:', error);
        }
        
        return historicalData.length > 0 ? historicalData : this.generateMockHistoricalData();
    }
    
    generateMockHistoricalData() {
        const historicalData = [];
        const now = new Date();
        
        // Generate 24 hours of historical data, one point per hour
        for (let i = 24; i > 0; i--) {
            const timestamp = new Date(now.getTime() - (i * 60 * 60 * 1000)).toISOString();
            
            historicalData.push({
                avg_ap_temperature: Math.floor(Math.random() * 15) + 40, // 40-55°C
                avg_channel_utilization_2_4: Math.floor(Math.random() * 50), // 0-50%
                avg_channel_utilization_5: Math.floor(Math.random() * 30), // 0-30%
                avg_switch_temperature: Math.floor(Math.random() * 20) + 45, // 45-65°C
                timestamp: timestamp,
                total_clients: Math.floor(Math.random() * 30) + 15, // 15-45 clients
                total_poe_power: Math.floor(Math.random() * 300) + 400 // 400-700W
            });
        }
        
        return historicalData;
    }
    
    async loadFallbackData() {
        console.warn('Loading fallback data from YAML...');
        
        try {
            const response = await fetch('/dashboard_data.yaml');
            if (!response.ok) {
                throw new Error('Failed to load YAML data');
            }
            
            const yamlText = await response.text();
            this.data = this.parseYamlData(yamlText);
            
            // Make sure we have a last_updated timestamp
            if (!this.data.last_updated) {
                this.data.last_updated = new Date().toISOString();
            }
            
            // Calculate system health if needed
            this.calculateSystemHealth();
            
        } catch (error) {
            console.error('Error loading fallback data:', error);
            alert('Failed to load data. Please check your connection and try again.');
            
            // Create minimal data structure to prevent rendering errors
            this.data = {
                fortiaps: [],
                fortiswitches: [],
                historical_data: [],
                last_updated: new Date().toISOString(),
                system_health: {
                    alerts: [{
                        device: "System",
                        message: "Failed to load data",
                        severity: "high",
                        type: "error"
                    }],
                    aps_offline: 0,
                    aps_online: 0,
                    total_aps: 0,
                    switches_offline: 0,
                    switches_online: 0,
                    total_switches: 0,
                    total_clients: 0,
                    total_poe_power_budget: 0,
                    total_poe_power_consumption: 0,
                    avg_poe_utilization: 0
                }
            };
        }
    }
    
    parseYamlData(yamlText) {
        // This is a simplified parsing approach for demo purposes
        // In a real app, you would use a proper YAML parser
        const data = {
            fortiaps: [],
            fortiswitches: [],
            historical_data: [],
            last_updated: new Date().toISOString()
        };
        
        try {
            // Parse FortiAPs
            if (yamlText.includes('fortiaps:')) {
                const fortiapsSection = yamlText.split('fortiaps:')[1].split('fortiswitches:')[0];
                const fortiapEntries = fortiapsSection.split('- ');
                
                for (let i = 1; i < fortiapEntries.length; i++) {
                    const entry = fortiapEntries[i];
                    const ap = this.parseYamlEntity(entry);
                    if (Object.keys(ap).length > 0) {
                        data.fortiaps.push(ap);
                    }
                }
            }
            
            // Parse FortiSwitches
            if (yamlText.includes('fortiswitches:')) {
                const fortiswitchesSection = yamlText.split('fortiswitches:')[1].split('historical_data:')[0];
                const fortiswitchEntries = fortiswitchesSection.split('- ');
                
                for (let i = 1; i < fortiswitchEntries.length; i++) {
                    const entry = fortiswitchEntries[i];
                    const sw = this.parseYamlEntity(entry);
                    
                    // Parse ports if present
                    if (entry.includes('ports:')) {
                        sw.ports = [];
                        const portsSection = entry.split('ports:')[1].split('ports_down:')[0];
                        const portEntries = portsSection.split('- ');
                        
                        for (let j = 1; j < portEntries.length; j++) {
                            const portEntry = portEntries[j];
                            const port = this.parseYamlEntity(portEntry);
                            if (Object.keys(port).length > 0) {
                                sw.ports.push(port);
                            }
                        }
                    }
                    
                    if (Object.keys(sw).length > 0) {
                        data.fortiswitches.push(sw);
                    }
                }
            }
            
            // Parse historical data
            if (yamlText.includes('historical_data:')) {
                const historicalSection = yamlText.split('historical_data:')[1];
                const historicalEntries = historicalSection.split('- ');
                
                for (let i = 1; i < historicalEntries.length; i++) {
                    const entry = historicalEntries[i];
                    const dataPoint = this.parseYamlEntity(entry);
                    if (Object.keys(dataPoint).length > 0) {
                        data.historical_data.push(dataPoint);
                    }
                }
            }
            
        } catch (error) {
            console.error('Error parsing YAML data:', error);
        }
        
        return data;
    }
    
    parseYamlEntity(entityText) {
        const entity = {};
        const lines = entityText.split('\n');
        
        for (const line of lines) {
            if (!line.trim() || !line.includes(':')) continue;
            
            let [key, value] = line.split(':', 2).map(s => s.trim());
            
            if (!key || value === undefined) continue;
            
            // Handle nested arrays
            if (value === '') {
                if (lines.indexOf(line) < lines.length - 1 && lines[lines.indexOf(line) + 1].trim().startsWith('- ')) {
                    const arrayItems = [];
                    let arrayIndex = lines.indexOf(line) + 1;
                    
                    while (arrayIndex < lines.length && lines[arrayIndex].trim().startsWith('- ')) {
                        arrayItems.push(lines[arrayIndex].trim().substring(2));
                        arrayIndex++;
                    }
                    
                    entity[key] = arrayItems;
                    continue;
                }
            }
            
            // Convert numeric and boolean values
            if (!isNaN(Number(value))) {
                entity[key] = Number(value);
            } else if (value.toLowerCase() === 'true') {
                entity[key] = true;
            } else if (value.toLowerCase() === 'false') {
                entity[key] = false;
            } else if (value === '[]') {
                entity[key] = [];
            } else {
                // Remove quotes from string values
                entity[key] = value.replace(/^['"](.*)['"]$/, '$1');
            }
        }
        
        return entity;
    }
    
    calculateSystemHealth() {
        // If system health data is not provided by the API, calculate it
        if (!this.data.system_health) {
            const fortiaps = this.data.fortiaps || [];
            const fortiswitches = this.data.fortiswitches || [];
            
            const apsOnline = fortiaps.filter(ap => ap.status === 'up').length;
            const switchesOnline = fortiswitches.filter(sw => sw.status === 'up').length;
            const switchesWarning = fortiswitches.filter(sw => sw.status === 'warning').length;
            
            let totalPoeConsumption = 0;
            let totalPoeBudget = 0;
            let totalClients = 0;
            
            fortiswitches.forEach(sw => {
                if (sw.poe_power_consumption) totalPoeConsumption += sw.poe_power_consumption;
                if (sw.poe_power_budget) totalPoeBudget += sw.poe_power_budget;
            });
            
            fortiaps.forEach(ap => {
                if (ap.clients_connected) totalClients += ap.clients_connected;
            });
            
            const avgPoeUtilization = totalPoeBudget ? ((totalPoeConsumption / totalPoeBudget) * 100).toFixed(1) : 0;
            
            // Generate alerts
            const alerts = [];
            
            fortiswitches.forEach(sw => {
                if (sw.status === 'warning' || sw.status === 'down') {
                    alerts.push({
                        device: sw.name,
                        message: `Switch ${sw.status === 'down' ? 'offline' : 'in warning state'}`,
                        severity: sw.status === 'down' ? 'high' : 'medium',
                        type: sw.status === 'down' ? 'error' : 'warning'
                    });
                }
                
                if (sw.temperature > 65) {
                    alerts.push({
                        device: sw.name,
                        message: `High temperature (${sw.temperature}°C)`,
                        severity: 'medium',
                        type: 'warning'
                    });
                }
                
                if (sw.poe_power_percentage > 80) {
                    alerts.push({
                        device: sw.name,
                        message: `PoE utilization at ${sw.poe_power_percentage}%`,
                        severity: 'medium',
                        type: 'warning'
                    });
                }
                
                if (sw.fan_status === 'warning') {
                    alerts.push({
                        device: sw.name,
                        message: `Fan issue detected`,
                        severity: 'medium',
                        type: 'warning'
                    });
                }
            });
            
            fortiaps.forEach(ap => {
                if (ap.status === 'down') {
                    alerts.push({
                        device: ap.name,
                        message: `Device offline${ap.last_seen ? ' since ' + new Date(ap.last_seen).toLocaleString() : ''}`,
                        severity: 'high',
                        type: 'error'
                    });
                }
                
                if (ap.temperature > 60) {
                    alerts.push({
                        device: ap.name,
                        message: `High temperature (${ap.temperature}°C)`,
                        severity: 'medium',
                        type: 'warning'
                    });
                }
                
                if (ap.interfering_aps > 5) {
                    alerts.push({
                        device: ap.name,
                        message: `High interference (${ap.interfering_aps} APs detected)`,
                        severity: 'low',
                        type: 'info'
                    });
                }
            });
            
            this.data.system_health = {
                alerts,
                aps_offline: fortiaps.length - apsOnline,
                aps_online: apsOnline,
                avg_poe_utilization: parseFloat(avgPoeUtilization),
                switches_offline: fortiswitches.length - switchesOnline - switchesWarning,
                switches_online: switchesOnline,
                total_aps: fortiaps.length,
                total_clients: totalClients,
                total_poe_power_budget: totalPoeBudget,
                total_poe_power_consumption: totalPoeConsumption,
                total_switches: fortiswitches.length
            };
        }
    }
}

// Initialize dashboard
const dashboard = new FortDashboard();