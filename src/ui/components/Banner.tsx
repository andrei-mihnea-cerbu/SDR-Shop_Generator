import React from 'react';
import { Box, Typography, useMediaQuery, useTheme } from '@mui/material';

interface BannerProps {
  imageUrl: string;
  mainTitle: string;
  subTitle: string;
}

const Banner: React.FC<BannerProps> = ({ imageUrl, mainTitle, subTitle }) => {
  const theme = useTheme();
  const isSmall = useMediaQuery(theme.breakpoints.down('sm'));

  const fullImageUrl = imageUrl.startsWith('http')
    ? imageUrl
    : `${window.location.origin}${imageUrl}`;

  console.log('Banner image URL:', fullImageUrl);

  return (
    <Box
      sx={{
        position: 'relative',
        width: '100vw',
        height: isSmall ? '60vh' : '100vh',
        overflow: 'hidden',
        m: 0,
        p: 0,
      }}
    >
      {/* Background Image */}
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          backgroundImage: `url('${fullImageUrl}')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          zIndex: 0,
        }}
      />

      {/* Dimming Overlay */}
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.3)',
          zIndex: 1,
        }}
      />

      {/* Text Content */}
      <Box
        sx={{
          position: 'relative',
          zIndex: 2,
          color: 'white',
          textAlign: 'center',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          px: 2,
        }}
      >
        <Typography
          variant="h2"
          fontWeight="bold"
          sx={{ fontSize: isSmall ? '2rem' : '4rem' }}
        >
          {mainTitle}
        </Typography>
        <Typography variant="h5" sx={{ fontSize: isSmall ? '1rem' : '2rem' }}>
          {subTitle}
        </Typography>
      </Box>
    </Box>
  );
};

export default Banner;
