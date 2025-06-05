import React from 'react';
import { useQuery } from 'react-query';
import { getSpotifyAuthUrl } from '../services/api';
import { AuthState } from '../types';
import logo from '../assets/logo.svg';

interface HeaderProps {
  authState: AuthState;
  onLogout: () => void;
  onHomeClick: () => void;
}

const Header: React.FC<HeaderProps> = ({ authState, onLogout, onHomeClick }) => {
  const { data } = useQuery('spotifyAuthUrl', getSpotifyAuthUrl, {
    enabled: !authState.isAuthenticated,
    staleTime: Infinity,
  });
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
          <>
            {data && (
              <a href={data.authUrl} className="spotify-login-button">
                Login with Spotify
              </a>
            )}            
          </>
        )}
      </div>
    </header>
  );
};

export default Header;