// Dashboard Application with Embedded Data
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
            console.log('Loading embedded data...');
            
            // Use embedded data instead of API calls
            this.data = dashboardData;
            
            // Add last_updated if not present
            if (!this.data.last_updated) {
                this.data.last_updated = new Date().toISOString();
            }
            
            // Calculate system health if not already present
            if (!this.data.system_health) {
                this.calculateSystemHealth();
            }
            
            console.log('Successfully loaded embedded data');
        } catch (error) {
            console.error('Error loading data:', error);
            
            // Create minimal data to prevent UI errors
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

    calculateSystemHealth() {
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
        
        // Create topology data
        this.data.network_topology = {
            connections: [
                {
                    from: "FortiGate-61E",
                    interface: "fortilink",
                    status: "up",
                    to: "Core-Switch-1"
                }
            ],
            fortigate: {
                fortilink_interface: "fortilink",
                ip: "192.168.0.254",
                model: "FortiGate-61E"
            }
        };
        
        // Add connections between switches and APs
        const switchMap = {};
        this.data.fortiswitches.forEach(sw => {
            switchMap[sw.name] = sw;
        });
        
        // Add connections between core switch and other switches
        this.data.fortiswitches.forEach(sw => {
            if (sw.name !== "Core-Switch-1") {
                this.data.network_topology.connections.push({
                    from: "Core-Switch-1",
                    port: `port${Math.floor(Math.random() * 8) + 1}`,
                    status: "up",
                    to: sw.name
                });
            }
        });
        
        // Add connections between switches and APs
        this.data.fortiaps.forEach(ap => {
            const randomSwitch = this.data.fortiswitches[Math.floor(Math.random() * this.data.fortiswitches.length)];
            if (randomSwitch) {
                this.data.network_topology.connections.push({
                    from: randomSwitch.name,
                    port: `port${Math.floor(Math.random() * 8) + 10}`,
                    status: ap.status,
                    to: ap.name
                });
            }
        });
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

    // Remaining methods from app.js (renderPOEMonitoring, renderTopology, renderHistorical, etc.)
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
                        <span class="info-value">${ap.ssids?.join(', ') || 'None'}</span>
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
}

// Embedded data - this is what makes our dashboard completely standalone
const dashboardData = {
    "fortiaps": [
        {
            "channel_2_4ghz": 6,
            "channel_5ghz": 36,
            "channel_utilization_2_4ghz": 35,
            "channel_utilization_5ghz": 18,
            "clients_connected": 12,
            "clients_limit": 64,
            "cpu_usage": 15,
            "firmware_version": "7.4.3",
            "interfering_aps": 3,
            "ip_address": "192.168.1.10",
            "last_seen": "2025-10-17T10:05:00Z",
            "login_failures": 2,
            "memory_usage": 60,
            "model": "FortiAP-431F",
            "name": "Office-Floor1-AP1",
            "noise_level": -95,
            "rogue_aps": 0,
            "serial": "FP431FTF20012724",
            "signal_strength": -45,
            "ssids": [
                "Corporate-WiFi",
                "Guest-WiFi"
            ],
            "status": "up",
            "temperature": 45,
            "tx_power_2_4ghz": 17,
            "tx_power_5ghz": 20,
            "uptime": "15d 4h 23m"
        },
        {
            "channel_2_4ghz": 11,
            "channel_5ghz": 44,
            "channel_utilization_2_4ghz": 28,
            "channel_utilization_5ghz": 22,
            "clients_connected": 8,
            "clients_limit": 64,
            "cpu_usage": 12,
            "firmware_version": "7.4.3",
            "interfering_aps": 1,
            "ip_address": "192.168.1.11",
            "last_seen": "2025-10-17T10:05:00Z",
            "login_failures": 0,
            "memory_usage": 58,
            "model": "FortiAP-431F",
            "name": "Office-Floor2-AP2",
            "noise_level": -92,
            "rogue_aps": 0,
            "serial": "FP431FTF20012725",
            "signal_strength": -42,
            "ssids": [
                "Corporate-WiFi",
                "Guest-WiFi"
            ],
            "status": "up",
            "temperature": 48,
            "tx_power_2_4ghz": 17,
            "tx_power_5ghz": 20,
            "uptime": "15d 4h 20m"
        },
        {
            "channel_2_4ghz": 1,
            "channel_5ghz": 0,
            "channel_utilization_2_4ghz": 0,
            "channel_utilization_5ghz": 0,
            "clients_connected": 0,
            "clients_limit": 64,
            "cpu_usage": 0,
            "firmware_version": "7.4.3",
            "interfering_aps": 0,
            "ip_address": "192.168.1.12",
            "last_seen": "2025-10-16T14:30:00Z",
            "login_failures": 0,
            "memory_usage": 0,
            "model": "FortiAP-231G",
            "name": "Warehouse-AP3",
            "noise_level": 0,
            "rogue_aps": 0,
            "serial": "FP231GTF19001234",
            "signal_strength": 0,
            "ssids": [],
            "status": "down",
            "temperature": 0,
            "tx_power_2_4ghz": 0,
            "tx_power_5ghz": 0,
            "uptime": "0d 0h 0m"
        }
    ],
    "fortiswitches": [
        {
            "cpu_usage": 8,
            "fan_status": "ok",
            "firmware_version": "7.6.4",
            "fortilink_status": "up",
            "ip_address": "192.168.1.20",
            "last_seen": "2025-10-17T10:05:00Z",
            "memory_usage": 45,
            "model": "FortiSwitch-524D-FPOE",
            "name": "Core-Switch-1",
            "poe_enabled_ports": 18,
            "poe_ports": 24,
            "poe_power_budget": 740,
            "poe_power_consumption": 485,
            "poe_power_percentage": 65.5,
            "ports": [
                {
                    "device": "FortiAP-431F",
                    "poe_power": "15.4W",
                    "poe_status": "enabled",
                    "port": "port1",
                    "speed": "1000M",
                    "status": "up"
                },
                {
                    "device": "FortiAP-431F",
                    "poe_power": "12.8W",
                    "poe_status": "enabled",
                    "port": "port2",
                    "speed": "1000M",
                    "status": "up"
                },
                {
                    "device": "",
                    "poe_power": "0W",
                    "poe_status": "disabled",
                    "port": "port3",
                    "speed": "0M",
                    "status": "down"
                },
                {
                    "device": "IP Camera",
                    "poe_power": "5.2W",
                    "poe_status": "enabled",
                    "port": "port4",
                    "speed": "100M",
                    "status": "up"
                },
                {
                    "device": "IP Phone",
                    "poe_power": "25.5W",
                    "poe_status": "enabled",
                    "port": "port5",
                    "speed": "1000M",
                    "status": "up"
                }
            ],
            "ports_down": 4,
            "ports_up": 20,
            "power_supply_1": "ok",
            "power_supply_2": "ok",
            "serial": "S524DF4K15000024",
            "status": "up",
            "temperature": 52,
            "total_ports": 24,
            "uptime": "25d 12h 45m"
        },
        {
            "cpu_usage": 12,
            "fan_status": "ok",
            "firmware_version": "7.4.8",
            "fortilink_status": "up",
            "ip_address": "192.168.1.21",
            "last_seen": "2025-10-17T10:05:00Z",
            "memory_usage": 52,
            "model": "FortiSwitch-124E-POE",
            "name": "Access-Switch-2",
            "poe_enabled_ports": 12,
            "poe_ports": 24,
            "poe_power_budget": 185,
            "poe_power_consumption": 125,
            "poe_power_percentage": 67.6,
            "ports": [
                {
                    "device": "IP Phone",
                    "poe_power": "8.2W",
                    "poe_status": "enabled",
                    "port": "port1",
                    "speed": "1000M",
                    "status": "up"
                },
                {
                    "device": "IP Phone",
                    "poe_power": "4.1W",
                    "poe_status": "enabled",
                    "port": "port2",
                    "speed": "100M",
                    "status": "up"
                },
                {
                    "device": "Workstation",
                    "poe_power": "0W",
                    "poe_status": "disabled",
                    "port": "port3",
                    "speed": "1000M",
                    "status": "up"
                },
                {
                    "device": "",
                    "poe_power": "0W",
                    "poe_status": "disabled",
                    "port": "port4",
                    "speed": "0M",
                    "status": "down"
                }
            ],
            "ports_down": 9,
            "ports_up": 15,
            "power_supply_1": "ok",
            "power_supply_2": "n/a",
            "serial": "S124ETF18000567",
            "status": "up",
            "temperature": 48,
            "total_ports": 24,
            "uptime": "20d 8h 15m"
        },
        {
            "cpu_usage": 25,
            "fan_status": "warning",
            "firmware_version": "7.6.4",
            "fortilink_status": "up",
            "ip_address": "192.168.1.22",
            "last_seen": "2025-10-17T10:05:00Z",
            "memory_usage": 78,
            "model": "FortiSwitch-248E-FPOE",
            "name": "Distribution-Switch-3",
            "poe_enabled_ports": 35,
            "poe_ports": 48,
            "poe_power_budget": 740,
            "poe_power_consumption": 620,
            "poe_power_percentage": 83.8,
            "ports": [],
            "ports_down": 6,
            "ports_up": 42,
            "power_supply_1": "ok",
            "power_supply_2": "ok",
            "serial": "S248ETF19000890",
            "status": "warning",
            "temperature": 68,
            "total_ports": 48,
            "uptime": "30d 2h 10m"
        }
    ],
    "historical_data": [
        {
            "avg_ap_temperature": 52,
            "avg_channel_utilization_2_4": 43,
            "avg_channel_utilization_5": 13,
            "avg_switch_temperature": 49,
            "timestamp": "2025-10-16T14:28:07.985610",
            "total_clients": 18,
            "total_poe_power": 416
        },
        {
            "avg_ap_temperature": 44,
            "avg_channel_utilization_2_4": 46,
            "avg_channel_utilization_5": 22,
            "avg_switch_temperature": 63,
            "timestamp": "2025-10-16T14:43:07.985610",
            "total_clients": 34,
            "total_poe_power": 562
        },
        {
            "avg_ap_temperature": 44,
            "avg_channel_utilization_2_4": 46,
            "avg_channel_utilization_5": 13,
            "avg_switch_temperature": 57,
            "timestamp": "2025-10-16T14:58:07.985610",
            "total_clients": 16,
            "total_poe_power": 540
        },
        {
            "avg_ap_temperature": 53,
            "avg_channel_utilization_2_4": 33,
            "avg_channel_utilization_5": 24,
            "avg_switch_temperature": 53,
            "timestamp": "2025-10-16T15:13:07.985610",
            "total_clients": 28,
            "total_poe_power": 535
        },
        {
            "avg_ap_temperature": 46,
            "avg_channel_utilization_2_4": 22,
            "avg_channel_utilization_5": 15,
            "avg_switch_temperature": 57,
            "timestamp": "2025-10-16T15:28:07.985610",
            "total_clients": 35,
            "total_poe_power": 597
        },
        {
            "avg_ap_temperature": 43,
            "avg_channel_utilization_2_4": 27,
            "avg_channel_utilization_5": 23,
            "avg_switch_temperature": 55,
            "timestamp": "2025-10-16T15:43:07.985610",
            "total_clients": 34,
            "total_poe_power": 610
        },
        {
            "avg_ap_temperature": 46,
            "avg_channel_utilization_2_4": 24,
            "avg_channel_utilization_5": 25,
            "avg_switch_temperature": 58,
            "timestamp": "2025-10-16T15:58:07.985610",
            "total_clients": 33,
            "total_poe_power": 418
        },
        {
            "avg_ap_temperature": 