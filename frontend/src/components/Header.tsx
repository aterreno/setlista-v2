import React from 'react';
import { useQuery } from 'react-query';
import { getSpotifyAuthUrl } from '../services/api.ts';
import { AuthState } from '../types/index.ts';

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
        <h1 onClick={onHomeClick} style={{ cursor: 'pointer' }}>Setlista</h1>
        <p className="tagline">Create Spotify playlists from concert setlists</p>
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