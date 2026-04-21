import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';

export function AuthCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Get the session from URL hash
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const accessToken = hashParams.get('access_token');
        const type = hashParams.get('type');

        if (accessToken) {
          // Session is already established by Supabase client
          // Just redirect to home
          await new Promise(resolve => setTimeout(resolve, 500)); // Small delay to ensure auth state is set
          navigate('/', { replace: true });
        } else {
          setError('Invalid confirmation link');
          setTimeout(() => navigate('/login', { replace: true }), 3000);
        }
      } catch (error) {
        console.error('Auth callback error:', error);
        setError('An error occurred during authentication');
        setTimeout(() => navigate('/login', { replace: true }), 3000);
      }
    };

    handleCallback();
  }, [navigate]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        {error ? (
          <>
            <div className="text-4xl mb-4">❌</div>
            <h1 className="text-2xl font-bold text-red-600 mb-2">Authentication Error</h1>
            <p className="text-gray-600 mb-4">{error}</p>
            <p className="text-sm text-gray-500">Redirecting to login...</p>
          </>
        ) : (
          <>
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto mb-4"></div>
            <h1 className="text-2xl font-bold text-gray-800 mb-2">Confirming your email...</h1>
            <p className="text-gray-600">Please wait while we verify your account.</p>
          </>
        )}
      </div>
    </div>
  );
}
