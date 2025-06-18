import { renderHook, act } from '@testing-library/react';
import { useToast, toast } from '@/components/ui/use-toast';
import '@testing-library/jest-dom';

// Mock timer for testing toast timeouts
jest.useFakeTimers();

describe('useToast', () => {
  it('should initialize with empty toasts array', () => {
    const { result } = renderHook(() => useToast());
    
    expect(result.current.toasts).toEqual([]);
  });
  
  it('should add a toast when calling toast function', () => {
    const { result } = renderHook(() => useToast());
    
    act(() => {
      result.current.toast({
        title: 'Test Toast',
        description: 'This is a test toast',
        variant: 'default',
      });
    });
    
    expect(result.current.toasts.length).toBe(1);
    expect(result.current.toasts[0].title).toBe('Test Toast');
    expect(result.current.toasts[0].description).toBe('This is a test toast');
    expect(result.current.toasts[0].variant).toBe('default');
    expect(result.current.toasts[0].open).toBe(true);
  });
  
  it('should update a toast when calling update function', () => {
    const { result } = renderHook(() => useToast());
    let toastId: string;
    
    act(() => {
      const response = result.current.toast({
        title: 'Initial Toast',
        description: 'Initial description',
      });
      toastId = response.id;
      
      // Update the toast
      response.update({
        id: toastId,
        title: 'Updated Toast',
        description: 'Updated description',
      });
    });
    
    const updatedToast = result.current.toasts.find(t => t.id === toastId);
    expect(updatedToast).toBeDefined();
    expect(updatedToast?.title).toBe('Updated Toast');
    expect(updatedToast?.description).toBe('Updated description');
  });
  
  it('should dismiss a specific toast when calling dismiss with ID', () => {
    const { result } = renderHook(() => useToast());
    let toastId: string;
    
    act(() => {
      const response = result.current.toast({
        title: 'Toast to dismiss',
      });
      toastId = response.id;
    });
    
    expect(result.current.toasts[0].open).toBe(true);
    
    act(() => {
      result.current.dismiss(toastId);
    });
    
    // Toast should still be in the array but marked as closed
    expect(result.current.toasts[0].open).toBe(false);
  });
  
  it('should dismiss all toasts when calling dismiss without ID', () => {
    const { result } = renderHook(() => useToast());
    
    act(() => {
      // Add multiple toasts
      result.current.toast({ title: 'Toast 1' });
      result.current.toast({ title: 'Toast 2' });
      result.current.toast({ title: 'Toast 3' });
    });
    
    // Only the most recent toast should be visible due to TOAST_LIMIT = 1
    expect(result.current.toasts.length).toBe(1);
    expect(result.current.toasts[0].title).toBe('Toast 3');
    expect(result.current.toasts[0].open).toBe(true);
    
    act(() => {
      result.current.dismiss(); // Dismiss all
    });
    
    // Toast should still exist but be marked as closed
    expect(result.current.toasts[0].open).toBe(false);
  });
  
  it('should remove toast after dismissal and timeout', () => {
    const { result } = renderHook(() => useToast());
    let toastId: string;
    
    act(() => {
      const response = result.current.toast({
        title: 'Toast to remove',
      });
      toastId = response.id;
    });
    
    act(() => {
      result.current.dismiss(toastId);
    });
    
    // Toast should be marked as closed but still present
    expect(result.current.toasts.length).toBe(1);
    expect(result.current.toasts[0].open).toBe(false);
    
    // Fast-forward time to trigger the removal timeout
    act(() => {
      jest.runAllTimers();
    });
    
    // Toast should be removed from the array
    expect(result.current.toasts.length).toBe(0);
  });
  
  it('should dismiss toast when onOpenChange is called with false', () => {
    const { result } = renderHook(() => useToast());
    
    act(() => {
      result.current.toast({
        title: 'Toast with onOpenChange',
      });
    });
    
    expect(result.current.toasts[0].open).toBe(true);
    
    // Simulate calling onOpenChange from a Toast component
    act(() => {
      const onOpenChange = result.current.toasts[0].onOpenChange;
      if (onOpenChange) {
        onOpenChange(false);
      }
    });
    
    // Toast should be marked as closed
    expect(result.current.toasts[0].open).toBe(false);
  });
  
  it('should export stand-alone toast function', () => {
    const { result } = renderHook(() => useToast());
    
    // Use the standalone toast function
    act(() => {
      toast({
        title: 'Stand-alone toast',
        description: 'Created with the exported toast function',
      });
    });
    
    // Toast should be added to the state
    expect(result.current.toasts.length).toBe(1);
    expect(result.current.toasts[0].title).toBe('Stand-alone toast');
  });
  
  it('should clean up listener when component unmounts', () => {
    const { result, unmount } = renderHook(() => useToast());
    
    // Add a toast to ensure the component subscribes to state updates
    act(() => {
      result.current.toast({ title: 'Test unmount' });
    });
    
    // Unmount the component
    unmount();
    
    // Add another toast with the standalone function
    act(() => {
      toast({ title: 'After unmount' });
    });
    
    // The unmounted component's state should not have been updated
    // This is mostly a coverage test, as we can't directly check if listeners were cleaned up
    expect(result.current.toasts.length).toBe(1);
    expect(result.current.toasts[0].title).toBe('Test unmount');
  });
  
  it('should handle toast limit correctly', () => {
    const { result } = renderHook(() => useToast());
    
    // Add first toast
    act(() => {
      result.current.toast({ title: 'Toast 1' });
    });
    
    expect(result.current.toasts.length).toBe(1);
    expect(result.current.toasts[0].title).toBe('Toast 1');
    
    // Add second toast - should replace first toast due to TOAST_LIMIT = 1
    act(() => {
      result.current.toast({ title: 'Toast 2' });
    });
    
    expect(result.current.toasts.length).toBe(1);
    expect(result.current.toasts[0].title).toBe('Toast 2');
  });
});
