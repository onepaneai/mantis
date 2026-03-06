import React, { useState, useEffect } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import LoginPage from './pages/LoginPage'
import axios from 'axios'
import { X, Trash2, Edit2, Play, ChevronRight, ChevronDown, CheckCircle, Bug, FlaskConical, Zap, Download, RefreshCw, Activity, ShieldAlert, FileText, Settings, User, Sparkles, Hexagon, Save, GitMerge } from 'lucide-react'
import { PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, AreaChart, Area } from 'recharts'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import ProfileSettingsModal from './components/ProfileSettingsModal'

const API_URL = import.meta.env.DEV ? 'http://localhost:8000/api/v1' : '/api/v1';

const PrivateRoute = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: 'var(--bg-main)' }}>
        <Hexagon className="spin-slow" size={48} color="var(--neon-mantis)" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
};

function DashboardLayout() {
  const { userOrganizations, activeOrgId, setActiveOrgId } = useAuth();
  const [activeBot, setActiveBot] = useState(null)

  // Navigation State
  const [activeArea, setActiveArea] = useState('testing')

  // Bot Data
  const [bots, setBots] = useState([])
  const [showBotForm, setShowBotForm] = useState(false)
  const [showProfileSettings, setShowProfileSettings] = useState(false)

  // Legacy Data (for Security Area)
  const [datasets, setDatasets] = useState([])
  const [evaluations, setEvaluations] = useState([])

  // Organization LLM Model Data
  const [activeModel, setActiveModel] = useState(null)

  // Project State for Active Bot
  const [projects, setProjects] = useState([])
  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [showCreateProject, setShowCreateProject] = useState(false)
  const [newProjectName, setNewProjectName] = useState('')
  const [newProjectDesc, setNewProjectDesc] = useState('')

  useEffect(() => {
    setActiveBot(null);
    loadBots();
    loadLegacyData();
    loadActiveModel();
  }, [activeOrgId])

  const loadActiveModel = async () => {
    try {
      if (!activeOrgId) return;
      const { data } = await axios.get(`${API_URL}/organizations/`);
      const org = data.find(o => o.id === activeOrgId);
      if (org && org.llm_models) {
        const active = org.llm_models.find(m => m.is_active);
        setActiveModel(active || null);
      } else {
        setActiveModel(null);
      }
    } catch (e) {
      console.error("Failed to load active model:", e)
    }
  }

  const loadBots = async () => {
    try {
      const res = await axios.get(`${API_URL}/targets/`)
      setBots(res.data)
      if (activeBot) {
        const updatedBot = res.data.find(b => b.id === activeBot.id)
        if (updatedBot) setActiveBot(updatedBot)
      }
    } catch (error) {
      console.error('Failed to load bots:', error)
    }
  }

  const loadLegacyData = async () => {
    try {
      const [datasetsRes, evaluationsRes] = await Promise.all([
        axios.get(`${API_URL}/datasets/`),
        axios.get(`${API_URL}/evaluation/`)
      ])
      setDatasets(datasetsRes.data)
      setEvaluations(evaluationsRes.data)
    } catch (error) {
      console.error('Failed to load legacy data:', error)
    }
  }

  useEffect(() => {
    if (activeBot) {
      loadProjects()
    } else {
      setProjects([])
      setSelectedProjectId('')
      setShowCreateProject(false)
    }
  }, [activeBot?.id])

  const loadProjects = async () => {
    try {
      const res = await axios.get(`${API_URL}/targets/${activeBot.id}/projects`)
      setProjects(res.data)
    } catch (e) {
      console.error("Failed to load projects", e)
    }
  }

  const handleCreateProject = async (e) => {
    e.preventDefault()
    try {
      const res = await axios.post(`${API_URL}/targets/${activeBot.id}/projects`, {
        name: newProjectName, description: newProjectDesc
      })
      setProjects([...projects, res.data])
      setSelectedProjectId(res.data.id)
      setShowCreateProject(false)
      setNewProjectName('')
      setNewProjectDesc('')
    } catch (e) {
      alert("Failed to create project: " + e.message)
    }
  }

  const openBotSettings = () => {
    setActiveArea('settings')
  }

  return (
    <div className="app-shell">
      {/* Sidebar */}
      <div className="sidebar">
        <div style={{ padding: '0 24px', marginBottom: '24px' }}>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '22px', color: 'var(--text-primary)', marginBottom: '24px' }}>
            <Hexagon size={28} color="var(--neon-mantis)" /> MantisGuard
          </h1>

          {userOrganizations && userOrganizations.length > 0 && (
            <div style={{ background: 'var(--surface-dark)', borderRadius: '8px', border: '1px solid var(--border-card)', padding: '12px' }}>
              <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.05em', marginBottom: '8px' }}>Active Workspace</div>
              <select
                value={activeOrgId || ''}
                onChange={(e) => setActiveOrgId(e.target.value)}
                style={{
                  width: '100%',
                  background: 'var(--bg-void)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-hover)',
                  padding: '8px',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: '500',
                  outline: 'none',
                  cursor: 'pointer'
                }}
              >
                {userOrganizations.map(org => (
                  <option key={org.id} value={org.id}>
                    {org.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {activeOrgId && (
            <div style={{ background: 'var(--surface-dark)', borderRadius: '8px', border: '1px solid var(--border-card)', padding: '12px', marginTop: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Zap size={16} color="var(--neon-mantis)" style={{ flexShrink: 0 }} />
              <div style={{ overflow: 'hidden' }}>
                <div style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.05em' }}>Active Model</div>
                <div style={{ fontSize: '12px', color: activeModel ? 'var(--text-primary)' : 'var(--neon-red)', fontWeight: 500, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                  {activeModel ? `${activeModel.model_name} (${activeModel.provider})` : 'No Model Configured'}
                </div>
              </div>
            </div>
          )}
        </div>

        {activeBot && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div className="flex-between" style={{ padding: '0 24px', marginBottom: '12px', fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.05em' }}>
              <span>Workspace: {activeBot.name}</span>
            </div>

            {/* Project Scope in Sidebar */}
            <div style={{ padding: '0 24px', marginBottom: '16px' }}>
              <div style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.05em', marginBottom: '6px' }}>Project Scope</div>
              <select
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                style={{
                  width: '100%',
                  background: 'var(--surface-dark)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-card)',
                  padding: '6px',
                  borderRadius: '4px',
                  fontSize: '12px',
                  marginBottom: '8px'
                }}
              >
                <option value="">Global (All Projects)</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <button
                className="secondary"
                style={{ width: '100%', padding: '4px', fontSize: '11px' }}
                onClick={() => setShowCreateProject(!showCreateProject)}
              >
                {showCreateProject ? 'Cancel' : '+ New Project'}
              </button>

              {showCreateProject && (
                <form onSubmit={handleCreateProject} style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <input
                    value={newProjectName}
                    onChange={e => setNewProjectName(e.target.value)}
                    required
                    placeholder="Project Name"
                    style={{ fontSize: '12px', padding: '6px' }}
                  />
                  <input
                    value={newProjectDesc}
                    onChange={e => setNewProjectDesc(e.target.value)}
                    placeholder="Description (Optional)"
                    style={{ fontSize: '12px', padding: '6px' }}
                  />
                  <button type="submit" style={{ padding: '4px', fontSize: '11px' }}>Create</button>
                </form>
              )}
            </div>

            <div
              className={`sidebar-item testing ${activeArea === 'testing' ? 'active' : ''}`}
              onClick={() => setActiveArea('testing')}
            >
              <FlaskConical size={18} /> Functional Testing
            </div>

            <div
              className={`sidebar-item security ${activeArea === 'security' ? 'active' : ''}`}
              onClick={() => setActiveArea('security')}
            >
              <ShieldAlert size={18} /> Security Attacks
            </div>

            <div
              className={`sidebar-item test-cycles ${activeArea === 'test_cycles' ? 'active' : ''}`}
              onClick={() => setActiveArea('test_cycles')}
            >
              <FileText size={18} /> Test Cycles
            </div>

            <div
              className={`sidebar-item security ${activeArea === 'settings' ? 'active' : ''}`}
              onClick={openBotSettings}
            >
              <Settings size={18} /> Workspace Settings
            </div>

            <div style={{ borderTop: '1px solid var(--border-card)', margin: '16px 24px', opacity: 0.5 }}></div>

            <div
              className="sidebar-item"
              onClick={() => setActiveBot(null)}
              style={{ color: 'var(--text-secondary)' }}
            >
              ← Switch Bot
            </div>
          </div>
        )}

        <div style={{ flex: 1 }}></div>

        {/* Profile Settings */}
        <div style={{ padding: '0 24px', marginBottom: '24px' }}>
          <div
            className="sidebar-item"
            style={{ marginTop: 'auto', background: 'var(--bg-card)', border: '1px solid var(--border-card)' }}
            onClick={() => setShowProfileSettings(true)}
          >
            <User size={18} /> Profile & API Keys
          </div>
        </div>
      </div>


      <div className="main-content">
        <div className="container">
          {!activeBot ? (
            <BotSelection
              bots={bots}
              onSelectBot={(b) => { setActiveBot(b); setActiveArea('testing'); }}
              showForm={showBotForm}
              setShowForm={setShowBotForm}
              onRefresh={loadBots}
            />
          ) : (
            <BotDashboard
              bot={activeBot}
              activeArea={activeArea}
              datasets={datasets}
              evaluations={evaluations}
              onRefreshLegacy={loadLegacyData}
              selectedProjectId={selectedProjectId}
            />
          )}
        </div>
      </div>

      {showProfileSettings && (
        <ProfileSettingsModal onClose={() => setShowProfileSettings(false)} />
      )}
    </div>
  )
}

function BotSelection({ bots, onSelectBot, showForm, setShowForm, onRefresh }) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    purpose: '',
    context: '',
    agent_memory: '',
    target_type: 'api_endpoint',
    endpoint: '',
    method: 'POST'
  })

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      await axios.post(`${API_URL}/targets/`, formData)
      setShowForm(false)
      setFormData({
        name: '', description: '', purpose: '', context: '', agent_memory: '',
        target_type: 'api_endpoint', endpoint: '', method: 'POST'
      })
      onRefresh()
    } catch (error) {
      alert('Failed to create bot: ' + error.message)
    }
  }

  return (
    <div>
      <div className="card">
        <div className="flex-between" style={{ marginBottom: '24px' }}>
          <div>
            <h2 className="card-title" style={{ margin: 0 }}>Your Bots / Projects</h2>
            <p className="card-subtitle" style={{ margin: 0, marginTop: '4px' }}>Select an AI agent to test and evaluate.</p>
          </div>
          <button onClick={() => setShowForm(!showForm)}>
            {showForm ? 'Cancel' : '+ Create Bot'}
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleSubmit} style={{ marginBottom: '32px', padding: '24px', background: 'var(--surface-dark)', borderRadius: '8px', border: '1px solid var(--border-card)' }}>
            <h3 style={{ marginBottom: '16px', fontSize: '16px', color: 'var(--text-primary)' }}>New Bot Configuration</h3>
            <div className="grid grid-2">
              <div>
                <label>Bot Name</label>
                <input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required placeholder="e.g. Customer Support Bot" />
              </div>

              <div>
                <label>Connection Type</label>
                <select value={formData.target_type} onChange={e => setFormData({ ...formData, target_type: e.target.value })}>
                  <option value="api_endpoint">REST API Endpoint</option>
                  <option value="web_browser">Chrome Extension</option>
                </select>
              </div>
            </div>

            <label>Description</label>
            <textarea value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} required rows="2" placeholder="Briefly describe what this bot does..." />

            <label>Purpose & Context</label>
            <textarea
              value={formData.purpose}
              onChange={e => setFormData({ ...formData, purpose: e.target.value })}
              placeholder="Explain why this bot is used, its purpose, and details so the agent can understand it..."
              rows="3"
            />

            <label>Agent Knowledge Base (Optional)</label>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '-8px', marginBottom: '8px' }}>Provide information like default subscriptions or mock credentials for the attacking agent to use when answering bot questions.</p>
            <textarea
              value={formData.agent_memory}
              onChange={e => setFormData({ ...formData, agent_memory: e.target.value })}
              placeholder="e.g. Use Subscription ID: SUB-999-XYZ for all billing questions."
              rows="3"
            />

            {formData.target_type === 'api_endpoint' && (
              <div className="grid grid-2">
                <div>
                  <label>API Endpoint</label>
                  <input value={formData.endpoint} onChange={e => setFormData({ ...formData, endpoint: e.target.value })} required placeholder="https://api.example.com/chat" />
                </div>
                <div>
                  <label>HTTP Method</label>
                  <select value={formData.method} onChange={e => setFormData({ ...formData, method: e.target.value })}>
                    <option value="POST">POST</option>
                    <option value="GET">GET</option>
                  </select>
                </div>
              </div>
            )}

            <button type="submit" style={{ marginTop: '8px' }}>Create Bot</button>
          </form>
        )}

        {bots.length === 0 && !showForm ? (
          <div style={{ textAlign: 'center', padding: '40px', background: 'var(--surface-dark)', borderRadius: '8px', border: '1px solid var(--border-card)' }}>
            <p style={{ color: 'var(--text-secondary)' }}>No bots configured yet. Click Create Bot to get started.</p>
          </div>
        ) : (
          <div className="grid grid-3">
            {bots.map(bot => (
              <div
                key={bot.id}
                className="card"
                style={{ cursor: 'pointer', margin: 0, display: 'flex', flexDirection: 'column' }}
                onClick={() => onSelectBot(bot)}
              >
                <div className="flex-between" style={{ marginBottom: '12px' }}>
                  <h3 style={{ margin: 0, fontSize: '18px', color: 'var(--text-primary)' }}>{bot.name}</h3>
                  <span className={`pill ${bot.target_type === 'api_endpoint' ? 'pending' : 'running'}`}>
                    {bot.target_type === 'api_endpoint' ? 'HTTP API' : 'Browser'}
                  </span>
                </div>
                <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '20px', flex: 1 }}>{bot.description}</p>
                <div className="flex-gap" style={{ marginTop: '16px' }}>
                  <button className="secondary" style={{ flex: 1 }} onClick={(e) => { e.stopPropagation(); onSelectBot(bot); }}>
                    Open Environment →
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function BotDashboard({ bot, activeArea, datasets, evaluations, onRefreshLegacy, selectedProjectId }) {
  const [stats, setStats] = useState(null)
  const [testSuiteId, setTestSuiteId] = useState('')

  useEffect(() => {
    loadStats()
    // Poll stats occasionally to keep dashboard alive
    const interval = setInterval(loadStats, 10000)
    return () => clearInterval(interval)
  }, [bot.id, testSuiteId, selectedProjectId])

  const loadStats = async () => {
    try {
      const suiteParam = testSuiteId ? `?suite_id=${testSuiteId}` : ''
      const res = await axios.get(`${API_URL}/testing/stats/${bot.id}${suiteParam}`)
      setStats(res.data)
    } catch (e) {
      console.error("Failed to load dashboard stats", e)
    }
  }

  // Derived Attack Data from legacy evaluations prop
  const attackData = evaluations.map((ev, i) => ({
    name: `Run ${i + 1}`,
    successRate: Math.round((ev.stats?.avg_score || 0) * 100)
  })).slice(-20) // Last 20 runs

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="custom-tooltip">
          <p style={{ margin: 0, fontWeight: 600 }}>{label}</p>
          <p style={{ margin: 0, color: payload[0].color }}>
            {payload[0].name}: {payload[0].value}%
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div>
      <div style={{ marginBottom: '32px' }}>
        <h2 className="page-title" style={{ margin: 0, marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Activity size={24} color="var(--accent-cyan)" />
          {bot.name} <span style={{ color: 'var(--text-muted)' }}>/</span> {activeArea === 'settings' ? 'Workspace Settings' : (activeArea === 'testing' ? 'Functional Testing' : (activeArea === 'test_cycles' ? 'Test Cycles' : 'Security Operations'))}
        </h2>

        {/* Global Glowing Stat Cards */}
        {activeArea !== 'settings' && stats && (
          <div className="grid grid-4" style={{ marginBottom: '32px' }}>
            <div className="card glow-card glow-card-pass">
              <div className="card-title" style={{ color: '#4ADE80' }}>Pass Rate <CheckCircle size={16} /></div>
              <div className="big-number">{stats.pass_rate}%</div>
            </div>
            <div className="card glow-card glow-card-fail">
              <div className="card-title" style={{ color: '#F43F5E' }}>Fail Rate <Bug size={16} /></div>
              <div className="big-number">{stats.fail_rate}%</div>
            </div>
            <div className="card glow-card glow-card-info">
              <div className="card-title" style={{ color: '#38BDF8' }}>Tests Run <FlaskConical size={16} /></div>
              <div className="flex-gap" style={{ alignItems: 'baseline', gap: '8px' }}>
                <span className="big-number">{stats.run_tests}</span>
                <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>/ {stats.total_tests} Total</span>
              </div>
            </div>
            <div className="card glow-card glow-card-warning">
              <div className="card-title" style={{ color: '#FFBE0B' }}>Avg Score <Activity size={16} /></div>
              <div className="big-number">{stats.avg_score}</div>
            </div>
          </div>
        )}

        {/* Analytics Charts Row */}
        {activeArea !== 'settings' && stats && (
          <div className="grid grid-2" style={{ marginBottom: '32px' }}>
            {/* Pass/Fail Breakdown Chart */}
            <div className="card" style={{ height: '380px', display: 'flex', flexDirection: 'column' }}>
              <h3 className="card-title" style={{ marginBottom: '16px', flexShrink: 0 }}>Functional Diagnostics</h3>
              <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '16px', minHeight: 0 }}>
                {/* Donut */}
                <div style={{ position: 'relative', minWidth: 0 }}>
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={[{ name: 'Pass', value: stats.pass_rate }, { name: 'Fail', value: stats.fail_rate }]} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} stroke="none" dataKey="value">
                          <Cell fill="var(--neon-mantis)" />
                          <Cell fill="var(--neon-red)" />
                        </Pie>
                        <RechartsTooltip content={<CustomTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                {/* Stacked Bar */}
                <div style={{ position: 'relative', minWidth: 0 }}>
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={stats.use_case_breakdown.slice(0, 10)} layout="vertical" margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                        <XAxis type="number" hide />
                        <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} width={120} tickFormatter={(value) => value.length > 20 ? value.substring(0, 18) + '...' : value} style={{ fontSize: '11px', fill: 'var(--text-secondary)' }} />
                        <RechartsTooltip content={<CustomTooltip />} />
                        <Bar dataKey="passed" stackId="a" fill="var(--neon-mantis)" radius={[4, 0, 0, 4]} />
                        <Bar dataKey="failed" stackId="a" fill="var(--neon-red)" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </div>

            {/* Attack Rates Graph */}
            <div className="card" style={{ height: '380px', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
              <h3 className="card-title" style={{ marginBottom: '16px', flexShrink: 0 }}>Attack Success Rate Trending</h3>
              <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
                  {attackData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={attackData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorAttack" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="var(--neon-red)" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="var(--neon-red)" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-card)" vertical={false} />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} style={{ fontSize: '11px', fill: 'var(--text-secondary)' }} />
                        <YAxis axisLine={false} tickLine={false} style={{ fontSize: '11px', fill: 'var(--text-secondary)' }} domain={[0, 100]} />
                        <RechartsTooltip content={<CustomTooltip />} />
                        <Area type="monotone" dataKey="successRate" name="Success %" stroke="var(--neon-red)" strokeWidth={3} fillOpacity={1} fill="url(#colorAttack)" activeDot={{ r: 6, stroke: "var(--neon-red)", strokeWidth: 2, fill: "var(--bg-void)" }} />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
                      No security evaluations executed yet.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeArea !== 'settings' && (
          <div className={`card ${activeArea === 'testing' ? 'card-success' : (activeArea === 'test_cycles' ? 'card-info' : 'card-fail')}`} style={{ marginBottom: '24px' }}>
            <div className="flex-between">
              <h3 className="card-title" style={{ margin: 0, fontSize: '18px' }}>Active Area Workspace</h3>
              <span className={`pill ${bot.target_type === 'api_endpoint' ? 'pending' : 'running'}`}>
                {bot.target_type === 'api_endpoint' ? 'REST API' : 'Browser Ext'}
              </span>
            </div>
            <p style={{ marginTop: '8px', color: 'var(--text-secondary)', fontSize: '14px' }}>{bot.description}</p>
            {bot.purpose && <p style={{ marginTop: '8px', fontSize: '13px', color: 'var(--text-muted)' }}><strong>Purpose:</strong> {bot.purpose}</p>}
          </div>
        )}
      </div>

      {activeArea === 'testing' && <TestingArea bot={bot} stats={stats} testSuiteId={testSuiteId} setTestSuiteId={setTestSuiteId} onStatsRefresh={loadStats} selectedProjectId={selectedProjectId} />}
      {activeArea === 'security' && <SecurityArea bot={bot} datasets={datasets} evaluations={evaluations} onRefresh={onRefreshLegacy} selectedProjectId={selectedProjectId} />}
      {activeArea === 'test_cycles' && <TestCyclesArea bot={bot} selectedProjectId={selectedProjectId} />}
      {activeArea === 'settings' && <WorkspaceSettingsArea bot={bot} />}

    </div>
  )
}

function WorkspaceSettingsArea({ bot }) {
  const [editingBotData, setEditingBotData] = useState(bot)
  const [isSaving, setIsSaving] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')

  useEffect(() => {
    setEditingBotData(bot)
  }, [bot.id])

  const handleUpdateBot = async (e) => {
    e.preventDefault()
    setIsSaving(true)
    setSuccessMsg('')
    try {
      await axios.put(`${API_URL}/targets/${bot.id}`, editingBotData)
      setSuccessMsg('Settings updated successfully!')
      setTimeout(() => setSuccessMsg(''), 3000)
    } catch (error) {
      alert('Failed to update Workspace Settings: ' + error.message)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="card" style={{ maxWidth: '800px', margin: '0 auto' }}>
      <div className="flex-between" style={{ marginBottom: '32px', borderBottom: '1px solid var(--border-card)', paddingBottom: '16px' }}>
        <h3 style={{ margin: 0, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '20px' }}>
          <Settings size={24} color="var(--accent-cyan)" /> Workspace Configuration
        </h3>
        {successMsg && <span style={{ color: 'var(--neon-mantis)', fontSize: '14px', fontWeight: 500 }}>✓ {successMsg}</span>}
      </div>

      <form onSubmit={handleUpdateBot} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

        <div className="grid grid-2" style={{ gap: '24px' }}>
          <div>
            <label style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px', display: 'block' }}>Workspace Name</label>
            <input value={editingBotData.name || ''} onChange={e => setEditingBotData({ ...editingBotData, name: e.target.value })} required style={{ padding: '10px' }} />
          </div>
          <div>
            <label style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px', display: 'block' }}>Connection Target Type</label>
            <select value={editingBotData.target_type || 'api_endpoint'} onChange={e => setEditingBotData({ ...editingBotData, target_type: e.target.value })} style={{ padding: '10px' }}>
              <option value="api_endpoint">REST API Endpoint</option>
              <option value="web_browser">Chrome Extension</option>
            </select>
          </div>
        </div>

        <div>
          <label style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px', display: 'block' }}>Description</label>
          <textarea value={editingBotData.description || ''} onChange={e => setEditingBotData({ ...editingBotData, description: e.target.value })} required rows="2" style={{ padding: '10px' }} />
        </div>

        <div>
          <label style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px', display: 'block' }}>Purpose & Context</label>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '-4px', marginBottom: '8px' }}>Explain why this bot is used, its purpose, and details so the AI agent understands how to interact with it.</p>
          <textarea
            value={editingBotData.purpose || ''}
            onChange={e => setEditingBotData({ ...editingBotData, purpose: e.target.value })}
            rows="4"
            style={{ padding: '10px' }}
          />
        </div>

        <div>
          <label style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px', display: 'block' }}>Agent Knowledge Base / Memory</label>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '-4px', marginBottom: '8px' }}>Provide persistent information like default subscriptions or mock credentials for the attacking agent to use when generating parameters.</p>
          <textarea
            value={editingBotData.agent_memory || ''}
            onChange={e => setEditingBotData({ ...editingBotData, agent_memory: e.target.value })}
            placeholder="e.g. Use Subscription ID: SUB-999-XYZ for all billing questions."
            rows="5"
            style={{ padding: '10px' }}
          />
        </div>

        {editingBotData.target_type === 'api_endpoint' && (
          <div className="grid grid-2" style={{ gap: '24px', background: 'var(--surface-dark)', padding: '20px', borderRadius: '8px', border: '1px solid var(--border-card)' }}>
            <div>
              <label style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px', display: 'block' }}>REST API Endpoint</label>
              <input value={editingBotData.endpoint || ''} onChange={e => setEditingBotData({ ...editingBotData, endpoint: e.target.value })} required style={{ padding: '10px' }} />
            </div>
            <div>
              <label style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px', display: 'block' }}>HTTP Method</label>
              <select value={editingBotData.method || 'POST'} onChange={e => setEditingBotData({ ...editingBotData, method: e.target.value })} style={{ padding: '10px' }}>
                <option value="POST">POST</option>
                <option value="GET">GET</option>
              </select>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
          <button type="submit" disabled={isSaving} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px', fontSize: '15px' }}>
            <Save size={18} /> {isSaving ? 'Saving...' : 'Save Configuration'}
          </button>
        </div>
      </form>
    </div>
  )
}

function TestingArea({ bot, stats, testSuiteId, setTestSuiteId, onStatsRefresh, selectedProjectId }) {
  const [useCases, setUseCases] = useState([])
  const [expandedUseCases, setExpandedUseCases] = useState({}) // uc.id -> boolean
  const [showGenerateForm, setShowGenerateForm] = useState(false)
  const [genCount, setGenCount] = useState(3)
  const [genPrompt, setGenPrompt] = useState("")
  const [isGenerating, setIsGenerating] = useState(false)
  const [globalHumanFeedback, setGlobalHumanFeedback] = useState("")

  const [testSuites, setTestSuites] = useState([])
  const [showCreateSuite, setShowCreateSuite] = useState(false)
  const [newSuiteName, setNewSuiteName] = useState('')
  const [newSuiteDesc, setNewSuiteDesc] = useState('')
  const [isExporting, setIsExporting] = useState(false)
  const [isExportingExcel, setIsExportingExcel] = useState(false)

  useEffect(() => {
    loadUseCases()
    loadTestSuites()
  }, [bot.id, selectedProjectId])

  const loadTestSuites = async () => {
    try {
      const projParam = selectedProjectId ? `?project_id=${selectedProjectId}` : '';
      const res = await axios.get(`${API_URL}/testing/suites/${bot.id}${projParam}`)
      setTestSuites(res.data)
    } catch (e) {
      console.error(e)
    }
  }

  const loadUseCases = async () => {
    try {
      const projParam = selectedProjectId ? `?project_id=${selectedProjectId}` : '';
      const res = await axios.get(`${API_URL}/testing/usecases/${bot.id}${projParam}`)
      setUseCases(res.data)
    } catch (e) {
      console.error(e)
    }
  }

  const handleGenerateUseCases = async (e) => {
    e.preventDefault()
    setIsGenerating(true)
    try {
      await axios.post(`${API_URL}/testing/usecases/generate`, {
        bot_id: bot.id,
        project_id: selectedProjectId || null,
        num_usecases: parseInt(genCount) || 3,
        custom_prompt: genPrompt
      })
      loadUseCases()
      setShowGenerateForm(false)
      setGenPrompt("")
      setGenCount(3)
    } catch (e) {
      alert("Failed to generate: " + e.message)
    } finally {
      setIsGenerating(false)
    }
  }

  const handleDeleteUseCase = async (ucId, e) => {
    e.stopPropagation();
    if (window.confirm("Are you sure you want to delete this Use Case and ALL of its Test Cases?")) {
      try {
        await axios.delete(`${API_URL}/testing/usecases/${ucId}`);
        loadUseCases();
      } catch (err) {
        alert("Failed to delete Use Case: " + err.message);
      }
    }
  }

  const toggleUseCaseExpand = (ucId) => {
    setExpandedUseCases(prev => ({ ...prev, [ucId]: !prev[ucId] }))
  }

  const handleCreateSuite = async (e) => {
    e.preventDefault()
    try {
      const res = await axios.post(`${API_URL}/testing/suites`, { bot_id: bot.id, project_id: selectedProjectId || null, name: newSuiteName, description: newSuiteDesc })
      loadTestSuites()
      setTestSuiteId(res.data.id)
      setShowCreateSuite(false)
      setNewSuiteName('')
      setNewSuiteDesc('')
      if (onStatsRefresh) onStatsRefresh()
    } catch (e) {
      alert("Failed to create suite: " + e.message)
    }
  }

  const handleClearTests = async () => {
    if (!testSuiteId) {
      alert("Please select a specific Test Cycle first.");
      return;
    }
    if (window.confirm("Are you sure you want to delete ALL test executions in this Test Cycle? This cannot be undone.")) {
      try {
        await axios.delete(`${API_URL}/testing/suites/${testSuiteId}/executions`);
        if (onStatsRefresh) onStatsRefresh();
        // Reload to completely refresh all expanded test cases easily
        window.location.reload();
      } catch (e) {
        alert("Failed to clear tests: " + e.message);
      }
    }
  }

  const handleExportPDF = async () => {
    setIsExporting(true)
    try {
      const projParam = selectedProjectId ? `?project_id=${selectedProjectId}` : '';
      const res = await axios.get(`${API_URL}/testing/usecases/${bot.id}/export${projParam}`)
      const exportData = res.data

      const doc = new jsPDF()

      // Title
      doc.setFontSize(16)
      doc.text(`Use Cases & Test Cases List`, 14, 20)
      doc.setFontSize(11)
      doc.text(`Workspace: ${bot.name}`, 14, 28)
      doc.text(`Date generated: ${new Date().toLocaleString()}`, 14, 34)

      // TABLE 1: Use Cases
      const ucHead = [['Use Case ID', 'Name', 'Description']]
      const ucBody = exportData.map(uc => [
        uc.visual_id || uc.id.substring(0, 8),
        uc.name,
        uc.description
      ])

      autoTable(doc, {
        startY: 45,
        head: ucHead,
        body: ucBody,
        theme: 'grid',
        headStyles: { fillColor: [74, 222, 128], textColor: 0 },
        margin: { top: 10 }
      })

      // TABLE 2: Test Cases
      const tcHead = [['Test Case ID', 'Use Case', 'Test Case Name', 'Input Prompt']]
      const tcBody = []

      exportData.forEach(uc => {
        if (uc.test_cases && uc.test_cases.length > 0) {
          uc.test_cases.forEach(tc => {
            const tcId = tc.visual_id || `${uc.visual_id || uc.id.substring(0, 8)}-${tc.id.substring(0, 8)}`
            const combinedId = tcId

            tcBody.push([
              combinedId,
              uc.name,
              tc.name,
              tc.input_prompt
            ])
          })
        }
      })

      autoTable(doc, {
        startY: doc.lastAutoTable.finalY + 15,
        head: tcHead,
        body: tcBody,
        theme: 'grid',
        headStyles: { fillColor: [56, 189, 248], textColor: 0 },
      })

      doc.save(`${bot.name.replace(/\\s+/g, '_')}_Test_Report.pdf`)

    } catch (e) {
      alert("Failed to export PDF: " + e.message)
    } finally {
      setIsExporting(false)
    }
  }

  const handleExportExcel = async () => {
    setIsExportingExcel(true)
    try {
      const projParam = selectedProjectId ? `?project_id=${selectedProjectId}` : '';
      const res = await axios.get(`${API_URL}/testing/usecases/${bot.id}/export${projParam}`)
      const exportData = res.data

      // Sheet 1: Use Cases
      const ucData = exportData.map(uc => ({
        "Use Case ID": uc.visual_id || uc.id.substring(0, 8),
        "Name": uc.name,
        "Description": uc.description
      }))

      // Sheet 2: Test Cases
      const tcData = []
      exportData.forEach(uc => {
        if (uc.test_cases && uc.test_cases.length > 0) {
          uc.test_cases.forEach(tc => {
            const tcId = tc.visual_id || `${uc.visual_id || uc.id.substring(0, 8)}-${tc.id.substring(0, 8)}`

            tcData.push({
              "Test Case ID": tcId,
              "Use Case": uc.name,
              "Test Case Name": tc.name,
              "Input Prompt": tc.input_prompt
            })
          })
        }
      })

      const wb = XLSX.utils.book_new()

      const wsUseCases = XLSX.utils.json_to_sheet(ucData)
      XLSX.utils.book_append_sheet(wb, wsUseCases, "Use Cases")

      const wsTestCases = XLSX.utils.json_to_sheet(tcData)
      XLSX.utils.book_append_sheet(wb, wsTestCases, "Test Cases")

      XLSX.writeFile(wb, `${bot.name.replace(/\\s+/g, '_')}_Test_Report.xlsx`)

    } catch (e) {
      alert("Failed to export Excel: " + e.message)
    } finally {
      setIsExportingExcel(false)
    }
  }

  return (
    <div>
      <div className="card" style={{ marginBottom: '24px', display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px', display: 'block' }}>Active Test Cycle</label>
          <select value={testSuiteId} onChange={e => setTestSuiteId(e.target.value)} style={{ width: '100%', maxWidth: '350px', background: 'var(--bg-void)' }}>
            <option value="">Global (All Executions)</option>
            {testSuites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px', display: 'block' }}>Mock Human Confirmation Response</label>
          <select value={globalHumanFeedback} onChange={e => setGlobalHumanFeedback(e.target.value)} style={{ width: '100%', maxWidth: '250px', background: 'var(--bg-void)' }} title="If the bot asks for confirmation, the Agent will automatically reply with this.">
            <option value="">None (Ask Human directly)</option>
            <option value="Yes">Yes</option>
            <option value="No">No</option>
          </select>
        </div>
        <div className="flex-gap" style={{ marginTop: '24px' }}>
          <button className="secondary" onClick={() => setShowCreateSuite(!showCreateSuite)}>+ New Cycle</button>
          {testSuiteId && (
            <button className="secondary danger-hover" onClick={handleClearTests} title="Clear all tests in this cycle" style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Trash2 size={16} color="var(--neon-red)" /> <span style={{ color: 'var(--neon-red)' }}>Clear Cycle</span>
            </button>
          )}
        </div>
      </div>

      {showCreateSuite && (
        <div className="card" style={{ marginBottom: '24px', background: 'var(--surface-dark)', border: '1px solid var(--border-card)' }}>
          <h3 style={{ fontSize: '15px', color: 'var(--text-primary)', marginBottom: '16px' }}>Create Test Cycle</h3>
          <form onSubmit={handleCreateSuite}>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>Name</label>
              <input type="text" value={newSuiteName} onChange={e => setNewSuiteName(e.target.value)} required placeholder="e.g. Release 1.5.0 Regression" />
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>Description</label>
              <input type="text" value={newSuiteDesc} onChange={e => setNewSuiteDesc(e.target.value)} placeholder="Tracking tests for the latest release." />
            </div>
            <div className="flex-gap">
              <button type="submit">Create</button>
              <button type="button" className="secondary" onClick={() => setShowCreateSuite(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="card">
        <div className="flex-between" style={{ marginBottom: '20px' }}>
          <h2 className="card-title" style={{ margin: 0 }}>Use Cases</h2>
          <div className="flex-gap">
            <button className="secondary" onClick={handleExportExcel} disabled={isExportingExcel}>
              <Download size={16} /> {isExportingExcel ? 'Exporting...' : 'Export Excel'}
            </button>
            <button className="secondary" onClick={handleExportPDF} disabled={isExporting}>
              <Download size={16} /> {isExporting ? 'Exporting...' : 'Export PDF'}
            </button>
            <button onClick={() => setShowGenerateForm(!showGenerateForm)}>
              <Sparkles size={16} /> Auto-Generate
            </button>
          </div>
        </div>

        {showGenerateForm && (
          <div className="card" style={{ marginBottom: '24px', background: 'var(--surface-dark)', border: '1px solid var(--border-card)' }}>
            <h3 style={{ fontSize: '15px', color: 'var(--text-primary)', marginBottom: '16px' }}>Generate AI Use Cases</h3>
            <form onSubmit={handleGenerateUseCases}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>Custom Instructions (Optional)</label>
                <textarea
                  value={genPrompt}
                  onChange={e => setGenPrompt(e.target.value)}
                  placeholder="e.g. Focus on edge cases with weird formatting..."
                  rows={2}
                />
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>Number of Use Cases</label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={genCount}
                  onChange={e => setGenCount(e.target.value)}
                  style={{ width: '100px' }}
                />
              </div>
              <div className="flex-gap">
                <button type="submit" disabled={isGenerating}>
                  {isGenerating ? 'Generating...' : <><Sparkles size={16} /> Generate</>}
                </button>
                <button type="button" className="secondary" onClick={() => setShowGenerateForm(false)}>Cancel</button>
              </div>
            </form>
          </div>
        )}

        <p style={{ color: 'var(--text-secondary)', marginBottom: '20px', fontSize: '14px' }}>
          Use cases define the core functionalities to test. Expand one to view or run test cases.
        </p>

        {useCases.length === 0 && !showGenerateForm ? (
          <div style={{ textAlign: 'center', padding: '40px', background: 'var(--surface-dark)', borderRadius: '8px', border: '1px solid var(--border-card)' }}>
            <p style={{ color: 'var(--text-muted)' }}>No use cases yet. Click Auto-Generate to create some based on the bot's purpose!</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', borderTop: '1px solid var(--border-card)' }}>
            {useCases.map(uc => {
              const ucStats = stats?.use_case_breakdown?.find(s => s.id === uc.id)
              const isExpanded = !!expandedUseCases[uc.id];
              return (
                <div key={uc.id} style={{ margin: 0, padding: 0, display: 'flex', flexDirection: 'column', borderBottom: '1px solid var(--border-card)', transition: 'background 0.2s' }}>

                  {/* Use Case Header Row */}
                  <div
                    style={{ cursor: 'pointer', display: 'flex', background: isExpanded ? 'var(--surface-elevated)' : 'transparent' }}
                    onClick={() => toggleUseCaseExpand(uc.id)}
                    onMouseEnter={(e) => { if (!isExpanded) e.currentTarget.style.background = 'var(--surface-elevated)' }}
                    onMouseLeave={(e) => { if (!isExpanded) e.currentTarget.style.background = 'transparent' }}
                  >
                    {/* Metrics Column (Left) */}
                    <div style={{ width: '140px', padding: '16px', borderRight: '1px solid var(--border-card)', display: 'flex', flexDirection: 'column', gap: '16px', flexShrink: 0 }}>
                      <div>
                        <div style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 600 }}>Test Cases</div>
                        <div className="flex-gap" style={{ alignItems: 'baseline', gap: '4px' }}>
                          <span style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>{ucStats ? ucStats.run : 0}</span>
                          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>/ {ucStats ? ucStats.total : 0} Run</span>
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 600 }}>Pass Rate</div>
                        <div style={{ fontSize: '16px', fontWeight: 600, color: ucStats && ucStats.pass_rate >= 80 ? 'var(--neon-mantis)' : (ucStats && ucStats.pass_rate > 0 ? 'var(--neon-amber)' : 'var(--text-primary)') }}>
                          {ucStats ? `${ucStats.pass_rate}%` : '0%'}
                        </div>
                      </div>
                    </div>

                    {/* Content Column (Right) */}
                    <div className="flex-gap" style={{ flex: 1, padding: '16px', minWidth: 0 }}>
                      {isExpanded ? <ChevronDown size={20} color="var(--text-muted)" style={{ flexShrink: 0, marginTop: '2px' }} /> : <ChevronRight size={20} color="var(--text-muted)" style={{ flexShrink: 0, marginTop: '2px' }} />}
                      <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', flex: 1 }}>
                        <div className="flex-between" style={{ marginBottom: '8px' }}>
                          <h3 style={{ fontSize: '16px', color: 'var(--text-primary)', margin: 0, fontWeight: 600 }}>
                            {uc.visual_id ? <span style={{ color: 'var(--text-muted)', marginRight: '6px' }}>{uc.visual_id}</span> : null}
                            {uc.name}
                          </h3>
                          <div className="flex-gap">
                            <button className="icon-btn danger-hover" onClick={(e) => handleDeleteUseCase(uc.id, e)} title="Delete Use Case">
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                        <p style={{ fontSize: '14px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.6 }}>{uc.description || "No summary provided."}</p>
                      </div>
                    </div>
                  </div>

                  {/* Inline Test Cases */}
                  {isExpanded && (
                    <div style={{ borderTop: '1px solid var(--border-card)', background: 'var(--bg-void)' }}>
                      <TestCasesArea useCase={uc} testSuiteId={testSuiteId} globalHumanFeedback={globalHumanFeedback} />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function TestCasesArea({ useCase, testSuiteId, globalHumanFeedback }) {
  const [testCases, setTestCases] = useState([])
  const [executions, setExecutions] = useState({}) // tc.id -> executionsList
  const [expandedCases, setExpandedCases] = useState({}) // tc.id -> boolean

  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newTcName, setNewTcName] = useState('')
  const [newTcPrompt, setNewTcPrompt] = useState('')

  const [expectedNotes, setExpectedNotes] = useState({})
  const [promptNotes, setPromptNotes] = useState({})
  const [promptEditing, setPromptEditing] = useState({})

  useEffect(() => {
    const initialNotes = {}
    const initialPrompts = {}
    testCases.forEach(tc => {
      initialNotes[tc.id] = tc.expected_output || ''
      initialPrompts[tc.id] = tc.input_prompt || ''
    })
    setExpectedNotes(initialNotes)
    setPromptNotes(initialPrompts)
  }, [testCases])

  const handleSaveNote = async (tcId) => {
    try {
      await axios.patch(`${API_URL}/testing/testcases/${tcId}`, {
        expected_output: expectedNotes[tcId]
      })
      alert("Note saved successfully")
    } catch (e) {
      alert("Failed to save note: " + e.message)
    }
  }

  const handleSavePrompt = async (tcId) => {
    try {
      await axios.patch(`${API_URL}/testing/testcases/${tcId}`, {
        input_prompt: promptNotes[tcId]
      })
      alert("Prompt saved successfully")
      loadTestCases()
      setPromptEditing(prev => ({ ...prev, [tcId]: false }))
    } catch (e) {
      alert("Failed to save prompt: " + e.message)
    }
  }

  // Adaptive testing states
  const [activeExecution, setActiveExecution] = useState(null)
  const [humanAnswer, setHumanAnswer] = useState('')

  useEffect(() => {
    loadTestCases()
  }, [useCase.id, testSuiteId])

  const loadTestCases = async () => {
    try {
      const res = await axios.get(`${API_URL}/testing/testcases/${useCase.id}`)
      setTestCases(res.data)

      // Load executions for each
      res.data.forEach(tc => loadExecutions(tc.id))
    } catch (e) {
      console.error(e)
    }
  }

  const loadExecutions = async (tcId) => {
    try {
      const url = testSuiteId
        ? `${API_URL}/testing/executions/${tcId}?suite_id=${testSuiteId}`
        : `${API_URL}/testing/executions/${tcId}`;
      const res = await axios.get(url)
      setExecutions(prev => ({ ...prev, [tcId]: res.data }))
    } catch (e) {
      console.error(e)
    }
  }

  const handleCreateTestCase = async (e) => {
    e.preventDefault()
    if (newTcName && newTcPrompt) {
      try {
        await axios.post(`${API_URL}/testing/testcases`, {
          use_case_id: useCase.id,
          name: newTcName,
          description: "Manually created TC",
          input_prompt: newTcPrompt
        })
        loadTestCases()
        setShowCreateForm(false)
        setNewTcName('')
        setNewTcPrompt('')
      } catch (e) {
        alert(e.message)
      }
    }
  }

  const handleDeleteExecution = async (exId, tcId) => {
    if (window.confirm("Delete this execution record?")) {
      try {
        await axios.delete(`${API_URL}/testing/executions/${exId}`)
        loadExecutions(tcId)
      } catch (e) {
        alert("Failed to delete execution: " + e.message)
      }
    }
  }

  const handleDeleteTestCase = async (tcId) => {
    if (window.confirm("Delete this test case and all its runs?")) {
      try {
        await axios.delete(`${API_URL}/testing/testcases/${tcId}`);
        loadTestCases();
      } catch (e) {
        alert("Failed to delete: " + e.message);
      }
    }
  }

  const handleRunTestCase = async (tcId, e) => {
    if (e) e.stopPropagation();
    if (!testSuiteId) {
      alert("Please select an Active Test Cycle before running tests.");
      return;
    }
    try {
      const payload = {
        test_case_id: tcId,
        test_suite_id: testSuiteId,
        human_feedback: globalHumanFeedback || null
      };

      const res = await axios.post(`${API_URL}/testing/execute`, payload)
      loadExecutions(tcId)

      // Auto-expand on run
      setExpandedCases(prev => ({ ...prev, [tcId]: true }));

      if (res.data.requires_human_input) {
        setActiveExecution(res.data)
      }
    } catch (e) {
      alert("Execution failed: " + e.message)
    }
  }

  const toggleExpand = (tcId) => {
    setExpandedCases(prev => ({ ...prev, [tcId]: !prev[tcId] }))
  }

  const handleMarkGroundTruth = async (executionId, tcId) => {
    try {
      await axios.post(`${API_URL}/testing/executions/${executionId}/mark_ground_truth`)
      loadExecutions(tcId)
    } catch (e) {
      alert(e.message)
    }
  }

  const handleSubmitFeedback = async () => {
    try {
      await axios.post(`${API_URL}/testing/executions/${activeExecution.id}/provide_feedback`, { human_answer: humanAnswer })
      setActiveExecution(null)
      setHumanAnswer('')
      loadExecutions(activeExecution.test_case_id)
      alert("Feedback provided, execution resumed.")
    } catch (e) {
      alert(e.message)
    }
  }

  return (
    <div style={{ padding: '16px', paddingLeft: '24px' }}>
      <div className="flex-between" style={{ marginBottom: '16px' }}>
        <h4 style={{ margin: 0, fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', fontWeight: 600 }}>
          Test Cases
        </h4>
        <button onClick={() => setShowCreateForm(!showCreateForm)} style={{ padding: '6px 12px', fontSize: '12px' }}>
          <Sparkles size={14} style={{ marginRight: '6px' }} /> Create Test
        </button>
      </div>

      {showCreateForm && (
        <div className="card" style={{ marginBottom: '24px', background: 'var(--surface-dark)', border: '1px solid var(--border-card)' }}>
          <h3 style={{ fontSize: '15px', color: 'var(--text-primary)', marginBottom: '16px' }}>Create Manual Test Case</h3>
          <form onSubmit={handleCreateTestCase}>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>Test Case Name</label>
              <input
                type="text"
                value={newTcName}
                onChange={e => setNewTcName(e.target.value)}
                placeholder="e.g. Exfiltrate Credit Card Data"
                required
              />
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>Input Prompt</label>
              <textarea
                value={newTcPrompt}
                onChange={e => setNewTcPrompt(e.target.value)}
                placeholder="The exact message to send to the bot..."
                rows={3}
                required
              />
            </div>
            <div className="flex-gap">
              <button type="submit">Create</button>
              <button type="button" className="secondary" onClick={() => setShowCreateForm(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {activeExecution && (
        <div style={{ padding: '16px', background: 'rgba(245, 158, 11, 0.1)', borderLeft: '4px solid var(--neon-amber)', borderRadius: '0 8px 8px 0', marginBottom: '24px' }}>
          <h3 style={{ color: 'var(--neon-amber)', fontSize: '16px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Activity size={18} /> Adaptive Testing Pause
          </h3>
          <p style={{ fontSize: '14px', marginBottom: '12px', color: 'var(--text-primary)' }}><strong>Agent Question:</strong> {activeExecution.human_question}</p>
          <textarea
            value={humanAnswer}
            onChange={(e) => setHumanAnswer(e.target.value)}
            placeholder="Provide information to the agent..."
            rows="3"
          />
          <button onClick={handleSubmitFeedback} style={{ background: 'var(--neon-amber)', color: '#000', marginTop: '8px' }}>Send Answer & Resume</button>
        </div>
      )}

      {testCases.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', background: 'var(--surface-dark)', border: '1px solid var(--border-card)', borderRadius: '8px' }}>
          <p style={{ color: 'var(--text-muted)' }}>No test cases yet. Create one manually or regenerate Use Cases.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', borderTop: '1px solid var(--border-card)' }}>
          {testCases.map(tc => {
            const isExpanded = !!expandedCases[tc.id];
            return (
              <div key={tc.id} style={{ margin: 0, padding: 0, overflow: 'hidden', borderBottom: '1px solid var(--border-card)' }}>
                {/* Header / Click To Expand - Table Layout */}
                <div
                  className="flex-between"
                  style={{ padding: 0, cursor: 'pointer', background: isExpanded ? 'var(--surface-elevated)' : 'transparent', display: 'flex', transition: 'background 0.2s' }}
                  onClick={() => toggleExpand(tc.id)}
                  onMouseEnter={(e) => { if (!isExpanded) e.currentTarget.style.background = 'var(--surface-elevated)' }}
                  onMouseLeave={(e) => { if (!isExpanded) e.currentTarget.style.background = 'transparent' }}
                >
                  {/* Status / Run Count Column */}
                  <div style={{ width: '100px', padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRight: '1px solid var(--border-card)' }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 600 }}>Latest Score</div>
                      {executions[tc.id] && executions[tc.id].length > 0 ? (
                        <span style={{ fontSize: '14px', fontWeight: 600, color: executions[tc.id][0].evaluation_score >= 0.8 ? 'var(--neon-mantis)' : (executions[tc.id][0].evaluation_score >= 0.5 ? 'var(--neon-amber)' : 'var(--neon-red)') }}>
                          {(executions[tc.id][0].evaluation_score * 100).toFixed(0)}%
                        </span>
                      ) : (
                        <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>-</span>
                      )}
                    </div>
                  </div>

                  {/* Content Column */}
                  <div className="flex-gap" style={{ flex: 1, padding: '16px', minWidth: 0 }}>
                    {isExpanded ? <ChevronDown size={18} color="var(--text-muted)" style={{ flexShrink: 0 }} /> : <ChevronRight size={18} color="var(--text-muted)" style={{ flexShrink: 0 }} />}
                    <div style={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: '4px' }}>
                        <div style={{ fontWeight: 500, fontSize: '13px', color: 'var(--text-primary)', whiteSpace: 'normal', overflowWrap: 'break-word', wordBreak: 'normal' }}>
                          {tc.visual_id ? <span style={{ color: 'var(--text-muted)', marginRight: '6px' }}>{tc.visual_id}</span> : null}
                          {tc.name}
                        </div>
                      </div>
                      <div style={{ fontSize: '13px', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {tc.input_prompt}
                      </div>
                    </div>

                    {/* Actions Column */}
                    <div className="flex-gap" style={{ padding: '16px', flexShrink: 0 }}>
                      <button onClick={(e) => handleRunTestCase(tc.id, e)} disabled={!testSuiteId} title={!testSuiteId ? "Select a Test Cycle first" : ""} style={{ padding: '6px 12px', fontSize: '12px', opacity: !testSuiteId ? 0.5 : 1, cursor: !testSuiteId ? 'not-allowed' : 'pointer' }}><Play size={12} fill="currentColor" /> Run</button>
                      <button className="icon-btn danger-hover" onClick={(e) => { e.stopPropagation(); handleDeleteTestCase(tc.id); }} title="Delete Test"><Trash2 size={16} /></button>
                    </div>
                  </div>
                </div>

                {/* Collapsible Body */}
                {isExpanded && (
                  <div style={{ padding: '16px', borderTop: '1px solid var(--border-card)', background: 'var(--bg-void)' }}>
                    <div style={{ marginBottom: '16px' }}>
                      <div className="flex-between" style={{ marginBottom: '8px' }}>
                        <h4 style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', margin: 0 }}>Test Case Prompt</h4>
                        {!promptEditing[tc.id] && (
                          <button className="icon-btn" onClick={() => setPromptEditing(prev => ({ ...prev, [tc.id]: true }))} title="Edit Prompt" style={{ padding: '4px' }}>
                            <Edit2 size={12} />
                          </button>
                        )}
                      </div>

                      {promptEditing[tc.id] ? (
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <textarea
                            value={promptNotes[tc.id] || ''}
                            onChange={(e) => setPromptNotes(prev => ({ ...prev, [tc.id]: e.target.value }))}
                            placeholder="Enter primary test case instruction here..."
                            style={{ flex: 1, padding: '12px', background: 'var(--surface-dark)', border: '1px solid var(--neon-amber)', borderRadius: '6px', color: 'var(--text-primary)', fontSize: '14px', minHeight: '80px', resize: 'vertical', fontFamily: "var(--font-mono)", lineHeight: 1.5 }}
                          />
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <button className="secondary" onClick={() => handleSavePrompt(tc.id)} style={{ padding: '8px 16px', height: 'fit-content', border: '1px solid var(--neon-mantis)', color: 'var(--neon-mantis)' }}>Save</button>
                            <button className="icon-btn" onClick={() => setPromptEditing(prev => ({ ...prev, [tc.id]: false }))} style={{ padding: '8px 16px', height: 'fit-content' }}>Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <div style={{ background: 'var(--surface-elevated)', padding: '12px 16px', borderRadius: '6px', border: '1px solid var(--border-card)' }}>
                          <p style={{ fontSize: '14px', color: 'var(--text-primary)', fontFamily: "var(--font-mono)", margin: 0, whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{tc.input_prompt}</p>
                        </div>
                      )}
                    </div>

                    <div style={{ marginBottom: '16px' }}>
                      <h4 style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', marginBottom: '8px' }}>Expected Output Note (For AI Evaluation)</h4>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <textarea
                          value={expectedNotes[tc.id] || ''}
                          onChange={(e) => setExpectedNotes(prev => ({ ...prev, [tc.id]: e.target.value }))}
                          placeholder="Optional criteria for the AI evaluation engine to use as a heuristic..."
                          style={{ flex: 1, padding: '8px', background: 'var(--surface-dark)', border: '1px solid var(--border-card)', borderRadius: '4px', color: 'var(--text-primary)', fontSize: '13px', minHeight: '40px', resize: 'vertical' }}
                        />
                        <button className="primary" onClick={() => handleSaveNote(tc.id)} style={{ padding: '8px 16px', height: 'fit-content' }}>Save Note</button>
                      </div>
                    </div>

                    <div>
                      <h4 style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', marginBottom: '12px' }}>Execution History</h4>
                      {(executions[tc.id] || []).map(ex => (
                        <div key={ex.id} className="execution-row">
                          <div className="flex-between" style={{ marginBottom: '8px' }}>
                            <div className="flex-gap" style={{ gap: '8px' }}>
                              {ex.is_ground_truth && <span className="pill warning"><CheckCircle size={12} style={{ marginRight: '4px' }} /> Truth</span>}
                              <span className={`pill ${ex.evaluation_score >= 0.8 ? 'pass' : (ex.evaluation_score >= 0.5 ? 'running' : 'fail')}`}>
                                Score: {(ex.evaluation_score * 100).toFixed(0)}%
                              </span>
                              {ex.requires_human_input && <span style={{ fontSize: '12px', color: 'var(--neon-amber)' }}>(Waiting)</span>}
                            </div>
                            {!ex.is_ground_truth && !ex.requires_human_input && (
                              <button className="secondary" onClick={() => handleMarkGroundTruth(ex.id, tc.id)} style={{ padding: '4px 8px', fontSize: '11px' }}>
                                Mark Truth
                              </button>
                            )}
                            <button className="icon-btn danger-hover" onClick={() => handleDeleteExecution(ex.id, tc.id)} title="Delete Execution" style={{ padding: '4px' }}>
                              <Trash2 size={12} />
                            </button>
                          </div>

                          {ex.result_output && (() => {
                            const parts = ex.result_output.split('\n\nAI Grade Reason:\n');
                            const responseText = parts[0].replace(/^(Response:\n|Transcript:\n)/, '');
                            const isTranscript = parts[0].startsWith('Transcript:\n');
                            const aiReason = parts[1];
                            return (
                              <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <div className="code-block" style={{ margin: 0 }}>
                                  <div style={{ color: 'var(--text-secondary)', fontSize: '11px', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
                                    {isTranscript ? 'Agentic Conversation Transcript' : 'Bot Response'}
                                  </div>
                                  <div className="markdown-body">
                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{responseText}</ReactMarkdown>
                                  </div>
                                </div>
                                {aiReason && (
                                  <div className="code-block" style={{ margin: 0, borderLeft: '3px solid var(--neon-amber)', background: 'rgba(243, 156, 18, 0.05)' }}>
                                    <div style={{ color: 'var(--neon-amber)', fontSize: '11px', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>AI Evaluation Breakdown</div>
                                    <div style={{ whiteSpace: 'pre-wrap' }}>{aiReason}</div>
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                      ))}
                      {!(executions[tc.id] || []).length && <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>No runs yet.</span>}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )
      }
    </div>
  )
}


function SecurityArea({ bot, datasets, evaluations, onRefresh }) {
  // Legacy attacks UI wrapped to target the selected Bot
  const [activeTab, setActiveTab] = useState('attacks')

  return (
    <div>
      <nav style={{ marginBottom: '24px', display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-card)', paddingBottom: '12px' }}>
        {['attacks', 'security_datasets', 'evaluations'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              background: activeTab === tab ? 'rgba(244, 63, 94, 0.1)' : 'transparent',
              color: activeTab === tab ? 'var(--neon-red)' : 'var(--text-secondary)',
              border: 'none',
              boxShadow: 'none',
              padding: '8px 16px',
              fontSize: '14px',
              fontWeight: 500
            }}
          >
            {tab.replace('_', ' ').charAt(0).toUpperCase() + tab.replace('_', ' ').slice(1)}
          </button>
        ))}
      </nav>

      {/* Note: Target is hardcoded to the active Bot */}
      {activeTab === 'attacks' && <AttacksTab targets={[bot]} defaultTarget={bot.id} />}
      {activeTab === 'security_datasets' && <DatasetsTab datasets={datasets.filter(d => d.target_id === bot.id)} targets={[bot]} defaultTarget={bot.id} onRefresh={onRefresh} />}
      {activeTab === 'evaluations' && <EvaluationsTab evaluations={evaluations.filter(e => e.target_id === bot.id)} datasets={datasets.filter(d => d.target_id === bot.id)} targets={[bot]} defaultTarget={bot.id} onRefresh={onRefresh} />}
    </div>
  )
}


// Legacy Components adapted to support defaultTarget override

function AttacksTab({ targets, defaultTarget }) {
  const [selectedTarget, setSelectedTarget] = useState(defaultTarget || '')
  const [attackType, setAttackType] = useState('prompt_injection')
  const [attackMode, setAttackMode] = useState('single')
  const [targetBehavior, setTargetBehavior] = useState('')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [attackHistory, setAttackHistory] = useState([])
  const [showHistory, setShowHistory] = useState(true)

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const response = await axios.get(`${API_URL}/attacks/`)
        setAttackHistory(response.data)
      } catch (error) {
        console.error('Failed to fetch attack history:', error)
      }
    }
    fetchHistory()
    const intervalId = setInterval(fetchHistory, 5000)
    return () => clearInterval(intervalId)
  }, [result])

  const handleAttack = async () => {
    if (!selectedTarget) return alert('Select target')
    setLoading(true)
    setResult(null)
    try {
      const response = await axios.post(`${API_URL}/attacks/execute`, {
        target_id: selectedTarget, attack_type: attackType, attack_mode: attackMode,
        enable_improvement: true, max_improvement_iterations: 3, variables: { target_behavior: targetBehavior || 'bypass restrictions' }
      })
      setResult(response.data)
    } catch (error) {
      alert('Attack failed: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <div className="card">
        <h2 className="card-title">Execute Attack</h2>
        {/* We hide target selector if defaultTarget is provided because we know the Bot context */}
        {!defaultTarget && (
          <>
            <label>Target Application</label>
            <select value={selectedTarget} onChange={e => setSelectedTarget(e.target.value)}>
              <option value="">Select a target...</option>
              {targets.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </>
        )}
        <label>Attack Type</label>
        <select value={attackType} onChange={e => setAttackType(e.target.value)}>
          <option value="prompt_injection">Prompt Injection</option>
          <option value="role_playing">Role Playing</option>
          <option value="jailbreak">Jailbreak</option>
          <option value="persuasion">Persuasion</option>
          <option value="storytelling">Storytelling</option>
          <option value="encoding">Encoding</option>
        </select>
        <label>Attack Mode</label>
        <select value={attackMode} onChange={e => setAttackMode(e.target.value)}>
          <option value="single">Single Turn</option>
          <option value="sequential">Sequential</option>
          <option value="adaptive">Adaptive</option>
        </select>
        <label>Target Behavior (Optional)</label>
        <input value={targetBehavior} onChange={e => setTargetBehavior(e.target.value)} placeholder="e.g., bypass restrictions" />
        <button onClick={handleAttack} disabled={loading || !selectedTarget}>{loading ? 'Executing...' : 'Execute Attack'}</button>
      </div>
      {/* ... legacy rendering for results ... */}
    </div>
  )
}

function DatasetsTab({ datasets, targets, defaultTarget, onRefresh }) {
  const [selectedTarget, setSelectedTarget] = useState(defaultTarget || '')
  const [attackTypes] = useState(['prompt_injection', 'role_playing'])
  const [numExamples, setNumExamples] = useState(10)

  const handleGenerate = async () => {
    try {
      await axios.post(`${API_URL}/datasets/generate`, { target_id: selectedTarget, attack_types: attackTypes, num_examples_per_type: numExamples })
      onRefresh()
      alert('Dataset generated successfully!')
    } catch (error) {
      alert(`Failed to generate dataset`)
    }
  }

  return (
    <div>
      <div className="card">
        <h2 className="card-title">Generate Test Dataset</h2>
        <label>Number of Examples per Type</label>
        <input type="number" value={numExamples} onChange={e => setNumExamples(parseInt(e.target.value))} min="1" max="50" />
        <button onClick={handleGenerate}>Generate Dataset</button>
      </div>
      {/* legacy list dataset rendering */}
    </div>
  )
}

function EvaluationsTab({ evaluations, datasets, targets, defaultTarget, onRefresh }) {
  const [selectedTarget, setSelectedTarget] = useState(defaultTarget || '')
  const [selectedDataset, setSelectedDataset] = useState('')
  const [loading, setLoading] = useState(false)

  const handleEvaluate = async () => {
    setLoading(true)
    try {
      await axios.post(`${API_URL}/evaluation/run`, { target_id: selectedTarget, dataset_id: selectedDataset })
      onRefresh()
      alert('Evaluation completed!')
    } catch (error) {
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <div className="card">
        <h2 className="card-title">Run Security Evaluation</h2>
        <label>Test Dataset</label>
        <select value={selectedDataset} onChange={e => setSelectedDataset(e.target.value)}>
          <option value="">Select a dataset...</option>
          {datasets.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <button onClick={handleEvaluate} disabled={loading || !selectedDataset}>{loading ? 'Evaluating...' : 'Run Evaluation'}</button>
      </div>
    </div>
  )
}


function TestCyclesArea({ bot, selectedProjectId }) {
  const [suitesData, setSuitesData] = useState([])
  const [loading, setLoading] = useState(true)
  const [expandedSuite, setExpandedSuite] = useState(null)
  const [suiteExecutions, setSuiteExecutions] = useState({})
  const [expandedExecution, setExpandedExecution] = useState(null)
  const [exportingId, setExportingId] = useState(null)
  const [exportExpanding, setExportExpanding] = useState(null)

  useEffect(() => {
    loadTestCycles()
  }, [bot.id, selectedProjectId])

  const loadTestCycles = async () => {
    setLoading(true)
    try {
      const projParam = selectedProjectId ? `?project_id=${selectedProjectId}` : '';
      const res = await axios.get(`${API_URL}/testing/suites/${bot.id}${projParam}`)
      const suites = res.data

      const enrichedSuites = await Promise.all(suites.map(async (suite) => {
        try {
          const statsRes = await axios.get(`${API_URL}/testing/stats/${bot.id}?suite_id=${suite.id}`)
          return { ...suite, stats: statsRes.data }
        } catch (e) {
          return { ...suite, stats: null }
        }
      }))

      // Sort by creation date descending
      enrichedSuites.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      setSuitesData(enrichedSuites)
    } catch (e) {
      console.error("Failed to load test cycles", e)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteSuite = async (suiteId, e) => {
    e.stopPropagation();
    if (!window.confirm("Are you sure you want to delete this Test Cycle? All associated execution results will be permanently deleted.")) return;
    try {
      await axios.delete(`${API_URL}/testing/suites/${suiteId}`)
      loadTestCycles()
    } catch (e) {
      alert("Failed to delete test cycle: " + e.message)
    }
  }

  const toggleSuite = async (suiteId) => {
    if (expandedSuite === suiteId) {
      setExpandedSuite(null)
      return
    }
    setExpandedSuite(suiteId)
    if (!suiteExecutions[suiteId]) {
      try {
        const res = await axios.get(`${API_URL}/testing/suites/${suiteId}/executions`)
        const uniqueExecutions = [];
        const seenTestCases = new Set();
        for (const ex of res.data) {
          if (!seenTestCases.has(ex.test_case_id)) {
            seenTestCases.add(ex.test_case_id);
            uniqueExecutions.push(ex);
          }
        }
        setSuiteExecutions(prev => ({ ...prev, [suiteId]: uniqueExecutions }))
      } catch (e) {
        console.error("Failed to load suite executions", e)
      }
    }
  }

  const handleExportPDF = async (suiteId, suiteName, e) => {
    e.stopPropagation();
    setExportingId(suiteId);

    // Auto-expand if not already expanded so we capture the results
    if (expandedSuite !== suiteId) {
      await toggleSuite(suiteId);
      // Give React a moment to render the expanded DOM block
      await new Promise(r => setTimeout(r, 500));
    }

    // Temporarily trigger all inner executions to expand for full data capture
    setExportExpanding(suiteId);
    await new Promise(r => setTimeout(r, 800));

    const element = document.getElementById(`suite-card-${suiteId}`);
    if (!element) {
      setExportingId(null);
      setExportExpanding(null);
      return;
    }

    // Swap to native Print API for perfect Vector PDF generation instead of blurry canvas images
    document.body.classList.add('print-mode');
    element.classList.add('print-target');

    // Provide a small tick for CSS to apply the print-mode overrides
    setTimeout(() => {
      window.print();

      // The print dialog pauses JS execution. When it closes, we clean up.
      document.body.classList.remove('print-mode');
      element.classList.remove('print-target');
      setExportingId(null);
      setExportExpanding(null);
    }, 150);
  }

  if (loading) return <div style={{ color: 'var(--text-muted)' }}>Loading Test Cycles...</div>
  if (suitesData.length === 0) return <div className="card"><p style={{ color: 'var(--text-muted)' }}>No test cycles found for this bot.</p></div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {suitesData.map(suite => (
        <div id={`suite-card-${suite.id}`} key={suite.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px', borderLeft: '4px solid var(--accent-cyan)', cursor: 'pointer' }} onClick={() => toggleSuite(suite.id)}>
          <div className="flex-between">
            <div className="flex-gap">
              {expandedSuite === suite.id ? <ChevronDown size={18} color="var(--text-muted)" style={{ flexShrink: 0 }} /> : <ChevronRight size={18} color="var(--text-muted)" style={{ flexShrink: 0 }} />}
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', color: 'var(--text-primary)' }}>{suite.name}</h3>
                <p style={{ margin: 0, marginTop: '4px', fontSize: '13px', color: 'var(--text-secondary)' }}>{suite.description || 'No description provided'}</p>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ textAlign: 'right', fontSize: '12px', color: 'var(--text-muted)' }}>
                Created: {new Date(suite.created_at).toLocaleString()}
              </div>
              {exportingId !== suite.id && (
                <>
                  <button
                    className="secondary"
                    onClick={(e) => handleExportPDF(suite.id, suite.name, e)}
                    title="Export PDF Report"
                    style={{ padding: '4px 8px', fontSize: '11px' }}
                  >
                    Export PDF
                  </button>
                  <button className="icon-btn danger-hover" onClick={(e) => handleDeleteSuite(suite.id, e)} title="Delete Test Cycle">
                    <Trash2 size={16} />
                  </button>
                </>
              )}
            </div>
          </div>

          {suite.stats && (
            <div className="grid grid-4" style={{ marginTop: '8px' }}>
              <div style={{ padding: '12px', background: 'var(--surface-dark)', borderRadius: '6px', border: '1px solid var(--border-card)' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px', fontWeight: 600 }}>Total Executions</div>
                <div style={{ fontSize: '20px', fontWeight: 600, color: 'var(--text-primary)' }}>{suite.stats.run_tests} <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 400 }}>/ {suite.stats.total_tests}</span></div>
              </div>
              <div style={{ padding: '12px', background: 'var(--surface-dark)', borderRadius: '6px', border: '1px solid var(--border-card)' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px', fontWeight: 600 }}>Pass Rate</div>
                <div style={{ fontSize: '20px', fontWeight: 600, color: 'var(--neon-mantis)' }}>{suite.stats.pass_rate}%</div>
              </div>
              <div style={{ padding: '12px', background: 'var(--surface-dark)', borderRadius: '6px', border: '1px solid var(--border-card)' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px', fontWeight: 600 }}>Fail Rate</div>
                <div style={{ fontSize: '20px', fontWeight: 600, color: 'var(--neon-red)' }}>{suite.stats.fail_rate}%</div>
              </div>
              <div style={{ padding: '12px', background: 'var(--surface-dark)', borderRadius: '6px', border: '1px solid var(--border-card)' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px', fontWeight: 600 }}>Avg AI Score</div>
                <div style={{ fontSize: '20px', fontWeight: 600, color: 'var(--neon-amber)' }}>{suite.stats.avg_score}</div>
              </div>
            </div>
          )}

          {expandedSuite === suite.id && (
            <div style={{ marginTop: '16px', borderTop: '1px solid var(--border-card)', paddingTop: '16px' }} onClick={(e) => e.stopPropagation()}>
              <h4 style={{ fontSize: '13px', color: 'var(--text-primary)', marginBottom: '16px' }}>Execution Results</h4>
              {!suiteExecutions[suite.id] ? (
                <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Loading executions...</div>
              ) : suiteExecutions[suite.id].length === 0 ? (
                <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>No executions found.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                  {suiteExecutions[suite.id].map(ex => (
                    <div key={ex.id} className="execution-row" style={{ cursor: 'pointer' }} onClick={() => setExpandedExecution(expandedExecution === ex.id ? null : ex.id)}>
                      <div className="flex-between">
                        <div className="flex-gap" style={{ gap: '12px', flex: 1, minWidth: 0 }}>
                          {(expandedExecution === ex.id || exportExpanding === suite.id) ? <ChevronDown size={14} color={exportExpanding === suite.id ? '#000000' : "var(--text-muted)"} style={{ flexShrink: 0 }} /> : <ChevronRight size={14} color={exportExpanding === suite.id ? '#000000' : "var(--text-muted)"} style={{ flexShrink: 0 }} />}
                          <span className={`pill ${ex.evaluation_score >= 0.8 ? 'pass' : (ex.evaluation_score >= 0.5 ? 'running' : 'fail')}`} style={{ flexShrink: 0 }}>
                            Score: {(ex.evaluation_score * 100).toFixed(0)}%
                          </span>
                          <span style={{ fontSize: '13px', color: exportExpanding === suite.id ? '#000000' : 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>
                            <strong style={{ color: exportExpanding === suite.id ? '#333333' : 'var(--text-muted)', marginRight: '6px' }}>{ex.test_case_name}:</strong>
                            {ex.test_case_prompt}
                          </span>
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', flexShrink: 0, paddingLeft: '12px' }}>
                          {new Date(ex.executed_at).toLocaleString()}
                        </div>
                      </div>

                      {(expandedExecution === ex.id || exportExpanding === suite.id) && ex.result_output && (() => {
                        const parts = ex.result_output.split('\n\nAI Grade Reason:\n');
                        const responseText = parts[0].replace(/^(Response:\n|Transcript:\n)/, '');
                        const isTranscript = parts[0].startsWith('Transcript:\n');
                        const aiReason = parts[1];
                        return (
                          <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px', cursor: 'default' }} onClick={(e) => e.stopPropagation()}>
                            <div className="code-block" style={{ margin: 0, padding: '12px', background: exportExpanding === suite.id ? '#F8FAFC' : 'var(--bg-void)' }}>
                              <div style={{ color: exportExpanding === suite.id ? '#333333' : 'var(--text-secondary)', fontSize: '11px', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
                                {isTranscript ? 'Agentic Conversation Transcript' : 'Bot Response'}
                              </div>
                              <div className="markdown-body" style={{ color: exportExpanding === suite.id ? '#000000' : 'var(--text-primary)' }}>
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>{responseText}</ReactMarkdown>
                              </div>
                            </div>
                            {aiReason && (
                              <div className="code-block" style={{ margin: 0, padding: '12px', borderLeft: exportExpanding === suite.id ? '3px solid #F59E0B' : '3px solid var(--neon-amber)', background: exportExpanding === suite.id ? '#FFFBEB' : 'rgba(243, 156, 18, 0.05)' }}>
                                <div style={{ color: exportExpanding === suite.id ? '#D97706' : 'var(--neon-amber)', fontSize: '11px', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>AI Evaluation Breakdown</div>
                                <div style={{ whiteSpace: 'pre-wrap', color: exportExpanding === suite.id ? '#000000' : 'var(--text-primary)' }}>{aiReason}</div>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// Main Application Routing
function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/*"
        element={
          <PrivateRoute>
            <DashboardLayout />
          </PrivateRoute>
        }
      />
    </Routes>
  );
}

export default App;
