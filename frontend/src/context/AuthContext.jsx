import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(localStorage.getItem('llmsec_token'));
    const [activeOrgId, setActiveOrgId] = useState(localStorage.getItem('llmsec_org_id'));
    const [userOrganizations, setUserOrganizations] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    const API_URL = import.meta.env.DEV ? 'http://localhost:8000/api/v1' : '/api/v1';

    // Configure axios defaults when token or org changes
    useEffect(() => {
        if (token) {
            axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
            localStorage.setItem('llmsec_token', token);
        } else {
            delete axios.defaults.headers.common['Authorization'];
            localStorage.removeItem('llmsec_token');
        }

        if (activeOrgId) {
            axios.defaults.headers.common['X-Organization-Id'] = activeOrgId;
            localStorage.setItem('llmsec_org_id', activeOrgId);
        } else {
            delete axios.defaults.headers.common['X-Organization-Id'];
            localStorage.removeItem('llmsec_org_id');
        }
    }, [token, activeOrgId]);

    // Load user profile on mount if token exists
    useEffect(() => {
        const fetchProfileAndOrgs = async () => {
            if (!token) {
                setIsLoading(false);
                return;
            }
            try {
                const { data: userData } = await axios.get(`${API_URL}/auth/me`);
                setUser(userData);

                // Fetch orgs to ensure activeOrgId is valid, or set default
                const { data: orgsData } = await axios.get(`${API_URL}/organizations/`);
                setUserOrganizations(orgsData);
                if (orgsData.length > 0 && (!activeOrgId || !orgsData.find(o => o.id === activeOrgId))) {
                    setActiveOrgId(orgsData[0].id);
                }
            } catch (err) {
                console.error("Auth session expired or invalid", err);
                logout();
            } finally {
                setIsLoading(false);
            }
        };

        // Set immediate defaults so requests can fire
        if (token) axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        if (activeOrgId) axios.defaults.headers.common['X-Organization-Id'] = activeOrgId;

        fetchProfileAndOrgs();
    }, [token]); // Run once on startup or when token changes

    const loginWithGoogle = async (credentialResponse) => {
        const { credential } = credentialResponse;
        try {
            const res = await axios.post(`${API_URL}/auth/google`, { token: credential });
            setToken(res.data.access_token);
            setUser(res.data.user);
            return true;
        } catch (err) {
            console.error("Google login failed", err);
            alert("Login failed: " + (err.response?.data?.detail || err.message));
            return false;
        }
    };

    const logout = () => {
        setUser(null);
        setToken(null);
        setActiveOrgId(null);
        // Hard refresh to clear any stale state
        window.location.href = '/';
    };

    return (
        <AuthContext.Provider value={{
            user,
            token,
            activeOrgId,
            setActiveOrgId,
            userOrganizations,
            loginWithGoogle,
            logout,
            isLoading,
            isAuthenticated: !!user
        }}>
            {children}
        </AuthContext.Provider>
    );
};
