import { useState, useEffect } from 'react';
import { BottomNav } from './BottomNav';
import { Header } from './Header';
import { Footer } from './Footer';
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

  const showBottomNav = !hideNav && isAuthenticated && isMobile;

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {!hideHeader && <Header />}
      
      <main className={`flex-grow ${!hideHeader ? 'pt-16' : ''}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {children}
        </div>
      </main>

      <div className={showBottomNav ? 'pb-16' : ''}>
        <Footer />
      </div>

      {showBottomNav && <BottomNav />}
    </div>
  );
}
