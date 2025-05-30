import React, { useState } from 'react';
import { useQuery } from 'react-query';
import { getArtistSetlists } from '../services/api.ts';
import { Artist, Setlist } from '../types/index.ts';
import { formatDate } from '../utils/formatters.ts';

interface SetlistListProps {
  artist: Artist;
  onSelectSetlist: (setlist: Setlist) => void;
}

const SetlistList: React.FC<SetlistListProps> = ({ artist, onSelectSetlist }) => {
  const [page, setPage] = useState(1);

  const { data, isLoading, error } = useQuery(
    ['setlists', artist.id, page],
    () => getArtistSetlists(artist.id, page),
    {
      enabled: !!artist?.id, // Only run query if artist.id exists
    }
  );

  const handleNextPage = () => {
    if (data && data.page < Math.ceil(data.total / data.itemsPerPage)) {
      setPage(page + 1);
    }
  };

  const handlePrevPage = () => {
    if (page > 1) {
      setPage(page - 1);
    }
  };

  return (
    <div className="setlist-list">
      <h2>{artist.name} Setlists</h2>
      
      {isLoading && <div className="loading-message">🎤 Loading setlists...</div>}
      
      {error && (
        <p className="error-message">
          Error loading setlists. Please try again.
        </p>
      )}
      
      {data && data.items.length === 0 && (
        <p>No setlists found for this artist.</p>
      )}
      
      {data && data.items.length > 0 && (
        <>
          <ul className="setlists">
            {data.items.map((setlist) => (
              <li key={setlist.id} className="setlist-item">
                <div className="setlist-info">
                  <h3>{formatDate(setlist.eventDate)}</h3>
                  <p className="venue">
                    {setlist.venue.name}, {setlist.venue.city.name},{' '}
                    {setlist.venue.city.country.name}
                  </p>
                  {setlist.tour && <p className="tour">Tour: {setlist.tour.name}</p>}
                </div>
                <button
                  onClick={() => onSelectSetlist(setlist)}
                  className="view-setlist-button"
                >
                  View Setlist
                </button>
              </li>
            ))}
          </ul>
          
          <div className="pagination">
            <button onClick={handlePrevPage} disabled={page === 1}>
              Previous
            </button>
            <span>
              Page {page} of {Math.ceil(data.total / data.itemsPerPage)}
            </span>
            <button
              onClick={handleNextPage}
              disabled={page >= Math.ceil(data.total / data.itemsPerPage)}
            >
              Next
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default SetlistList;