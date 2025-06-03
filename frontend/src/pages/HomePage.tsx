import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from 'react-query';
import { Setlist } from '../types';
import { useAuth } from '../hooks/useAuth';
import Header from '../components/Header';
import ArtistSearch from '../components/ArtistSearch';
import SetlistDetail from '../components/SetlistDetail';
import { API_CONFIG } from '../constants';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const HomePage: React.FC = () => {
  const [authState, login, logout] = useAuth();
  const [selectedSetlist, setSelectedSetlist] = useState<Setlist | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchPage, setSearchPage] = useState(1);
  const location = useLocation();

  // Handle URL parameters, including success and error messages from callback
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const success = params.get('success');
    const error = params.get('error');
    const code = params.get('code');
    
    // Handle success message from callback
    if (success === 'logged_in') {
      console.log('Successfully authenticated with Spotify');
      // Clear the URL params but keep the user on homepage
      window.history.replaceState({}, document.title, '/');
    }
    
    // Handle error messages
    if (error) {
      console.error(`Auth error: ${error}`);
      // Could show a toast or notification here
      window.history.replaceState({}, document.title, '/');
    }
    
    // Handle direct Spotify code (this is the old flow, likely not used anymore)
    if (code && !authState.isAuthenticated) {
      // Process auth callback
      fetch(`${process.env.REACT_APP_API_URL || API_CONFIG.DEFAULT_BASE_URL}/spotify/callback?code=${code}`)
        .then((response) => {
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          return response.json();
        })
        .then((data) => {
          if (data.access_token) {
            login(data.access_token, data.expires_in);
            // Clear the URL params
            window.history.replaceState({}, document.title, '/');
          } else {
            console.error('No access token received from Spotify');
          }
        })
        .catch((error) => {
          console.error('Authentication error:', error);
          // Optionally show user-friendly error message
        });
    }
  }, [location, authState.isAuthenticated, login]);

  const handleSelectSetlist = (setlist: Setlist) => {
    setSelectedSetlist(setlist);
  };

  const handleBackToSearch = () => {
    setSelectedSetlist(null);
    // Search state is maintained in HomePage, so results will still be there
  };

  const handleHomeClick = () => {
    setSelectedSetlist(null);
    setSearchTerm(''); // Clear search to go back to initial state
    setSearchPage(1);
  };

  return (
    <QueryClientProvider client={queryClient}>
      <div className="app-container">
        <Header authState={authState} onLogout={logout} onHomeClick={handleHomeClick} />
        
        <main className="main-content">
          {selectedSetlist ? (
            <SetlistDetail
              setlistId={selectedSetlist.id}
              authState={authState}
              onBackToSetlists={handleBackToSearch}
            />
          ) : (
            <ArtistSearch 
              onSelectSetlist={handleSelectSetlist}
              searchTerm={searchTerm}
              onSearchTermChange={setSearchTerm}
              page={searchPage}
              onPageChange={setSearchPage}
            />
          )}
        </main>
        
        <footer className="app-footer">
          <p>                        
          </p>
        </footer>
      </div>
    </QueryClientProvider>
  );
};

export default HomePage;