import React, { useEffect } from 'react';
import { Box, Typography } from '@mui/material';
import { useShop } from '../context/ShopContext.tsx';

const Footer: React.FC = () => {
  const [shopName, setShopName] = React.useState<string>('');

  const { getShopInfo } = useShop();

  useEffect(() => {
    const fetchShopName = async () => {
      try {
        const shop = await getShopInfo();
        if (!shop) throw new Error('No shop info available');
        setShopName(shop.name || 'Your Shop');
      } catch (error) {
        console.error('Error fetching shop name:', error);
        setShopName('Your Shop'); // Fallback in case of error
      }
    };

    fetchShopName();
  }, []);

  return (
    <Box
      sx={{
        backgroundColor: '#000', // Dark blue background
        color: 'white', // White text
        padding: '10px 0',
        textAlign: 'center',
        position: 'relative',
        bottom: 0,
        width: '100%',
      }}
    >
      <Typography variant="body2">
        © {new Date().getFullYear()} {shopName} Shop. All rights reserved.
      </Typography>
    </Box>
  );
};

export default Footer;
