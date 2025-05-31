import React from 'react';
import { useQuery } from 'react-query';
import { getSpotifyAuthUrl } from '../services/api.ts';
import { AuthState } from '../types/index.ts';
import logo from '../assets/logo.svg';

interface HeaderProps {
  authState: AuthState;
  onLogout: () => void;
  onHomeClick: () => void;
}

const Header: React.FC<HeaderProps> = ({ authState, onLogout, onHomeClick }) => {
  const { data, isLoading, error } = useQuery('spotifyAuthUrl', getSpotifyAuthUrl, {
    enabled: !authState.isAuthenticated,
    staleTime: Infinity,
  });

  // Debug logging
  console.log('Header render - authState:', authState);
  console.log('Header render - useQuery data:', data);
  console.log('Header render - useQuery isLoading:', isLoading);
  console.log('Header render - useQuery error:', error);

  return (
    <header className="app-header">
      <div className="app-title">
        <img 
          src={logo} 
          alt="Setlista - Concert setlists to Spotify playlists" 
          onClick={onHomeClick} 
          style={{ cursor: 'pointer', height: '50px', width: 'auto' }}
          className="app-logo"
        />
      </div>
      
      <div className="auth-section">
        {authState.isAuthenticated ? (
          <button onClick={onLogout} className="logout-button">
            Logout from Spotify
          </button>
        ) : (
          data && (
            <a href={data.authUrl} className="spotify-login-button">
              Login with Spotify
            </a>
          )
        )}
      </div>
    </header>
  );
};

export default Header;