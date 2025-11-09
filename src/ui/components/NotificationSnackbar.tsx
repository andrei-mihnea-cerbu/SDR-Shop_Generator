import React from 'react';
import { Snackbar, Alert, AlertColor } from '@mui/material';

interface NotificationSnackbarProps {
  open: boolean;
  onClose: () => void;
  message: string;
  severity?: AlertColor;
  autoHideDuration?: number;
}

const NotificationSnackbar: React.FC<NotificationSnackbarProps> = ({
  open,
  onClose,
  message,
  severity = 'error',
  autoHideDuration = 3000,
}) => {
  return (
    <Snackbar
      open={open}
      autoHideDuration={autoHideDuration}
      onClose={onClose}
      anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
    >
      <Alert onClose={onClose} severity={severity} sx={{ width: '100%' }}>
        {message}
      </Alert>
    </Snackbar>
  );
};

export default NotificationSnackbar;
