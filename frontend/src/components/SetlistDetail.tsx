import React from 'react';
import { useMutation, useQuery } from 'react-query';
import { getSetlistById, createPlaylistFromSetlist } from '../services/api';
import { Setlist, Song, AuthState } from '../types';
import { formatDate } from '../utils/formatters';

interface SetlistDetailProps {
  setlistId: string;
  authState: AuthState;
  onBackToSetlists: () => void;
}

const SetlistDetail: React.FC<SetlistDetailProps> = ({
  setlistId,
  authState,
  onBackToSetlists,
}) => {
  const { data, isLoading, error } = useQuery(
    ['setlist', setlistId],
    () => getSetlistById(setlistId)
  );

  const createPlaylistMutation = useMutation(
    () => {
      if (!authState.accessToken) {
        throw new Error('Not authenticated with Spotify');
      }
      return createPlaylistFromSetlist(setlistId, authState.accessToken);
    }
  );

  const handleCreatePlaylist = () => {
    createPlaylistMutation.mutate();
  };

  const renderSongList = (songs: Song[], title?: string, isEncore = false) => (
    <div className={`song-section ${isEncore ? 'encore' : ''}`}>
      {title && <h4>{title}</h4>}
      <ol className="song-list">
        {songs.map((song, index) => (
          <li key={`${song.name}-${index}`} className="song-item">
            {song.name}
            {song.cover && (
              <span className="cover-info"> (Cover of {song.cover.name})</span>
            )}
            {song.info && <span className="song-info"> {song.info}</span>}
          </li>
        ))}
      </ol>
    </div>
  );

  const renderSets = (setlist: Setlist) => {
    const { sets } = setlist;
    
    if (!sets || !sets.set || sets.set.length === 0) {
      return <p>No songs were added to this setlist yet. Check back later or view on Setlist.fm for updates.</p>;
    }

    return (
      <div className="setlist-sets">
        {sets.set.map((set, index) => {
          if (!set.song || set.song.length === 0) {
            return null;
          }

          const title = set.name || (set.encore ? `Encore ${set.encore}` : index === 0 ? 'Main Set' : `Set ${index + 1}`);
          
          return (
            <div key={index}>
              {renderSongList(set.song, title, !!set.encore)}
            </div>
          );
        })}
      </div>
    );
  };

  if (isLoading) {
    return <div className="loading-message">🎶 Loading setlist details...</div>;
  }

  if (error || !data) {
    return (
      <div className="setlist-detail error">
        <p className="error-message">Error loading setlist details.</p>
        <button onClick={onBackToSetlists} className="back-button">
          Back to Results
        </button>
      </div>
    );
  }

  const { setlist, songs } = data;

  return (
    <div className="setlist-detail">
      <button onClick={onBackToSetlists} className="back-button">
        ← Back to Results
      </button>
      
      <div className="setlist-header">
        <h2>{setlist.artist.name}</h2>
        <h3>{formatDate(setlist.eventDate)}</h3>
        <p className="venue">
          {setlist.venue.name}, {setlist.venue.city.name},{' '}
          {setlist.venue.city.country.name}
        </p>
        {setlist.tour && <p className="tour">Tour: {setlist.tour.name}</p>}
      </div>
      
      <div className="spotify-action">
        {authState.isAuthenticated ? (
          <button
            onClick={handleCreatePlaylist}
            disabled={createPlaylistMutation.isLoading}
            className="create-playlist-button"
          >
            {createPlaylistMutation.isLoading
              ? 'Creating Playlist...'
              : 'Create Spotify Playlist'}
          </button>
        ) : (
          <p className="login-prompt">
            Log in with Spotify to create a playlist from this setlist
          </p>
        )}
        
        {createPlaylistMutation.isSuccess && (
          <div className="success-message">
            <p>Playlist created successfully!</p>
            <a
              href={createPlaylistMutation.data.playlist.external_urls.spotify}
              target="_blank"
              rel="noopener noreferrer"
              className="open-spotify-link"
            >
              Open in Spotify
            </a>
          </div>
        )}
        
        {createPlaylistMutation.isError && (
          <p className="error-message">
            Error creating playlist. Please try again.
          </p>
        )}
      </div>
      
      <div className="songs-container">
        <h3>Songs ({songs.length})</h3>
        {renderSets(setlist)}
      </div>
      
      <div className="source-link">
        <a
          href={setlist.url}
          target="_blank"
          rel="noopener noreferrer"
          className="setlist-source"
        >
          View on Setlist.fm
        </a>
      </div>
    </div>
  );
};

export default SetlistDetail;