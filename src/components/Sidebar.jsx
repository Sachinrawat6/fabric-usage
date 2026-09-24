import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Menu, X, Scissors, FileText, ChevronLeft, ChevronRight } from 'lucide-react';

const Sidebar = () => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const menuItems = [
    {
      title: 'Fabric Consumption',
      path: '/',
      icon: <Scissors size={20} />,
    },
    {
      title: 'By Style number',
      path: '/by-stylenumbers',
      icon: <FileText size={20} />,
    },
  ];

  return (
    <>
      {/* Mobile toggle button */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="md:hidden fixed top-4 left-4 z-[60] p-2.5 rounded-lg bg-slate-800 text-white shadow-lg hover:bg-slate-700 transition"
        aria-label="Toggle sidebar"
      >
        {isCollapsed ? <Menu size={22} /> : <X size={22} />}
      </button>

      {/* Sidebar */}
      <aside
        className={`fixed md:sticky top-0 left-0 z-50 h-screen flex flex-col
          bg-gradient-to-b from-slate-800 to-slate-900 text-slate-200
          shadow-xl transition-all duration-300 ease-in-out
          ${isCollapsed ? 'w-[72px] -translate-x-full md:translate-x-0' : 'w-64 translate-x-0'}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 min-h-[72px] border-b border-white/10 overflow-hidden">
          <div className="flex items-center gap-2.5 text-sky-400 font-bold text-base whitespace-nowrap">
            <Scissors size={26} className="shrink-0" />
            {!isCollapsed && <span>FabricTracker</span>}
          </div>

          {/* Desktop collapse toggle */}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="hidden md:flex items-center justify-center p-1.5 rounded-md
              bg-white/5 text-slate-400 hover:bg-white/10 hover:text-slate-100
              transition shrink-0"
            aria-label="Toggle sidebar"
          >
            {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 py-3 flex flex-col gap-1 overflow-y-auto overflow-x-hidden">
          {menuItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              title={isCollapsed ? item.title : ''}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap overflow-hidden
                ${
                  isActive
                    ? 'bg-gradient-to-r from-sky-500 to-sky-600 text-white shadow-lg shadow-sky-500/30'
                    : 'text-slate-300 hover:bg-white/5 hover:text-slate-100'
                }`
              }
            >
              <span className="shrink-0 flex items-center">{item.icon}</span>
              {!isCollapsed && <span className="flex-1 truncate">{item.title}</span>}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-4 py-4 border-t border-white/10 text-center">
          {!isCollapsed && <span className="text-xs text-slate-500">v1.0.0</span>}
        </div>
      </aside>

      {/* Mobile overlay */}
      {!isCollapsed && (
        <div
          onClick={() => setIsCollapsed(true)}
          className="md:hidden fixed inset-0 bg-black/50 z-40"
        />
      )}
    </>
  );
};

export default Sidebar;
