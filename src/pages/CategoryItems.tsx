import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Layout } from '../components/Layout.tsx';
import { FoodItem } from '../types';
import { foodApi } from '../services/api.ts';

export const CategoryItems: React.FC = () => {
  const { categoryName } = useParams<{ categoryName: string }>();
  const [items, setItems] = useState<FoodItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCategoryItems();
  }, [categoryName]);

  const loadCategoryItems = async () => {
    if (!categoryName) return;
    
    try {
      setLoading(true);
      const allItems = await foodApi.getAllItems();
      const categoryItems = allItems.filter(item => 
        item.category === decodeURIComponent(categoryName) && item.daysLeft > 0
      );
      setItems(categoryItems);
    } catch (error) {
      console.error('Error loading category items:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleQuantityChange = async (id: string, currentQuantity: number, change: number) => {
    const newQuantity = currentQuantity + change;
    try {
      await foodApi.updateQuantity(id, newQuantity);
      await loadCategoryItems();
    } catch (error) {
      console.error('Error updating quantity:', error);
      alert('Error updating quantity. Please try again.');
    }
  };

  const handleDeleteItem = async (id: string, name: string) => {
    if (window.confirm(`Are you sure you want to delete "${name}"?`)) {
      try {
        await foodApi.deleteItem(id);
        await loadCategoryItems();
      } catch (error) {
        console.error('Error deleting item:', error);
        alert('Error deleting item. Please try again.');
      }
    }
  };

  const decodedCategoryName = categoryName ? decodeURIComponent(categoryName) : '';

  return (
    <Layout title={`← ${decodedCategoryName}`} showClose>
      <div className="mb-4">
        <h2 className="text-xl font-bold text-gray-800">
          {items.length} item{items.length !== 1 ? 's' : ''} in {decodedCategoryName}
        </h2>
      </div>

      {loading ? (
        <div className="text-center py-8">Loading...</div>
      ) : items.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          No items found in this category
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {items.map(item => (
            <div 
              key={item.id} 
              className={`flex justify-between items-center p-4 border-2 border-black rounded-none ${
                item.daysLeft <= 0 ? 'bg-red-50' :
                item.daysLeft <= 2 ? 'bg-orange-50' :
                item.daysLeft <= 5 ? 'bg-purple-50' :
                'bg-white'
              }`}
            >
              <div className="flex-1">
                <div className="font-bold mb-1">{item.name}</div>
                <div className="text-sm text-gray-600">
                  {item.description && <span>{item.description} • </span>}
                  <span className="font-medium">{item.quantity} {item.unit}</span>
                </div>
              </div>
              
              <div className="flex flex-col items-end gap-2">
                <div className={`font-bold ${
                  item.daysLeft <= 0 ? 'text-red-600' :
                  item.daysLeft <= 2 ? 'text-orange-600' :
                  item.daysLeft <= 5 ? 'text-purple-600' :
                  'text-green-600'
                }`}>
                  {item.daysLeft <= 0 ? 'Expired' : `${item.daysLeft} days`}
                </div>
                
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 bg-gray-50 rounded-full px-2 py-1">
                    <button
                      onClick={() => handleQuantityChange(item.id, item.quantity, -1)}
                      className="w-8 h-8 rounded-full bg-white border border-gray-300 hover:bg-gray-100 text-gray-600 flex items-center justify-center text-sm font-bold transition-colors shadow-sm"
                      title="Decrease quantity"
                    >
                      -
                    </button>
                    <span className="text-sm font-medium text-gray-700 px-2">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => handleQuantityChange(item.id, item.quantity, 1)}
                      className="w-8 h-8 rounded-full bg-white border border-green-300 hover:bg-green-50 text-green-600 flex items-center justify-center text-sm font-bold transition-colors shadow-sm"
                      title="Increase quantity"
                    >
                      +
                    </button>
                  </div>
                  
                  <button
                    onClick={() => handleDeleteItem(item.id, item.name)}
                    className="w-8 h-8 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center text-sm font-bold transition-colors shadow-sm"
                    title="Delete item"
                  >
                    ✕
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Layout>
  );
};