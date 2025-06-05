import React from 'react';
import { useQuery } from 'react-query';
import { searchSetlists } from '../services/api';
import { Setlist } from '../types';
import { formatDate } from '../utils/formatters';
import { useDebounce } from '../hooks/useDebounce';
import { SEARCH_CONFIG } from '../constants';

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
  // Debounce search term to avoid excessive API calls
  const debouncedSearchTerm = useDebounce(searchTerm, SEARCH_CONFIG.DEBOUNCE_DELAY);

  const { data, isLoading, error } = useQuery(
    ['setlist-search', debouncedSearchTerm, page],
    () => searchSetlists(debouncedSearchTerm, page),
    {
      enabled: debouncedSearchTerm.length >= SEARCH_CONFIG.MIN_LENGTH, // Only search when at least minimum characters
    }
  );

  const handleSearchTermChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onSearchTermChange(e.target.value);
    onPageChange(1); // Reset to first page on new search
  };

  const handleNextPage = () => {
    if (data && data.page < Math.ceil((data?.total ?? 0) / (data?.itemsPerPage ?? 1))) {
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
        Create a playlist on spotify by searching for your favorite artists.
      </p>
      
      <div className="search-form">
        <input
          type="text"
          value={searchTerm}
          onChange={handleSearchTermChange}
          placeholder="Artist name..."
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
      
      {searchTerm.length > 0 && searchTerm.length <= 2 && (
        <p className="search-hint">
          Type at least 3 characters to search...
        </p>
      )}
      
      {debouncedSearchTerm.length > 2 && data?.items?.length === 0 && (
        <p>No concerts or artists found for &quot;{debouncedSearchTerm}&quot;. Try a different search term.</p>
      )}
      
      {data?.items && data.items.length > 0 && (
        <div className="search-results">
          <h3>Recent Concerts</h3>
          <ul className="setlist-list">
            {(data.items as Setlist[]).map((setlist) => (
              <li 
                key={setlist.id} 
                className="setlist-item clickable"
                onClick={() => onSelectSetlist(setlist)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && onSelectSetlist(setlist)}
              >
                <div className="setlist-info">
                  <h4>{setlist.artist.name}</h4>
                  <p className="date">{formatDate(setlist.eventDate)}</p>
                  <p className="venue">
                    {setlist.venue.name}, {setlist.venue.city.name}, {setlist.venue.city.country.name}
                  </p>
                  {setlist.tour && <p className="tour">Tour: {setlist.tour.name}</p>}
                </div>
              </li>
            ))}
          </ul>
          
          {(data?.total ?? 0) > (data?.itemsPerPage ?? 0) && (
            <div className="pagination">
              <button onClick={handlePrevPage} disabled={page === 1}>
                Previous
              </button>
              <span>
                Page {page} of {Math.ceil((data?.total ?? 0) / (data?.itemsPerPage ?? 1))}
              </span>
              <button
                onClick={handleNextPage}
                disabled={page >= Math.ceil((data?.total ?? 0) / (data?.itemsPerPage ?? 1))}
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