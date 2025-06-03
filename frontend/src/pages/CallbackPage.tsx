import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { API_CONFIG } from '../constants';

const CallbackPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [, login] = useAuth();

  useEffect(() => {
    const handleCallback = async () => {
      const urlParams = new URLSearchParams(location.search);
      const code = urlParams.get('code');
      const error = urlParams.get('error');

      if (error) {
        console.error('Spotify auth error:', error);
        navigate('/?error=auth_failed');
        return;
      }

      if (!code) {
        console.error('No authorization code received');
        navigate('/?error=no_code');
        return;
      }

      try {
        // Call the backend callback endpoint
        const response = await fetch(`${process.env.REACT_APP_API_URL || API_CONFIG.DEFAULT_BASE_URL}/spotify/callback?code=${code}`);
        
        if (!response.ok) {
          throw new Error('Failed to exchange code for token');
        }

        const data = await response.json();
        
        if (data.access_token && data.expires_in) {
          // Login with the received token
          login(data.access_token, data.expires_in);
          
          // Redirect to home page with success message
          navigate('/?success=logged_in');
        } else {
          throw new Error('Invalid token response');
        }
      } catch (error) {
        console.error('Error handling Spotify callback:', error);
        // Only navigate to error URL if we haven't already logged in
        if (!localStorage.getItem('spotify_auth')) {
          navigate('/?error=token_exchange_failed');
        } else {
          // If we have a token, just redirect to home
          navigate('/');
        }
      }
    };

    handleCallback();
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