import React, { createContext, useContext } from 'react';
import axios from 'axios';
import { Shop } from '../interfaces/shop';

interface ShopContextType {
  getShopInfo: () => Promise<Shop | null>;
}

const ShopContext = createContext<ShopContextType | undefined>(undefined);

export const ShopProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const getShopInfo = async (): Promise<Shop | null> => {
    try {
      const response = await axios.get<Shop>('/info');
      return response.data;
    } catch (error) {
      console.error('Failed to fetch or decrypt shop info:', error);
      return null;
    }
  };

  return (
    <ShopContext.Provider value={{ getShopInfo }}>
      {children}
    </ShopContext.Provider>
  );
};

export const useShop = (): ShopContextType => {
  const context = useContext(ShopContext);
  if (!context) {
    throw new Error('useShop must be used within a ShopProvider');
  }
  return context;
};
