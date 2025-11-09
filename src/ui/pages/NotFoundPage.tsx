import React from 'react';
import { Box, Button, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';

const NotFoundPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        textAlign: 'center',
        padding: { xs: 2, sm: 4 },
      }}
    >
      <Typography
        variant="h4"
        gutterBottom
        sx={{
          fontSize: { xs: '1.5rem', sm: '2.5rem' },
          fontWeight: 'bold',
          color: 'black',
        }}
      >
        Oops! Page Not Found
      </Typography>
      <Typography
        variant="body1"
        sx={{
          color: 'gray',
          fontSize: { xs: '1rem', sm: '1.5rem' },
          marginBottom: 4,
          maxWidth: '600px',
        }}
      >
        Sorry, the page you’re looking for doesn’t exist. It might have been
        removed or you may have mistyped the URL.
      </Typography>
      <Button
        variant="contained"
        color="primary"
        onClick={() => navigate('/')}
        sx={{
          fontSize: { xs: '0.875rem', sm: '1rem' },
          padding: { xs: '0.6rem 1.5rem', sm: '0.8rem 2rem' },
        }}
      >
        Go Home
      </Button>
    </Box>
  );
};

export default NotFoundPage;
