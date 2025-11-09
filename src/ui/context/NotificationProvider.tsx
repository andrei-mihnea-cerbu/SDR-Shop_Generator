import React, { createContext, useContext, useState } from 'react';
import NotificationSnackbar from '../components/NotificationSnackbar.tsx';

type NotificationState = {
  message: string;
  severity: 'success' | 'error' | 'info' | 'warning';
  open: boolean;
};

type NotificationContextType = {
  setNotification: (
    message: string,
    severity: 'success' | 'error' | 'info' | 'warning'
  ) => void;
};

const NotificationContext = createContext<NotificationContextType | undefined>(
  undefined
);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [notificationState, setNotificationState] = useState<NotificationState>(
    {
      message: '',
      severity: 'info',
      open: false,
    }
  );

  const setNotification = (
    message: string,
    severity: 'success' | 'error' | 'info' | 'warning'
  ) => {
    setNotificationState({ message, severity, open: true });
  };

  const handleClose = () => {
    setNotificationState((prev) => ({ ...prev, open: false }));
  };

  return (
    <NotificationContext.Provider value={{ setNotification }}>
      {children}
      <NotificationSnackbar
        open={notificationState.open}
        onClose={handleClose}
        message={notificationState.message}
        severity={notificationState.severity}
      />
    </NotificationContext.Provider>
  );
};

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error(
      'useNotification must be used within a NotificationProvider'
    );
  }
  return context;
};
