import React from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Package, FolderOpen, LogOut, Home } from 'lucide-react';
import logo from '../../assets/images/logo.svg';

const AdminLayout: React.FC = () => {
    const location = useLocation();

    const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + '/');

    return (
        <div className="flex h-screen bg-gray-50">
            {/* Sidebar */}
            <div className="w-64 bg-white border-r border-gray-200 flex flex-col">
                <div className="p-6 border-b border-gray-100 flex items-center gap-2">
                    <img src={logo} alt="Logo" className="h-8" />
                    {/* <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center text-white font-bold">
                        A
                    </div> */}
                    {/* <span className="text-xl font-bold text-gray-800">Admin Panel</span> */}
                </div>

                <nav className="flex-1 p-4 space-y-2">
                    <Link
                        to="/admin"
                        className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${location.pathname === '/admin'
                            ? 'bg-brand-50 text-brand-600 font-medium'
                            : 'text-gray-600 hover:bg-gray-50'
                            }`}
                    >
                        <LayoutDashboard size={20} />
                        Dashboard
                    </Link>

                    <Link
                        to="/admin/categories"
                        className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isActive('/admin/categories')
                            ? 'bg-brand-50 text-brand-600 font-medium'
                            : 'text-gray-600 hover:bg-gray-50'
                            }`}
                    >
                        <FolderOpen size={20} />
                        Categories
                    </Link>

                    <Link
                        to="/admin/models"
                        className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isActive('/admin/models')
                            ? 'bg-brand-50 text-brand-600 font-medium'
                            : 'text-gray-600 hover:bg-gray-50'
                            }`}
                    >
                        <Package size={20} />
                        Models
                    </Link>
                </nav>

                <div className="p-4 border-t border-gray-100 space-y-2">
                    <Link
                        to="/"
                        className="flex items-center gap-3 px-4 py-3 text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
                    >
                        <Home size={20} />
                        Back to Site
                    </Link>
                    <button className="w-full flex items-center gap-3 px-4 py-3 text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                        <LogOut size={20} />
                        Sign Out
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 overflow-auto">
                <header className="bg-white border-b border-gray-200 px-8 py-4 sticky top-0 z-10">
                    <h2 className="text-lg font-semibold text-gray-800">
                        {location.pathname === '/admin' && 'Dashboard'}
                        {location.pathname.includes('/categories') && 'Category Management'}
                        {location.pathname.includes('/models') && 'Model Management'}
                    </h2>
                </header>
                <div className="p-8">
                    <Outlet />
                </div>
            </div>
        </div>
    );
};

export default AdminLayout;
