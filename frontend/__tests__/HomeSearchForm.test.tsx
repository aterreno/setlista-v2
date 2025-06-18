import { render, screen, fireEvent } from '@testing-library/react';
import HomeSearchForm from '../components/HomeSearchForm';
import React from 'react';
import '@testing-library/jest-dom';

// Mock useRouter
const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush
  })
}));

// Mock useToast
const mockToast = jest.fn();
jest.mock('@/components/ui/use-toast', () => ({
  useToast: () => ({
    toast: mockToast
  })
}));

// Mock console methods
const originalConsoleLog = console.log;

describe('HomeSearchForm', () => {
  beforeEach(() => {
    // Clear mocks before each test
    jest.clearAllMocks();
    mockPush.mockClear();
    mockToast.mockClear();
    
    // Mock console methods to prevent test output clutter
    console.log = jest.fn();
  });
  
  afterAll(() => {
    // Restore console methods
    console.log = originalConsoleLog;
  });

  it('renders the search form correctly', () => {
    render(<HomeSearchForm />);
    
    // Search input should be visible
    const searchInput = screen.getByPlaceholderText(/search for an artist.../i);
    expect(searchInput).toBeInTheDocument();
    
    // Search button should be visible
    const searchButton = screen.getByRole('button', { name: /search/i });
    expect(searchButton).toBeInTheDocument();
  });
  
  it('handles valid search input correctly and navigates to search page', () => {
    render(<HomeSearchForm />);
    
    // Type into search input
    const searchInput = screen.getByPlaceholderText(/search for an artist.../i);
    fireEvent.change(searchInput, { target: { value: 'Radiohead' } });
    
    // Submit the form
    const searchButton = screen.getByRole('button', { name: /search/i });
    fireEvent.click(searchButton);
    
    // Check if the router was called with the right URL
    expect(mockPush).toHaveBeenCalledWith('/search?q=Radiohead');
    
    // Check that the search was logged
    expect(console.log).toHaveBeenCalled();
  });
  
  it('handles too short (1 character) search input correctly', () => {
    render(<HomeSearchForm />);
    
    // Type a single character into search input
    const searchInput = screen.getByPlaceholderText(/search for an artist.../i);
    fireEvent.change(searchInput, { target: { value: 'a' } });
    
    // Submit the form
    const searchButton = screen.getByRole('button', { name: /search/i });
    fireEvent.click(searchButton);
    
    // Check that router push was not called
    expect(mockPush).not.toHaveBeenCalled();
    
    // Check that the toast was shown with the appropriate message
    expect(mockToast).toHaveBeenCalledWith({
      title: "Search term too short",
      description: "Please enter at least 2 characters to search.",
      variant: "destructive"
    });
    
    // Check that the warning was logged
    expect(console.log).toHaveBeenCalledWith('Search rejected: single character query');
  });
  
  it('handles empty search input correctly', () => {
    render(<HomeSearchForm />);
    
    // Submit the form with empty input
    const searchButton = screen.getByRole('button', { name: /search/i });
    fireEvent.click(searchButton);
    
    // Check that router push was not called
    expect(mockPush).not.toHaveBeenCalled();
    
    // Check that the toast was not called
    expect(mockToast).not.toHaveBeenCalled();
    
    // Check that the warning was logged
    expect(console.log).toHaveBeenCalledWith('Search rejected: empty query');
  });
  
  it('handles leading and trailing whitespace in search queries', () => {
    render(<HomeSearchForm />);
    
    // Type search with whitespace
    const searchInput = screen.getByPlaceholderText(/search for an artist.../i);
    fireEvent.change(searchInput, { target: { value: '  Pink Floyd  ' } });
    
    // Submit the form
    const searchButton = screen.getByRole('button', { name: /search/i });
    fireEvent.click(searchButton);
    
    // Check that router push was called with trimmed query
    expect(mockPush).toHaveBeenCalledWith('/search?q=Pink%20Floyd');
  });
  
  it('updates query state when input changes', () => {
    render(<HomeSearchForm />);
    
    // Type into search input
    const searchInput = screen.getByPlaceholderText(/search for an artist.../i);
    
    // Check initial empty state
    expect(searchInput).toHaveValue('');
    
    // Type something
    fireEvent.change(searchInput, { target: { value: 'Queen' } });
    
    // Check that the input value was updated
    expect(searchInput).toHaveValue('Queen');
  });
  
  it('submits form when pressing Enter key', () => {
    render(<HomeSearchForm />);
    
    // Type into search input
    const searchInput = screen.getByPlaceholderText(/search for an artist.../i);
    fireEvent.change(searchInput, { target: { value: 'Muse' } });
    
    // Get the form element directly
    const form = searchInput.closest('form');
    
    // Submit the form directly (with null check for TypeScript)
    if (form) {
      fireEvent.submit(form);
    } else {
      throw new Error('Form element not found');
    }
    
    // Check that router push was called
    expect(mockPush).toHaveBeenCalledWith('/search?q=Muse');
  });
});
