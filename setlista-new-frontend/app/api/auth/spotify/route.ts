import { NextResponse } from 'next/server';
import axios from 'axios';

// Use direct axios call to avoid double prefixing with '/api'
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export async function GET() {
  try {
    // Make direct call to backend API to avoid double '/api' prefix
    const response = await axios.get(`${API_BASE_URL}/api/spotify/auth`);
    
    if (response.data && response.data.authUrl) {
      return NextResponse.redirect(response.data.authUrl);
    } else {
      return NextResponse.json(
        { error: 'Failed to get Spotify authentication URL' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error getting Spotify auth URL:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
