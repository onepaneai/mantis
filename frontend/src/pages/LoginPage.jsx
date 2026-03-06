import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import { Hexagon, ShieldAlert } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const LoginPage = () => {
    const { loginWithGoogle, isAuthenticated, isLoading } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        if (isAuthenticated && !isLoading) {
            navigate('/');
        }
    }, [isAuthenticated, isLoading, navigate]);

    if (isLoading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: 'var(--bg-main)' }}>
                <Hexagon className="spin-slow" size={48} color="var(--neon-mantis)" />
            </div>
        );
    }

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            height: '100vh',
            width: '100%',
            background: 'radial-gradient(circle at top, var(--bg-card) 0%, var(--bg-main) 100%)',
            color: 'var(--text-primary)'
        }}>
            <div style={{
                background: 'var(--bg-card)',
                padding: '40px',
                borderRadius: '16px',
                border: '1px solid var(--border-card)',
                boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
                textAlign: 'center',
                maxWidth: '400px',
                width: '100%'
            }}>
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
                    <div style={{ position: 'relative' }}>
                        <Hexagon size={64} color="var(--neon-mantis)" strokeWidth={1.5} />
                        <ShieldAlert size={24} color="var(--text-primary)" style={{ position: 'absolute', top: '20px', left: '20px' }} />
                    </div>
                </div>

                <h1 style={{ marginBottom: '12px', fontSize: '28px', fontWeight: '600', letterSpacing: '-0.02em' }}>
                    MantisGuard
                </h1>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '32px', lineHeight: '1.5' }}>
                    Sign in to access your AI Security Testing Workspaces and automate threat evaluations.
                </p>

                <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <GoogleLogin
                        onSuccess={async (credentialResponse) => {
                            const success = await loginWithGoogle(credentialResponse);
                            if (success) navigate('/');
                        }}
                        onError={() => {
                            console.error('Login Failed');
                            alert("Google Login Failed. Please try again.");
                        }}
                        theme="filled_black"
                        shape="pill"
                        size="large"
                    />
                </div>

                <div style={{ marginTop: '24px', fontSize: '12px', color: 'var(--text-muted)' }}>
                    By signing in, you agree to our Terms of Service & Privacy Policy.
                </div>
            </div>
        </div>
    );
};

export default LoginPage;
