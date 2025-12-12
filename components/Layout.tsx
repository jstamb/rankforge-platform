import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom';
import {
  LayoutDashboard, Globe, Building2, Settings, Plug, Bell, User, LogOut, LogIn
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { signOut } from '../services/auth';

const SidebarItem = ({ icon: Icon, label, path, active }: any) => (
  <Link 
    to={path} 
    className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors mb-1
      ${active 
        ? 'bg-indigo-500/10 text-indigo-400' 
        : 'text-slate-400 hover:bg-slate-800 hover:text-white'
      }`}
  >
    <Icon size={18} />
    {label}
  </Link>
);

export const Layout: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [showUserMenu, setShowUserMenu] = useState(false);

  useEffect(() => {
    // Check initial session
    if (supabase) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        setUser(session?.user ?? null);
      });

      // Listen for auth changes
      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        setUser(session?.user ?? null);
      });

      return () => subscription.unsubscribe();
    }
  }, []);

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + '/');
  const isAuthPage = location.pathname === '/login';

  // If we are on the login page, render a simplified layout
  if (isAuthPage) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
         <header className="h-16 bg-white border-b border-slate-200 flex items-center px-6 justify-between">
            <div className="flex items-center gap-2">
              <img src="/rank-forge-logo.svg" alt="RankForge" className="h-8 w-auto" />
            </div>
         </header>
         <main className="flex-1">
           <Outlet />
         </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 border-r border-slate-800 fixed h-full z-20 hidden md:flex flex-col">
        <div className="h-16 flex items-center px-6 border-b border-slate-800">
          <img src="/rank-forge-logo.svg" alt="RankForge" className="h-8 w-auto brightness-0 invert" />
        </div>

        <nav className="flex-1 p-4 overflow-y-auto">
          <div className="mb-6">
            <p className="px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Platform</p>
            <SidebarItem icon={LayoutDashboard} label="Dashboard" path="/dashboard" active={location.pathname === '/dashboard' || location.pathname === '/'} />
            <SidebarItem icon={Globe} label="Websites" path="/websites" active={isActive('/websites')} />
            <SidebarItem icon={Building2} label="Businesses" path="/businesses" active={isActive('/businesses')} />
          </div>

          <div>
            <p className="px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Tools</p>
            <SidebarItem icon={Plug} label="Integrations" path="/integrations" active={isActive('/integrations')} />
            <SidebarItem icon={Settings} label="Settings" path="/settings" active={isActive('/settings')} />
          </div>
        </nav>

        <div className="p-4 border-t border-slate-800">
          {user ? (
            <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-slate-800/50 border border-slate-700">
              <div className="flex items-center gap-3 overflow-hidden">
                <div className="w-8 h-8 rounded-full bg-indigo-500 flex-shrink-0 flex items-center justify-center text-white text-xs font-bold">
                  {user.email?.substring(0, 2).toUpperCase()}
                </div>
                <div className="overflow-hidden">
                  <p className="text-sm font-medium text-white truncate">{user.email?.split('@')[0]}</p>
                  <p className="text-xs text-slate-400 truncate">Free Plan</p>
                </div>
              </div>
              <button 
                onClick={handleSignOut}
                className="text-slate-400 hover:text-white transition-colors"
                title="Sign Out"
              >
                <LogOut size={16} />
              </button>
            </div>
          ) : (
            <Link 
              to="/login"
              className="flex items-center justify-center gap-2 w-full px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <LogIn size={16} />
              Sign In
            </Link>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 md:ml-64 flex flex-col min-h-screen">
        {/* Header */}
        <header className="h-16 bg-white border-b border-slate-200 sticky top-0 z-10 px-6 flex items-center justify-between">
          <div className="md:hidden">
             {/* Mobile Menu Trigger would go here */}
             <span className="font-bold text-slate-900">RankForge</span>
          </div>
          <div className="hidden md:block">
            {/* Breadcrumbs or Page Title could go here */}
          </div>
          <div className="flex items-center gap-4">
            <Link
              to="/settings"
              className="text-slate-500 hover:text-slate-700 relative"
              title="Notifications"
            >
              <Bell size={20} />
              <span className="absolute top-0 right-0 w-2 h-2 bg-rose-500 rounded-full border-2 border-white"></span>
            </Link>

            {/* User Menu */}
            <div className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition-colors"
                title="Account"
              >
                {user ? (
                  <span className="text-xs font-bold text-indigo-600">
                    {user.email?.substring(0, 2).toUpperCase()}
                  </span>
                ) : (
                  <User size={18} />
                )}
              </button>

              {showUserMenu && (
                <>
                  {/* Backdrop */}
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setShowUserMenu(false)}
                  />

                  {/* Dropdown */}
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-20">
                    {user ? (
                      <>
                        <div className="px-4 py-2 border-b border-slate-100">
                          <p className="text-sm font-medium text-slate-900 truncate">{user.email}</p>
                          <p className="text-xs text-slate-500">Free Plan</p>
                        </div>
                        <Link
                          to="/settings"
                          onClick={() => setShowUserMenu(false)}
                          className="flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                        >
                          <Settings size={16} />
                          Settings
                        </Link>
                        <button
                          onClick={() => {
                            setShowUserMenu(false);
                            handleSignOut();
                          }}
                          className="flex items-center gap-2 w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                        >
                          <LogOut size={16} />
                          Sign Out
                        </button>
                      </>
                    ) : (
                      <Link
                        to="/login"
                        onClick={() => setShowUserMenu(false)}
                        className="flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                      >
                        <LogIn size={16} />
                        Sign In
                      </Link>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-6 md:p-8 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};