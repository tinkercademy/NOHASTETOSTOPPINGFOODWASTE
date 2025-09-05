import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { Layout } from '../components/Layout.tsx';
import { FoodItem } from '../types';
import { foodApi } from '../services/api.ts';

const TabContainer = styled.div`
  display: flex;
  margin-bottom: 20px;
  border-bottom: 2px solid #000;
`;

const Tab = styled.button<{ active: boolean }>`
  flex: 1;
  padding: 10px;
  border: none;
  background: ${props => props.active ? '#000' : 'white'};
  color: ${props => props.active ? 'white' : '#000'};
  cursor: pointer;
  border-bottom: ${props => props.active ? 'none' : '2px solid #000'};
`;

const ItemList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const ItemCard = styled.div<{ daysLeft: number }>`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px;
  border: 2px solid #000;
  background: ${props => 
    props.daysLeft <= 0 ? '#ffebee' :
    props.daysLeft <= 2 ? '#fff3e0' :
    props.daysLeft <= 5 ? '#f3e5f5' :
    'white'
  };
`;

const ItemInfo = styled.div`
  flex: 1;
`;

const ItemName = styled.div`
  font-weight: bold;
  margin-bottom: 5px;
`;

const ItemDetails = styled.div`
  font-size: 12px;
  color: #666;
`;

const DaysLeft = styled.div<{ days: number }>`
  font-weight: bold;
  color: ${props => 
    props.days <= 0 ? '#d32f2f' :
    props.days <= 2 ? '#f57c00' :
    props.days <= 5 ? '#7b1fa2' :
    '#388e3c'
  };
`;

export const PantryItems: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'pantry' | 'expired'>('pantry');
  const [items, setItems] = useState<FoodItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadItems();
  }, []);

  const loadItems = async () => {
    try {
      setLoading(true);
      const data = await foodApi.getAllItems();
      setItems(data);
    } catch (error) {
      console.error('Error loading items:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteItem = async (id: string, name: string) => {
    if (window.confirm(`Are you sure you want to delete "${name}"?`)) {
      try {
        await foodApi.deleteItem(id);
        // Reload items after successful deletion
        await loadItems();
      } catch (error) {
        console.error('Error deleting item:', error);
        alert('Error deleting item. Please try again.');
      }
    }
  };

  const handleQuantityChange = async (id: string, currentQuantity: number, change: number) => {
    const newQuantity = currentQuantity + change;
    try {
      await foodApi.updateQuantity(id, newQuantity);
      // Reload items after successful update
      await loadItems();
    } catch (error) {
      console.error('Error updating quantity:', error);
      alert('Error updating quantity. Please try again.');
    }
  };

  const pantryItems = items.filter(item => item.daysLeft > 0);
  const expiredItems = items.filter(item => item.daysLeft <= 0);

  return (
    <Layout title="Pantry Items" showAddButton>
      <TabContainer>
        <Tab 
          active={activeTab === 'pantry'} 
          onClick={() => setActiveTab('pantry')}
        >
          Pantry Items
        </Tab>
        <Tab 
          active={activeTab === 'expired'} 
          onClick={() => setActiveTab('expired')}
        >
          Expired Items
        </Tab>
      </TabContainer>

      <ItemList>
        {loading ? (
          <div>Loading...</div>
        ) : (
          (activeTab === 'pantry' ? pantryItems : expiredItems).map(item => (
          <ItemCard key={item.id} daysLeft={item.daysLeft}>
            <ItemInfo>
              <ItemName>{item.name}</ItemName>
              <ItemDetails>
                {item.description && <span>{item.description} • </span>}
                <span className="font-medium">{item.quantity} {item.unit}</span>
              </ItemDetails>
            </ItemInfo>
            <div className="flex flex-col items-end gap-2">
              <DaysLeft days={item.daysLeft}>
                {item.daysLeft <= 0 ? 'Expired' : `${item.daysLeft} days`}
              </DaysLeft>
              
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
          </ItemCard>
          ))
        )}
      </ItemList>
    </Layout>
  );
};