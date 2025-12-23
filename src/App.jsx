import React, { useState, useEffect } from 'react';
// import { Client } from '@stomp/stompjs'; // <--- UNCOMMENT FOR LOCAL USE

// --- MOCK CLIENT FOR PREVIEW (DELETE LOCALLY) ---
import { Client } from 'https://esm.sh/@stomp/stompjs';
// ------------------------------------------------

import { Activity, Database, Server, ShieldAlert, Terminal, Zap } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const StatCard = ({ title, value, icon: Icon, color }) => (
  <div className="stat-card">
    <div>
      <p className="stat-label">{title}</p>
      <h3 className="stat-value">{value}</h3>
    </div>
    <div className="icon-box" style={{ backgroundColor: `${color}20`, color: color }}>
      <Icon size={24} />
    </div>
  </div>
);

const ChaosPanel = ({ onTrigger, className }) => (
  <div className={`panel ${className}`}>
    <div className="panel-header" style={{ backgroundColor: 'rgba(185, 28, 28, 0.1)', borderColor: 'rgba(185, 28, 28, 0.2)' }}>
      <div className="panel-title" style={{ color: '#f87171' }}>
        <Zap size={16} /> Chaos Controls
      </div>
    </div>
    <div style={{ padding: '1rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
      <button onClick={() => onTrigger('success')} className="btn-chaos" style={{ padding: '0.75rem', backgroundColor: 'rgba(20, 83, 45, 0.3)', border: '1px solid #14532d', borderRadius: '6px', color: '#4ade80', fontSize: '0.75rem', fontWeight: 'bold', cursor: 'pointer' }}>GENERATE SUCCESS</button>
      <button onClick={() => onTrigger('latency')} className="btn-chaos" style={{ padding: '0.75rem', backgroundColor: 'rgba(120, 53, 15, 0.3)', border: '1px solid #78350f', borderRadius: '6px', color: '#fbbf24', fontSize: '0.75rem', fontWeight: 'bold', cursor: 'pointer' }}>SIMULATE LATENCY</button>
      <button onClick={() => onTrigger('db-failure')} className="btn-chaos" style={{ padding: '0.75rem', backgroundColor: 'rgba(127, 29, 29, 0.3)', border: '1px solid #7f1d1d', borderRadius: '6px', color: '#f87171', fontSize: '0.75rem', fontWeight: 'bold', cursor: 'pointer' }}>CRASH DATABASE</button>
      <button onClick={() => onTrigger('spike-memory')} className="btn-chaos" style={{ padding: '0.75rem', backgroundColor: 'rgba(88, 28, 135, 0.3)', border: '1px solid #581c87', borderRadius: '6px', color: '#c084fc', fontSize: '0.75rem', fontWeight: 'bold', cursor: 'pointer' }}>SPIKE MEMORY</button>
    </div>
  </div>
);

export default function App() {
  const [metrics, setMetrics] = useState(null);
  const [logs, setLogs] = useState([]);
  const [chartData, setChartData] = useState([]);
  const [isConnected, setIsConnected] = useState(false);

  // 1. Get Base URL from Environment Variable (or default to localhost)
  // In Vite, env variables must start with VITE_
  const getBaseUrl = () => {
    return import.meta.env.VITE_BACKEND_URL || 'http://localhost:8080';
  };

  const handleChaos = async (type) => {
    try {
      await fetch(`${getBaseUrl()}/api/chaos/${type}`, { method: 'POST' });
    } catch (err) {
      console.error("Chaos failed:", err);
    }
  };

  useEffect(() => {
    const baseUrl = getBaseUrl();
    
    // 2. Logic to convert HTTP/HTTPS URL to WS/WSS URL
    // Remove protocol (http:// or https://)
    const host = baseUrl.replace(/^https?:\/\//, '');
    
    // Determine WS protocol based on HTTP protocol
    // If backend is https, use wss. If http, use ws.
    const protocol = baseUrl.startsWith('https') ? 'wss' : 'ws';
    
    const brokerURL = `${protocol}://${host}/ws-logs/websocket`;
    
    console.log("Connecting to WebSocket:", brokerURL);

    const client = new Client({
      brokerURL: brokerURL,
      onConnect: () => {
        setIsConnected(true);
        
        client.subscribe('/topic/metrics', (message) => {
          const data = JSON.parse(message.body);
          setMetrics(data);
          
          const rawMemory = data.UsedMemory || 0;
          
          setChartData(prev => {
            const newData = [...prev, { 
              time: new Date().toLocaleTimeString(), 
              mb: parseFloat((rawMemory / 1024 / 1024).toFixed(2))
            }];
            return newData.slice(-20);
          });
        });

        client.subscribe('/topic/logs', (message) => {
          const newLog = JSON.parse(message.body);
          setLogs(prev => [newLog, ...prev].slice(0, 50));
        });
      },
      onDisconnect: () => setIsConnected(false),
    });

    client.activate();
    return () => client.deactivate();
  }, []);

  const formatMB = (bytes) => bytes ? `${(bytes / 1024 / 1024).toFixed(0)} MB` : '0 MB';

  return (
    <div className="dashboard-container">
      
      <div className="header">
        <div>
          <h1 className="title"><Activity color="#3b82f6" /> Game Day</h1>
          <p className="subtitle">simulates a failure or event to test systems, processes, and team responses</p>
        </div>
        <div className={`status-badge ${isConnected ? 'online' : 'offline'}`}>
          <div className="status-dot" />
          <span>{isConnected ? 'System Online' : 'Disconnected'}</span>
        </div>
      </div>

      <div className="stats-grid">
        <StatCard title="Total Logs Today" value={metrics?.TotalLogsToday || 0} icon={Database} color="#3b82f6" />
        <StatCard title="JVM Memory Used" value={formatMB(metrics?.UsedMemory)} icon={Server} color="#8b5cf6" />
        <StatCard title="Services with Errors" value={Object.keys(metrics?.ErrorLogs || {}).length} icon={ShieldAlert} color="#ef4444" />
      </div>

      <div className="content-grid">
        <ChaosPanel className="panel-chaos" onTrigger={handleChaos} />
        
        <div className="panel panel-logs">
          <div className="panel-header">
            <div className="panel-title"><Terminal size={16} color="#94a3b8" /> Live Stream</div>
            <span className="badge">{logs.length} events</span>
          </div>
          <div className="log-feed">
            {logs.length === 0 && <div style={{textAlign:'center', padding:'2rem', color:'#64748b'}}>Waiting for logs...</div>}
            {logs.map((log) => (
              <div key={log.id || Math.random()} className={`log-item ${log.logLevel === 'ERROR' ? 'log-error' : log.logLevel === 'WARN' ? 'log-warn' : 'log-info'}`}>
                <div className="log-header">
                  <span className="level">{log.logLevel}</span>
                  <span className="timestamp">{new Date(log.receivedAt).toLocaleTimeString()}</span>
                </div>
                <div className="service-name">{log.serviceName}</div>
                <div className="message">{log.message}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="panel panel-chart">
          <div className="panel-header"><div className="panel-title">Real-Time Memory Usage (MB)</div></div>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <XAxis dataKey="time" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} domain={['auto', 'auto']} />
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#fff' }} itemStyle={{ color: '#fff' }} />
                <Line type="monotone" dataKey="mb" stroke="#8b5cf6" strokeWidth={3} dot={false} activeDot={{ r: 6, fill: '#8b5cf6' }} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}