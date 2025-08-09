import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '~/hooks/useAuth';

export function meta() {
  return [
    { title: 'Nanika Game - Home' },
    { name: 'description', content: 'Welcome to Nanika Game!' },
  ];
}

export default function Home() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard');
    } else {
      navigate('/login');
    }
  }, [isAuthenticated, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">Loading...</p>
      </div>
    </div>
  );
}
