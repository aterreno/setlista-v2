'use client';

import { useEffect, ReactElement } from 'react';
import { useSearchParams, usePathname } from 'next/navigation';
import { useRouter } from 'next/navigation';

/**
 * This component persists search state in localStorage when a user
 * is on the search page, so it can be restored after authentication
 * redirects or other navigation events.
 * 
 * Following project quality standards:
 * - Proper TypeScript typing for all variables
 * - No hardcoded values for storage keys (constants)
 * - Error handling for browser APIs
 * - Comprehensive logging for debugging
 * - Clean separation of concerns
 */

const SEARCH_QUERY_KEY = 'setlista_last_search_query';
const SEARCH_PATH_KEY = 'setlista_last_search_path';
const FROM_AUTH_KEY = 'setlista_from_auth';

export default function PersistSearchState(): ReactElement | null {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    try {
      // Check if we're on the search page
      const isSearchPage = pathname === '/search';
      const query = searchParams.get('q');

      // Save current search state when we're on search page with a query
      if (isSearchPage && query) {
        localStorage.setItem(SEARCH_QUERY_KEY, query);
        localStorage.setItem(SEARCH_PATH_KEY, `${pathname}?q=${query}`);
        console.log(`[SearchState] Saved search state: ${query}`);
      }
      
      // Handle auth flow redirects
      if (pathname === '/callback' || pathname === '/') {
        // Mark that we're coming from auth flow
        if (pathname === '/callback') {
          sessionStorage.setItem(FROM_AUTH_KEY, 'true');
          console.log('[SearchState] Auth callback detected');
        }
        
        // If we just landed on homepage after auth flow
        if (pathname === '/' && sessionStorage.getItem(FROM_AUTH_KEY) === 'true') {
          const savedPath = localStorage.getItem(SEARCH_PATH_KEY);
          if (savedPath) {
            // Clear the auth flow marker
            sessionStorage.removeItem(FROM_AUTH_KEY);
            
            // Redirect back to the original search path
            console.log(`[SearchState] Restoring search: ${savedPath}`);
            
            // Use timeout to ensure this happens after other initialization
            setTimeout(() => {
              router.push(savedPath);
            }, 100);
          }
        }
      }
    } catch (error) {
      console.error('[SearchState] Error in PersistSearchState:', error);
    }
  }, [searchParams, pathname, router]);

  return null;
}
