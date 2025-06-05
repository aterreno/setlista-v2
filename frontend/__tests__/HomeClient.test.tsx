import { render, screen } from '@testing-library/react'
import HomeClient from '../components/HomeClient'
import React from 'react'
import { useAuth } from '../hooks/useAuth'
import '@testing-library/jest-dom'

// Mock the useAuth hook
jest.mock('../hooks/useAuth', () => ({
  useAuth: jest.fn()
}))

// Mock useRouter
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    back: jest.fn(),
    forward: jest.fn()
  })
}))

// Mock sessionStorage
Object.defineProperty(window, 'sessionStorage', {
  value: {
    getItem: jest.fn(() => null),
    setItem: jest.fn(),
    removeItem: jest.fn(),
  },
})

describe('HomeClient', () => {
  it('renders the home page correctly when not authenticated', () => {
    // Mock the useAuth hook to return not authenticated
    // The hook returns [authState, login, logout]
    (useAuth as jest.Mock).mockReturnValue([
      { accessToken: null, expiresAt: null, isAuthenticated: false },
      jest.fn(), // login function
      jest.fn()  // logout function
    ])

    render(<HomeClient />)
    
    // Check if the login button exists
    const loginButton = screen.getByRole('button', { name: /login with spotify/i })
    expect(loginButton).toBeInTheDocument()
  })

  // Add more tests here as needed
})
