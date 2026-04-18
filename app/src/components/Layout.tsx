import { useState, useEffect } from 'react';
import { BottomNav } from './BottomNav';
import { Header } from './Header';
import { useAuth } from '@/hooks';

interface LayoutProps {
  children: React.ReactNode;
  hideNav?: boolean;
  hideHeader?: boolean;
}

export function Layout({ children, hideNav = false, hideHeader = false }: LayoutProps) {
  const { isAuthenticated } = useAuth();
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      {!hideHeader && <Header />}
      
      <main className={`${!hideHeader ? 'pt-16' : ''} ${!hideNav && isAuthenticated && isMobile ? 'pb-20' : ''}`}>
        <div className="max-w-7xl mx-auto">
          {children}
        </div>
      </main>

      {!hideNav && isAuthenticated && isMobile && <BottomNav />}
    </div>
  );
}
