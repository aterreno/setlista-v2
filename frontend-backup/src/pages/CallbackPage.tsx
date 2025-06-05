import React, { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const CallbackPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [, login] = useAuth();
  
  useEffect(() => {
    // Process URL parameters from either query string or hash fragment
    const urlParams = new URLSearchParams(location.search || location.hash.split('?')[1] || '');
    console.log('CallbackPage: useEffect triggered. Location:', location.search, location.hash);
    const accessToken = urlParams.get('access_token');
    const expiresIn = urlParams.get('expires_in');
    const error = urlParams.get('error');

    if (error) {
      console.error('CallbackPage: Spotify auth error:', error);
      navigate('/?error=auth_failed');
      return;
    }

    if (!accessToken || !expiresIn) {
      console.error('CallbackPage: Missing access token or expiry.');
      navigate('/?error=token_missing');
      return;
    }

    console.log('CallbackPage: Tokens found - AccessToken:', accessToken, 'ExpiresIn:', expiresIn);
    try {
      login(accessToken, Number(expiresIn));
      console.log('CallbackPage: login function called successfully.');
    } catch (e) {
      console.error('CallbackPage: Error calling login function:', e);
    }
    navigate('/?success=logged_in');
  }, [location.search, location.hash, login, navigate]);

  // Simplified return for testing
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