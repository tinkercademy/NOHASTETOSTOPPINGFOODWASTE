import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout.tsx';
import { Category } from '../types';
import { foodApi } from '../services/api.ts';

export const Categories: React.FC = () => {
  const navigate = useNavigate();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      setLoading(true);
      const data = await foodApi.getCategories();
      setCategories(data);
    } catch (error) {
      console.error('Error loading categories:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCategoryClick = (categoryName: string) => {
    navigate(`/categories/${encodeURIComponent(categoryName)}`);
  };

  return (
    <Layout title="≡ Category List" showAddButton>
      <div className="flex flex-col gap-4">
        {loading ? (
          <div className="text-center py-8">Loading...</div>
        ) : categories.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No categories found. Add some items first!
          </div>
        ) : (
          categories.map((category, index) => (
            <button
              key={index}
              onClick={() => handleCategoryClick(category.name)}
              className="flex justify-between items-center p-5 border-b-2 border-black hover:bg-gray-50 text-left transition-colors"
            >
              <span className="text-lg font-medium">{category.name}</span>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold">{category.count}</span>
                <span className="text-gray-400">→</span>
              </div>
            </button>
          ))
        )}
      </div>
    </Layout>
  );
};