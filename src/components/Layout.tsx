import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

interface LayoutProps {
  title: string;
  children: React.ReactNode;
  showAddButton?: boolean;
  showClose?: boolean;
}

export const Layout: React.FC<LayoutProps> = ({ title, children, showAddButton, showClose }) => {
  const navigate = useNavigate();
  const location = useLocation();
  
  const currentPath = location.pathname;

  return (
    <div className="max-w-sm mx-auto bg-white min-h-screen border-2 border-black relative">
      <div className="p-5 border-b-2 border-black flex items-center justify-between">
        <h1 className="text-lg font-bold">{title}</h1>
        {showClose && (
          <button 
            onClick={() => navigate(-1)}
            className="bg-none border-none text-lg cursor-pointer"
          >
            ✕
          </button>
        )}
      </div>
      
      <div className="p-5 h-[calc(100vh-140px)] overflow-y-auto">
        {children}
      </div>
      
      <div className="absolute bottom-0 left-0 right-0 flex border-t-2 border-black">
        <button 
          className={`flex-1 p-4 border-none border-r-2 border-black cursor-pointer text-sm ${
            currentPath === '/' ? 'bg-gray-200' : 'bg-white'
          } hover:bg-gray-100`}
          onClick={() => navigate('/')}
        >
          Items
        </button>
        <button 
          className={`flex-1 p-4 border-none border-r-2 border-black cursor-pointer text-sm ${
            currentPath === '/categories' ? 'bg-gray-200' : 'bg-white'
          } hover:bg-gray-100`}
          onClick={() => navigate('/categories')}
        >
          Categories
        </button>
        <button 
          className={`flex-1 p-4 border-none cursor-pointer text-sm ${
            currentPath === '/scan' ? 'bg-gray-200' : 'bg-white'
          } hover:bg-gray-100`}
          onClick={() => navigate('/scan')}
        >
          Scan
        </button>
      </div>
      
      {showAddButton && (
        <button 
          onClick={() => navigate('/add')}
          className="absolute bottom-20 right-5 w-14 h-14 rounded-full bg-green-600 text-white text-2xl shadow-lg hover:bg-green-700 flex items-center justify-center z-10"
        >
          +
        </button>
      )}
    </div>
  );
};