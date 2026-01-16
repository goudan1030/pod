import React from 'react';
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';
import Designer from '../components/Designer';
import AdminLayout from '../components/Admin/AdminLayout';

import CategoryManager from '../components/Admin/CategoryManager';
import ModelManager from '../components/Admin/ModelManager';
import ModelUploader from '../components/Admin/ModelUploader';

const AdminDashboard = () => (
    <div className="p-8 bg-white rounded-xl border border-gray-200 shadow-sm text-center">
        <h3 className="text-xl font-bold text-gray-800 mb-2">Welcome to Admin Panel</h3>
        <p className="text-gray-500">Select an option from the sidebar to manage your store content.</p>
    </div>
);

const router = createBrowserRouter([
    {
        path: '/',
        element: <Designer />,
    },
    {
        path: '/admin',
        element: <AdminLayout />,
        children: [
            {
                index: true,
                element: <AdminDashboard />
            },
            {
                path: 'categories',
                element: <CategoryManager />
            },
            {
                path: 'models',
                element: <ModelManager />
            },
            {
                path: 'models/upload',
                element: <ModelUploader /> // Make sure to import this
            },
            {
                path: 'models/edit/:id',
                element: <ModelUploader />
            }
        ]
    },
    // Catch-all route to redirect back to home
    {
        path: '*',
        element: <Navigate to="/" replace />
    }
]);

export const AppRouter: React.FC = () => {
    return <RouterProvider router={router} />;
};
