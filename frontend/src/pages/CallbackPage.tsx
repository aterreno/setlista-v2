import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { API_CONFIG } from '../constants';

const CallbackPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [, login] = useAuth();

  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    const accessToken = urlParams.get('access_token');
    const expiresIn = urlParams.get('expires_in');
    const error = urlParams.get('error');

    if (error) {
      console.error('Spotify auth error:', error);
      navigate('/?error=auth_failed');
      return;
    }

    if (!accessToken || !expiresIn) {
      console.error('Missing access token or expiry');
      navigate('/?error=token_missing');
      return;
    }

    // Login with the received token
    login(accessToken, Number(expiresIn));
    // Redirect to home page with success message
    navigate('/?success=logged_in');
  }, [location.search, login, navigate]);

  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      height: '100vh',
      flexDirection: 'column' 
    }}>
      <h2>Logging you in...</h2>
      <p>Please wait while we complete your Spotify login.</p>
    </div>
  );
};

export default CallbackPage;