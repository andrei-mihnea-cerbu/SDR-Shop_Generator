import React from 'react';
import { Box } from '@mui/material';
import CopyrightBanner from '../components/CopyrightBanner.tsx';

const MainLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          flexGrow: 1, // This makes sure the content grows to fill the remaining space
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        {children}
      </Box>

      <CopyrightBanner />
    </Box>
  );
};

export default MainLayout;
