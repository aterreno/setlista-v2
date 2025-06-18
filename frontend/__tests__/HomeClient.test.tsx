import { render, screen } from '@testing-library/react'
import React from 'react'
import '@testing-library/jest-dom'
import HomeClient from '../components/HomeClient'

// Define types for our mocks and test data
interface AuthState {
  accessToken: string | null;
  expiresAt: number | null;
  isAuthenticated: boolean;
}

// Mock the useAuth hook
const mockLogin = jest.fn();
const mockLogout = jest.fn();
const mockUseAuth = jest.fn();

// Important: Define mock module before importing the module that uses it
jest.mock('../hooks/useAuth', () => ({
  useAuth: () => mockUseAuth()
}))

// Mock useRouter with a mockPush function that we can spy on
const mockPush = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    back: jest.fn(),
    forward: jest.fn()
  })
}))

// Mock sessionStorage
const sessionStorageMock: Record<string, string> = {}
Object.defineProperty(window, 'sessionStorage', {
  value: {
    getItem: jest.fn((key: string) => sessionStorageMock[key] || null),
    setItem: jest.fn((key: string, value: string) => { sessionStorageMock[key] = value }),
    removeItem: jest.fn((key: string) => { delete sessionStorageMock[key] }),
    clear: jest.fn(() => { Object.keys(sessionStorageMock).forEach(key => { delete sessionStorageMock[key] }) })
  },
  writable: true
})

// Mock localStorage
const localStorageMock: Record<string, string> = {}
Object.defineProperty(window, 'localStorage', {
  value: {
    getItem: jest.fn((key: string) => localStorageMock[key] || null),
    setItem: jest.fn((key: string, value: string) => { localStorageMock[key] = value }),
    removeItem: jest.fn((key: string) => { delete localStorageMock[key] }),
    clear: jest.fn(() => { Object.keys(localStorageMock).forEach(key => { delete localStorageMock[key] }) })
  },
  writable: true
})

// Mock console methods
const originalConsoleLog = console.log
const originalConsoleError = console.error
jest.spyOn(console, 'log').mockImplementation(() => {})
jest.spyOn(console, 'error').mockImplementation(() => {})

describe('HomeClient', () => {
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks()
    mockPush.mockClear()
    mockLogin.mockClear()
    mockLogout.mockClear()
    
    // Default auth state
    mockUseAuth.mockReturnValue([{ isAuthenticated: false }, mockLogin, mockLogout])
    
    // Reset storage mocks
    Object.keys(sessionStorageMock).forEach(key => delete sessionStorageMock[key])
    Object.keys(localStorageMock).forEach(key => delete localStorageMock[key])
  })
  afterAll(() => {
    // Restore console methods
    console.log = originalConsoleLog
    console.error = originalConsoleError
  })

  it('renders the home page correctly when not authenticated', () => {
    // Set up mock for non-authenticated state
    const authState: AuthState = {
      accessToken: null,
      expiresAt: null,
      isAuthenticated: false
    };
    mockUseAuth.mockReturnValue([authState, mockLogin, mockLogout]);
    
    render(<HomeClient />)
    
    // Verify the login button is displayed
    expect(screen.getByText(/Login with Spotify/i)).toBeInTheDocument()
    
    // Check that main content elements are rendered
    expect(screen.getByText(/Find setlists for your/i)).toBeInTheDocument()
    expect(screen.getByText(/favorite artists/i, { selector: 'span' })).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/Search for an artist/i)).toBeInTheDocument()
  })
  
  it('renders the home page correctly when authenticated', () => {
    // Set up mock for authenticated state
    const authState: AuthState = {
      accessToken: 'fake-token',
      expiresAt: Date.now() + 3600000,
      isAuthenticated: true
    };
    mockUseAuth.mockReturnValue([authState, mockLogin, mockLogout]);
    
    render(<HomeClient />)
    
    // Check if the logout button exists
    expect(screen.getByText('Logout')).toBeInTheDocument()
  })
  
  it('redirects to setlist page when pendingSetlistId exists in session storage', () => {
    // Set up auth state
    mockUseAuth.mockReturnValue([
      { accessToken: null, expiresAt: null, isAuthenticated: false },
      jest.fn(),
      jest.fn()
    ])
    
    // Mock session storage with a pending setlist ID
    sessionStorageMock['pendingSetlistId'] = '12345'
    
    render(<HomeClient />)
    
    // Verify the router was called to redirect to the setlist page
    expect(mockPush).toHaveBeenCalledWith('/setlist/?id=12345')
    
    // Verify the session storage item was removed
    expect(window.sessionStorage.removeItem).toHaveBeenCalledWith('pendingSetlistId')
  })
  
  it('redirects to search page when authenticated and saved search exists', () => {
    // Set up authenticated state
    mockUseAuth.mockReturnValue([
      { accessToken: 'fake-token', expiresAt: Date.now() + 3600000, isAuthenticated: true },
      jest.fn(),
      jest.fn()
    ])
    
    // Mock localStorage with a saved search
    localStorageMock['setlista_search'] = 'radiohead'
    
    render(<HomeClient />)
    
    // Verify the router was called to redirect to the search page
    expect(mockPush).toHaveBeenCalledWith('/search?q=radiohead')
    
    // Verify the local storage item was removed
    expect(window.localStorage.removeItem).toHaveBeenCalledWith('setlista_search')
  })
  
  it('handles errors during storage access properly', () => {
    // Set up auth state
    mockUseAuth.mockReturnValue([
      { accessToken: null, expiresAt: null, isAuthenticated: false },
      jest.fn(),
      jest.fn()
    ])
    
    // Force an error when accessing storage
    jest.spyOn(window.sessionStorage, 'getItem').mockImplementation(() => {
      throw new Error('Storage access error')
    })
    
    render(<HomeClient />)
    
    // Verify the error was logged
    expect(console.error).toHaveBeenCalled()
  })
})
