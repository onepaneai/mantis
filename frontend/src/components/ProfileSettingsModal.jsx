import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { X, UserPlus, Key, LogOut, Check, Copy, User, Zap, Trash2, CheckCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const API_URL = import.meta.env.DEV ? 'http://localhost:8000/api/v1' : '/api/v1';

const ProfileSettingsModal = ({ onClose }) => {
    const { user, activeOrgId, logout } = useAuth();

    const [activeTab, setActiveTab] = useState('organization');
    const [members, setMembers] = useState([]);
    const [apiKeys, setApiKeys] = useState([]);

    // Invite State
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteRole, setInviteRole] = useState('reader');

    // New API Key State
    const [newlyGeneratedKey, setNewlyGeneratedKey] = useState(null);

    // LLM Config State
    const [organizationDetails, setOrganizationDetails] = useState(null);
    const [geminiApiKey, setGeminiApiKey] = useState('');
    const [savedModels, setSavedModels] = useState([]);
    const [newModelProvider, setNewModelProvider] = useState('gemini');
    const [newModelName, setNewModelName] = useState('');

    useEffect(() => {
        if (activeOrgId) {
            loadMembers();
            loadApiKeys();
            loadLlmConfig();
        }
    }, [activeOrgId]);

    const loadMembers = async () => {
        try {
            const { data } = await axios.get(`${API_URL}/organizations/${activeOrgId}/members`);
            setMembers(data);
        } catch (e) {
            console.error("Failed to load members", e);
        }
    };

    const loadApiKeys = async () => {
        try {
            const { data } = await axios.get(`${API_URL}/apikeys/`);
            setApiKeys(data);
        } catch (e) {
            console.error("Failed to load API keys", e);
        }
    };

    const handleInvite = async (e) => {
        e.preventDefault();
        try {
            await axios.post(`${API_URL}/organizations/${activeOrgId}/invites`, {
                email: inviteEmail,
                role: inviteRole
            });
            setInviteEmail('');
            loadMembers();
            alert("Member invited successfully!");
        } catch (e) {
            alert("Failed to invite member: " + (e.response?.data?.detail || e.message));
        }
    };

    const handleGenerateKey = async () => {
        try {
            const { data } = await axios.post(`${API_URL}/apikeys/`);
            setNewlyGeneratedKey(data.key);
            loadApiKeys();
        } catch (e) {
            alert("Failed to generate API Key: " + (e.response?.data?.detail || e.message));
        }
    };

    const handleRevokeKey = async (keyId) => {
        try {
            await axios.delete(`${API_URL}/apikeys/${keyId}`);
            loadApiKeys();
        } catch (e) {
            alert("Failed to revoke API Key: " + (e.response?.data?.detail || e.message));
        }
    };

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text);
        alert("Copied to clipboard!");
    };

    const loadLlmConfig = async () => {
        try {
            const { data } = await axios.get(`${API_URL}/organizations/`);
            const org = data.find(o => o.id === activeOrgId);
            if (org) {
                setOrganizationDetails(org);
                setSavedModels(org.llm_models || []);
            }
        } catch (e) {
            console.error("Failed to load LLM config", e);
        }
    };

    const handleSaveProviderKeys = async () => {
        try {
            const payload = {};
            if (geminiApiKey) payload.gemini_api_key = geminiApiKey;

            const { data } = await axios.patch(`${API_URL}/organizations/${activeOrgId}/api-keys`, payload);
            setOrganizationDetails(data);
            setSavedModels(data.llm_models || []);
            setGeminiApiKey('');
            alert("Provider keys updated!");
        } catch (e) {
            alert("Failed to save keys: " + (e.response?.data?.detail || e.message));
        }
    };

    const handleAddModel = async (e) => {
        e.preventDefault();
        try {
            const { data } = await axios.post(`${API_URL}/organizations/${activeOrgId}/models`, {
                provider: newModelProvider,
                model_name: newModelName
            });
            setSavedModels([...savedModels, data]);
            setNewModelName('');
        } catch (e) {
            alert("Failed to add model: " + (e.response?.data?.detail || e.message));
        }
    };

    const handleActivateModel = async (modelId) => {
        try {
            const { data } = await axios.post(`${API_URL}/organizations/${activeOrgId}/models/${modelId}/activate`);
            setOrganizationDetails(data);
            setSavedModels(data.llm_models || []);
        } catch (e) {
            alert("Failed to activate model: " + (e.response?.data?.detail || e.message));
        }
    };

    const handleDeleteModel = async (modelId) => {
        try {
            await axios.delete(`${API_URL}/organizations/${activeOrgId}/models/${modelId}`);
            loadLlmConfig();
        } catch (e) {
            alert("Failed to delete model: " + (e.response?.data?.detail || e.message));
        }
    };

    // Check if current user is owner or member to allow mutations
    const currentUserMembership = members.find(m => m.user_id === user?.id);
    const isReadOnly = currentUserMembership?.role === 'reader';

    return (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="card" style={{ width: '650px', maxHeight: '90vh', overflowY: 'auto', background: 'var(--surface-dark)', border: '1px solid var(--border-card)', padding: '0' }}>

                {/* Header */}
                <div style={{ padding: '24px', borderBottom: '1px solid var(--border-card)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-void)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        {user?.picture ? (
                            <img src={user.picture} alt="Profile" style={{ width: '48px', height: '48px', borderRadius: '50%' }} />
                        ) : (
                            <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'var(--border-card)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <User size={24} color="var(--text-secondary)" />
                            </div>
                        )}
                        <div>
                            <h2 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '18px' }}>{user?.name}</h2>
                            <div style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>{user?.email}</div>
                        </div>
                    </div>
                    <button className="icon-btn" onClick={onClose}><X size={24} /></button>
                </div>

                {/* Tabs */}
                <div style={{ display: 'flex', padding: '0 24px', borderBottom: '1px solid var(--border-card)', background: 'var(--bg-card)' }}>
                    <button
                        onClick={() => setActiveTab('organization')}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            padding: '16px 20px',
                            color: activeTab === 'organization' ? 'var(--neon-mantis)' : 'var(--text-secondary)',
                            borderBottom: activeTab === 'organization' ? '2px solid var(--neon-mantis)' : '2px solid transparent',
                            cursor: 'pointer',
                            fontWeight: activeTab === 'organization' ? 600 : 400
                        }}
                    >
                        <UserPlus size={16} style={{ display: 'inline', marginRight: '8px', verticalAlign: 'text-bottom' }} /> Organization
                    </button>
                    <button
                        onClick={() => setActiveTab('apikeys')}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            padding: '16px 20px',
                            color: activeTab === 'apikeys' ? 'var(--neon-mantis)' : 'var(--text-secondary)',
                            borderBottom: activeTab === 'apikeys' ? '2px solid var(--neon-mantis)' : '2px solid transparent',
                            cursor: 'pointer',
                            fontWeight: activeTab === 'apikeys' ? 600 : 400
                        }}
                    >
                        <Key size={16} style={{ display: 'inline', marginRight: '8px', verticalAlign: 'text-bottom' }} /> Extension Keys
                    </button>
                    <button
                        onClick={() => setActiveTab('llm')}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            padding: '16px 20px',
                            color: activeTab === 'llm' ? 'var(--neon-mantis)' : 'var(--text-secondary)',
                            borderBottom: activeTab === 'llm' ? '2px solid var(--neon-mantis)' : '2px solid transparent',
                            cursor: 'pointer',
                            fontWeight: activeTab === 'llm' ? 600 : 400
                        }}
                    >
                        <Zap size={16} style={{ display: 'inline', marginRight: '8px', verticalAlign: 'text-bottom' }} /> LLM Models
                    </button>
                </div>

                {/* Content */}
                <div style={{ padding: '24px' }}>

                    {activeTab === 'organization' && (
                        <div>
                            <h3 style={{ marginTop: 0, marginBottom: '16px' }}>Team Members</h3>

                            <div style={{ background: 'var(--bg-void)', border: '1px solid var(--border-card)', borderRadius: '8px', overflow: 'hidden', marginBottom: '24px' }}>
                                {members.map(m => (
                                    <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid var(--border-card)' }}>
                                        <div>
                                            <div style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{m.user?.name || m.user?.email}</div>
                                            <div style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{m.user?.email}</div>
                                        </div>
                                        <div style={{
                                            padding: '4px 8px',
                                            borderRadius: '4px',
                                            fontSize: '12px',
                                            background: m.role === 'owner' ? 'rgba(56, 189, 248, 0.1)' : m.role === 'member' ? 'rgba(74, 222, 128, 0.1)' : 'rgba(255, 255, 255, 0.05)',
                                            color: m.role === 'owner' ? '#38BDF8' : m.role === 'member' ? '#4ADE80' : 'var(--text-secondary)'
                                        }}>
                                            {m.role.toUpperCase()}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {!isReadOnly && (
                                <div>
                                    <h4 style={{ marginBottom: '12px' }}>Invite New Member</h4>
                                    <form onSubmit={handleInvite} style={{ display: 'flex', gap: '12px' }}>
                                        <input
                                            type="email"
                                            placeholder="Email Address"
                                            value={inviteEmail}
                                            onChange={e => setInviteEmail(e.target.value)}
                                            required
                                            style={{ flex: 1 }}
                                        />
                                        <select value={inviteRole} onChange={e => setInviteRole(e.target.value)} style={{ width: '120px' }}>
                                            <option value="reader">Reader</option>
                                            <option value="member">Member</option>
                                        </select>
                                        <button type="submit">Invite</button>
                                    </form>
                                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px' }}>
                                        Readers can view test results and execute existing runs. Members can create and modify bots and rules.
                                    </p>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'apikeys' && (
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                <h3 style={{ margin: 0 }}>Extension API Keys</h3>
                                {!isReadOnly && (
                                    <button onClick={handleGenerateKey} style={{ padding: '6px 12px', fontSize: '13px' }}>Generate New Key</button>
                                )}
                            </div>
                            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '24px' }}>
                                API keys act as your personal authentication token when configuring the local Chrome Extension to communicate with this workspace.
                            </p>

                            {newlyGeneratedKey && (
                                <div style={{ background: 'rgba(74, 222, 128, 0.1)', border: '1px solid #4ADE80', borderRadius: '8px', padding: '16px', marginBottom: '24px' }}>
                                    <div style={{ color: '#4ADE80', fontWeight: 600, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <Check size={16} /> Save this key now
                                    </div>
                                    <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                                        This is the only time you will see this key. Copy it and paste it into the Chrome Extension settings.
                                    </div>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <input type="text" readOnly value={newlyGeneratedKey} style={{ flex: 1, fontFamily: 'monospace', background: 'var(--bg-void)' }} />
                                        <button onClick={() => copyToClipboard(newlyGeneratedKey)} style={{ display: 'flex', alignItems: 'center', gap: '6px' }} className="secondary">
                                            <Copy size={14} /> Copy
                                        </button>
                                    </div>
                                </div>
                            )}

                            <div style={{ background: 'var(--bg-void)', border: '1px solid var(--border-card)', borderRadius: '8px', overflow: 'hidden' }}>
                                {apiKeys.length === 0 ? (
                                    <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                                        No API keys have been generated yet.
                                    </div>
                                ) : (
                                    apiKeys.map(k => (
                                        <div key={k.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid var(--border-card)' }}>
                                            <div>
                                                <div style={{ color: 'var(--text-primary)', fontFamily: 'monospace', fontSize: '14px' }}>{k.display_prefix}</div>
                                                <div style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '4px' }}>
                                                    Created: {new Date(k.created_at).toLocaleDateString()}
                                                </div>
                                            </div>
                                            {!isReadOnly && (
                                                <button onClick={() => handleRevokeKey(k.id)} className="secondary" style={{ padding: '4px 8px', fontSize: '12px', background: 'rgba(239, 68, 68, 0.1)', color: '#EF4444', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                                                    Revoke
                                                </button>
                                            )}
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === 'llm' && (
                        <div>
                            <h3 style={{ marginTop: 0, marginBottom: '16px' }}>Provider API Keys</h3>
                            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '24px' }}>
                                Configure your API keys for AI providers. Keys are stored encrypted and used to power bots across this organization.
                            </p>

                            <div style={{ background: 'var(--bg-void)', border: '1px solid var(--border-card)', borderRadius: '8px', padding: '16px', marginBottom: '32px' }}>
                                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                                    <div style={{ width: '100px', fontWeight: 500 }}>Google Gemini</div>
                                    <input
                                        type="password"
                                        placeholder={organizationDetails?.has_gemini_key ? "•••••••••••••••••••• (Key Saved)" : "Enter Gemini API Key"}
                                        value={geminiApiKey}
                                        onChange={(e) => setGeminiApiKey(e.target.value)}
                                        style={{ flex: 1 }}
                                        disabled={isReadOnly}
                                    />
                                    {!isReadOnly && <button onClick={handleSaveProviderKeys} disabled={!geminiApiKey} className="secondary">Save</button>}
                                </div>
                            </div>

                            <h3 style={{ marginTop: 0, marginBottom: '16px' }}>Saved Models</h3>

                            {!isReadOnly && (
                                <form onSubmit={handleAddModel} style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
                                    <select
                                        value={newModelProvider}
                                        onChange={(e) => {
                                            setNewModelProvider(e.target.value);
                                            setNewModelName(''); // Reset model when provider changes
                                        }}
                                        style={{ width: '150px' }}
                                    >
                                        <option value="gemini">Gemini</option>
                                    </select>

                                    {newModelProvider === 'gemini' ? (
                                        <select
                                            value={newModelName}
                                            onChange={(e) => setNewModelName(e.target.value)}
                                            style={{ flex: 1 }}
                                            required
                                        >
                                            <option value="" disabled>Select a Gemini Model...</option>
                                            <option value="gemini-3-flash">Gemini 3 Flash</option>
                                            <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                                            <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
                                            <option value="gemma-3-12b">Gemma 3 12B</option>
                                            <option value="gemini-3-pro">Gemini 3 Pro</option>
                                            <option value="gemini-3.1-pro">Gemini 3.1 Pro</option>
                                        </select>
                                    ) : (
                                        <input
                                            type="text"
                                            placeholder="Model Name (e.g., gemini-1.5-flash)"
                                            value={newModelName}
                                            onChange={(e) => setNewModelName(e.target.value)}
                                            style={{ flex: 1 }}
                                            required
                                        />
                                    )}
                                    <button type="submit">Add Model</button>
                                </form>
                            )}

                            <div style={{ background: 'var(--bg-void)', border: '1px solid var(--border-card)', borderRadius: '8px', overflow: 'hidden' }}>
                                {savedModels.length === 0 ? (
                                    <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                                        No models configured. Add one above.
                                    </div>
                                ) : (
                                    savedModels.map(model => (
                                        <div key={model.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid var(--border-card)' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                {model.is_active && <CheckCircle size={16} color="var(--neon-green)" />}
                                                <div>
                                                    <div style={{ color: model.is_active ? 'var(--neon-green)' : 'var(--text-primary)', fontWeight: model.is_active ? 600 : 500 }}>
                                                        {model.model_name}
                                                    </div>
                                                    <div style={{ color: 'var(--text-muted)', fontSize: '12px', textTransform: 'capitalize' }}>
                                                        {model.provider}
                                                    </div>
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                {!model.is_active && !isReadOnly && (
                                                    <button onClick={() => handleActivateModel(model.id)} className="secondary" style={{ padding: '4px 8px', fontSize: '12px' }}>
                                                        Set Active
                                                    </button>
                                                )}
                                                {!isReadOnly && (
                                                    <button onClick={() => handleDeleteModel(model.id)} className="icon-btn" style={{ color: 'var(--neon-red)' }}>
                                                        <Trash2 size={16} />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>

                        </div>
                    )}

                </div>

                {/* Footer */}
                <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border-card)', background: 'var(--bg-void)', display: 'flex', justifyContent: 'center' }}>
                    <button onClick={logout} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'transparent', border: '1px solid rgba(239, 68, 68, 0.5)', color: '#EF4444' }}>
                        <LogOut size={16} /> Sign Out
                    </button>
                </div>

            </div>
        </div>
    );
};

export default ProfileSettingsModal;
