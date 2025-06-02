import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from 'react-query';
import * as api from '../../services/api';
import ArtistSearch from '../../components/ArtistSearch';

// Mock the entire services/api module
jest.mock('../../services/api', () => ({
  searchSetlists: jest.fn(),
  searchArtists: jest.fn(),
  getArtistSetlists: jest.fn(),
  getSetlistById: jest.fn(),
  getSpotifyAuthUrl: jest.fn(),
  createPlaylist: jest.fn(),
}));

const mockedApi = api as jest.Mocked<typeof api>;

// Mock the formatDate utility
jest.mock('../../utils/formatters', () => ({
  formatDate: (dateString: string) => {
    if (dateString === '31-12-2023') return 'December 31, 2023';
    if (dateString === '15-06-2023') return 'June 15, 2023';
    return dateString;
  }
}));

describe('ArtistSearch', () => {
  let queryClient: QueryClient;
  const mockProps = {
    onSelectSetlist: jest.fn(),
    searchTerm: '',
    onSearchTermChange: jest.fn(),
    page: 1,
    onPageChange: jest.fn()
  };

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false }
      }
    });
    jest.clearAllMocks();
  });

  const renderArtistSearch = (props = {}) => {
    const finalProps = { ...mockProps, ...props };
    return render(
      <QueryClientProvider client={queryClient}>
        <ArtistSearch {...finalProps} />
      </QueryClientProvider>
    );
  };

  it('renders search form correctly', () => {
    renderArtistSearch();
    
    expect(screen.getByText('Search for Concerts')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Enter artist name or artist + city')).toBeInTheDocument();
    expect(screen.getByText('Create a playlist on spotify by searching for your favorite artists and their recent concerts.')).toBeInTheDocument();
  });

  it('displays search term from props', () => {
    renderArtistSearch({ searchTerm: 'radiohead' });
    
    const input = screen.getByPlaceholderText('Enter artist name or artist + city');
    expect(input).toHaveValue('radiohead');
  });

  it('calls onSearchTermChange when input changes', () => {
    const onSearchTermChange = jest.fn();
    renderArtistSearch({ onSearchTermChange });
    
    const input = screen.getByPlaceholderText('Enter artist name or artist + city');
    fireEvent.change(input, { target: { value: 'new search' } });
    
    expect(onSearchTermChange).toHaveBeenCalledWith('new search');
  });

  it('resets page to 1 when search term changes', () => {
    const onPageChange = jest.fn();
    renderArtistSearch({ onPageChange, page: 3 });
    
    const input = screen.getByPlaceholderText('Enter artist name or artist + city');
    fireEvent.change(input, { target: { value: 'new search' } });
    
    expect(onPageChange).toHaveBeenCalledWith(1);
  });

  it('does not trigger search when searchTerm is too short', () => {
    renderArtistSearch({ searchTerm: 'ab' });
    
    expect(mockedApi.searchSetlists).not.toHaveBeenCalled();
  });

  it('triggers search when searchTerm is provided', async () => {
    const mockData = {
      type: 'setlists',
      itemsPerPage: 20,
      page: 1,
      total: 2,
      items: [
        {
          id: 'setlist1',
          eventDate: '31-12-2023',
          artist: { id: 'artist1', name: 'Radiohead', sortName: 'Radiohead' },
          venue: {
            id: 'venue1',
            name: 'Madison Square Garden',
            city: { id: 'city1', name: 'New York', country: { code: 'US', name: 'USA' } }
          },
          tour: { name: 'World Tour 2023' },
          sets: { set: [] },
          url: 'https://www.setlist.fm/setlist/radiohead/2023/madison-square-garden-new-york-usa-1.html'
        },
        {
          id: 'setlist2',
          eventDate: '15-06-2023',
          artist: { id: 'artist1', name: 'Radiohead', sortName: 'Radiohead' },
          venue: {
            id: 'venue2',
            name: 'Royal Albert Hall',
            city: { id: 'city2', name: 'London', country: { code: 'GB', name: 'UK' } }
          },
          sets: { set: [] },
          url: 'https://www.setlist.fm/setlist/radiohead/2023/royal-albert-hall-london-uk-2.html'
        }
      ]
    };

    mockedApi.searchSetlists.mockResolvedValue(mockData);
    
    renderArtistSearch({ searchTerm: 'radiohead' });
    
    await waitFor(() => {
      expect(mockedApi.searchSetlists).toHaveBeenCalledWith('radiohead', 1);
    });
  });

  it('displays loading message during search', () => {
    mockedApi.searchSetlists.mockImplementation(() => new Promise(() => {})); // Never resolves
    
    renderArtistSearch({ searchTerm: 'radiohead' });
    
    expect(screen.getByText('🎵 Searching for concerts...')).toBeInTheDocument();
  });

  it('displays error message on search failure', async () => {
    mockedApi.searchSetlists.mockRejectedValue(new Error('API Error'));
    
    renderArtistSearch({ searchTerm: 'radiohead' });
    
    await waitFor(() => {
      expect(screen.getByText('Error searching for concerts. Please try again.')).toBeInTheDocument();
    });
  });

  it('displays no results message when no setlists found', async () => {
    const mockData = {
      type: 'setlists',
      itemsPerPage: 20,
      page: 1,
      total: 0,
      items: []
    };

    mockedApi.searchSetlists.mockResolvedValue(mockData);
    
    renderArtistSearch({ searchTerm: 'unknownartist' });
    
    await waitFor(() => {
      expect(screen.getByText(/No concerts or artists found for.*Try a different search term/)).toBeInTheDocument();
    });
  });

  it('displays search results correctly', async () => {
    const mockData = {
      type: 'setlists',
      itemsPerPage: 20,
      page: 1,
      total: 2,
      items: [
        {
          id: 'setlist1',
          eventDate: '31-12-2023',
          artist: { id: 'artist1', name: 'Radiohead', sortName: 'Radiohead' },
          venue: {
            id: 'venue1',
            name: 'Madison Square Garden',
            city: { id: 'city1', name: 'New York', country: { code: 'US', name: 'USA' } }
          },
          tour: { name: 'World Tour 2023' },
          sets: { set: [] },
          url: 'https://www.setlist.fm/setlist/radiohead/2023/madison-square-garden-new-york-usa-1.html'
        },
        {
          id: 'setlist2',
          eventDate: '15-06-2023',
          artist: { id: 'artist1', name: 'Radiohead', sortName: 'Radiohead' },
          venue: {
            id: 'venue2',
            name: 'Royal Albert Hall',
            city: { id: 'city2', name: 'London', country: { code: 'GB', name: 'UK' } }
          },
          sets: { set: [] },
          url: 'https://www.setlist.fm/setlist/radiohead/2023/royal-albert-hall-london-uk-2.html'
        }
      ]
    };

    mockedApi.searchSetlists.mockResolvedValue(mockData);
    
    renderArtistSearch({ searchTerm: 'radiohead' });
    
    await waitFor(() => {
      expect(screen.getByText('Recent Concerts')).toBeInTheDocument();
    });
    
    expect(screen.getAllByText('Radiohead')).toHaveLength(2); // Should have 2 setlists for Radiohead
    expect(screen.getByText('December 31, 2023')).toBeInTheDocument();
    expect(screen.getByText('Madison Square Garden, New York, USA')).toBeInTheDocument();
    expect(screen.getByText('Tour: World Tour 2023')).toBeInTheDocument();
    expect(screen.getByText('Royal Albert Hall, London, UK')).toBeInTheDocument();
  });

  it('calls onSelectSetlist when View Setlist button is clicked', async () => {
    const mockData = {
      type: 'setlists',
      itemsPerPage: 20,
      page: 1,
      total: 1,
      items: [
        {
          id: 'setlist1',
          eventDate: '31-12-2023',
          artist: { id: 'artist1', name: 'Radiohead', sortName: 'Radiohead' },
          venue: {
            id: 'venue1',
            name: 'Madison Square Garden',
            city: { id: 'city1', name: 'New York', country: { code: 'US', name: 'USA' } }
          },
          sets: { set: [] },
          url: 'https://www.setlist.fm/setlist/radiohead/2023/madison-square-garden-new-york-usa-1.html'
        }
      ]
    };

    mockedApi.searchSetlists.mockResolvedValue(mockData);
    const onSelectSetlist = jest.fn();
    
    renderArtistSearch({ searchTerm: 'radiohead', onSelectSetlist });
    
    await waitFor(() => {
      expect(screen.getByRole('button')).toBeInTheDocument();
    });
    
    const clickableItem = screen.getByRole('button');
    fireEvent.click(clickableItem);
    
    expect(onSelectSetlist).toHaveBeenCalledWith(mockData.items[0]);
  });

  it('displays pagination when total exceeds itemsPerPage', async () => {
    const mockData = {
      type: 'setlists',
      itemsPerPage: 20,
      page: 1,
      total: 45, // More than one page
      items: [
        {
          id: 'setlist1',
          eventDate: '31-12-2023',
          artist: { id: 'artist1', name: 'Radiohead', sortName: 'Radiohead' },
          venue: {
            id: 'venue1',
            name: 'Madison Square Garden',
            city: { id: 'city1', name: 'New York', country: { code: 'US', name: 'USA' } }
          },
          sets: { set: [] },
          url: 'https://www.setlist.fm/setlist/radiohead/2023/madison-square-garden-new-york-usa-1.html'
        }
      ]
    };

    mockedApi.searchSetlists.mockResolvedValue(mockData);
    
    renderArtistSearch({ searchTerm: 'radiohead' });
    
    await waitFor(() => {
      expect(screen.getByText('Page 1 of 3')).toBeInTheDocument();
    });
    
    expect(screen.getByText('Previous')).toBeInTheDocument();
    expect(screen.getByText('Next')).toBeInTheDocument();
  });

  it('does not display pagination when total is less than or equal to itemsPerPage', async () => {
    const mockData = {
      type: 'setlists',
      itemsPerPage: 20,
      page: 1,
      total: 15, // Less than one page
      items: [
        {
          id: 'setlist1',
          eventDate: '31-12-2023',
          artist: { id: 'artist1', name: 'Radiohead', sortName: 'Radiohead' },
          venue: {
            id: 'venue1',
            name: 'Madison Square Garden',
            city: { id: 'city1', name: 'New York', country: { code: 'US', name: 'USA' } }
          },
          sets: { set: [] },
          url: 'https://www.setlist.fm/setlist/radiohead/2023/madison-square-garden-new-york-usa-1.html'
        }
      ]
    };

    mockedApi.searchSetlists.mockResolvedValue(mockData);
    
    renderArtistSearch({ searchTerm: 'radiohead' });
    
    await waitFor(() => {
      expect(screen.getByText('Radiohead')).toBeInTheDocument();
    });
    
    expect(screen.queryByText('Previous')).not.toBeInTheDocument();
    expect(screen.queryByText('Next')).not.toBeInTheDocument();
  });

  it('handles pagination navigation correctly', async () => {
    const mockData = {
      type: 'setlists',
      itemsPerPage: 20,
      page: 2,
      total: 60,
      items: [{
        id: 'setlist1',
        eventDate: '31-12-2023',
        artist: { id: 'artist2', name: 'Test Artist', sortName: 'Test Artist' },
        venue: {
          id: 'venue3',
          name: 'Test Venue',
          city: { id: 'city3', name: 'Test City', country: { code: 'TC', name: 'Test Country' } }
        },
        sets: { set: [] },
        url: 'https://www.setlist.fm/setlist/test-artist/2023/test-venue-test-city-test-country-1.html'
      }]
    };

    mockedApi.searchSetlists.mockResolvedValue(mockData);
    const onPageChange = jest.fn();
    
    renderArtistSearch({ searchTerm: 'radiohead', page: 2, onPageChange });
    
    await waitFor(() => {
      expect(screen.getByText('Next')).toBeInTheDocument();
    });
    
    const nextButton = screen.getByText('Next');
    const prevButton = screen.getByText('Previous');
    
    fireEvent.click(nextButton);
    expect(onPageChange).toHaveBeenCalledWith(3);
    
    fireEvent.click(prevButton);
    expect(onPageChange).toHaveBeenCalledWith(1);
  });

  it('disables Previous button on first page', async () => {
    const mockData = {
      type: 'setlists',
      itemsPerPage: 20,
      page: 1,
      total: 40,
      items: [{
        id: 'setlist1',
        eventDate: '31-12-2023',
        artist: { id: 'artist2', name: 'Test Artist', sortName: 'Test Artist' },
        venue: {
          id: 'venue3',
          name: 'Test Venue',
          city: { id: 'city3', name: 'Test City', country: { code: 'TC', name: 'Test Country' } }
        },
        sets: { set: [] },
        url: 'https://www.setlist.fm/setlist/test-artist/2023/test-venue-test-city-test-country-1.html'
      }]
    };

    mockedApi.searchSetlists.mockResolvedValue(mockData);
    
    renderArtistSearch({ searchTerm: 'radiohead', page: 1 });
    
    await waitFor(() => {
      expect(screen.getByText('Test Artist')).toBeInTheDocument();
    });
    
    const prevButton = screen.getByText('Previous');
    expect(prevButton).toBeDisabled();
  });

  it('disables Next button on last page', async () => {
    const mockData = {
      type: 'setlists',
      itemsPerPage: 20,
      page: 3,
      total: 60,
      items: [{
        id: 'setlist1',
        eventDate: '31-12-2023',
        artist: { id: 'artist2', name: 'Test Artist', sortName: 'Test Artist' },
        venue: {
          id: 'venue3',
          name: 'Test Venue',
          city: { id: 'city3', name: 'Test City', country: { code: 'TC', name: 'Test Country' } }
        },
        sets: { set: [] },
        url: 'https://www.setlist.fm/setlist/test-artist/2023/test-venue-test-city-test-country-1.html'
      }]
    };

    mockedApi.searchSetlists.mockResolvedValue(mockData);
    
    renderArtistSearch({ searchTerm: 'radiohead', page: 3 });
    
    await waitFor(() => {
      expect(screen.getByText('Test Artist')).toBeInTheDocument();
    });
    
    const nextButton = screen.getByText('Next');
    expect(nextButton).toBeDisabled();
  });

  it('handles setlists without tour information', async () => {
    const mockData = {
      type: 'setlists',
      itemsPerPage: 20,
      page: 1,
      total: 1,
      items: [
        {
          id: 'setlist1',
          eventDate: '31-12-2023',
          artist: { id: 'artist1', name: 'Radiohead', sortName: 'Radiohead' },
          venue: {
            id: 'venue1',
            name: 'Madison Square Garden',
            city: { id: 'city1', name: 'New York', country: { code: 'US', name: 'USA' } }
          },
          sets: { set: [] },
          url: 'https://www.setlist.fm/setlist/radiohead/2023/madison-square-garden-new-york-usa-1.html'
          // No tour field
        }
      ]
    };

    mockedApi.searchSetlists.mockResolvedValue(mockData);
    
    renderArtistSearch({ searchTerm: 'radiohead' });
    
    await waitFor(() => {
      expect(screen.getByText('Radiohead')).toBeInTheDocument();
    });
    
    expect(screen.queryByText(/Tour:/)).not.toBeInTheDocument();
  });
});