import React from 'react';
import { useQuery } from 'react-query';
import { searchSetlists } from '../services/api.ts';
import { Setlist } from '../types/index.ts';
import { formatDate } from '../utils/formatters.ts';

interface ArtistSearchProps {
  onSelectSetlist: (setlist: Setlist) => void;
  searchTerm: string;
  onSearchTermChange: (term: string) => void;
  page: number;
  onPageChange: (page: number) => void;
}

const ArtistSearch: React.FC<ArtistSearchProps> = ({ 
  onSelectSetlist, 
  searchTerm, 
  onSearchTermChange, 
  page, 
  onPageChange 
}) => {

  const { data, isLoading, error } = useQuery(
    ['setlist-search', searchTerm, page],
    () => searchSetlists(searchTerm, page),
    {
      enabled: searchTerm.length > 0,
    }
  );

  const handleSearchTermChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onSearchTermChange(e.target.value);
    onPageChange(1); // Reset to first page on new search
  };

  const handleNextPage = () => {
    if (data && data.page < Math.ceil(data.total / data.itemsPerPage)) {
      onPageChange(page + 1);
    }
  };

  const handlePrevPage = () => {
    if (page > 1) {
      onPageChange(page - 1);
    }
  };

  return (
    <div className="artist-search">
      <h2>Search for Concerts</h2>
      <p className="search-instructions">
        Search by artist name to find their recent concerts
      </p>
      
      <div className="search-form">
        <input
          type="text"
          value={searchTerm}
          onChange={handleSearchTermChange}
          placeholder="Enter artist name, venue, or city..."
          aria-label="Search query"
        />
      </div>

      {isLoading && (
        <div className="loading-message">
          🎵 Searching for concerts...
        </div>
      )}
      
      {error && (
        <p className="error-message">
          Error searching for concerts. Please try again.
        </p>
      )}
      
      {data && data.items.length === 0 && (
        <p>No concerts or artists found for "{searchTerm}". Try a different search term.</p>
      )}
      
      {data && data.items.length > 0 && (
        <div className="search-results">
          <h3>Recent Concerts</h3>
          <ul className="setlist-list">
            {(data.items as Setlist[]).map((setlist) => (
              <li key={setlist.id} className="setlist-item">
                <div className="setlist-info">
                  <h4>{setlist.artist.name}</h4>
                  <p className="date">{formatDate(setlist.eventDate)}</p>
                  <p className="venue">
                    {setlist.venue.name}, {setlist.venue.city.name}, {setlist.venue.city.country.name}
                  </p>
                  {setlist.tour && <p className="tour">Tour: {setlist.tour.name}</p>}
                </div>
                <button 
                  onClick={() => onSelectSetlist(setlist)}
                  className="setlist-button"
                >
                  View Setlist
                </button>
              </li>
            ))}
          </ul>
          
          {data.total > data.itemsPerPage && (
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
          )}
        </div>
      )}
    </div>
  );
};

export default ArtistSearch;