import React from 'react';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Outlet,
} from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import MainLayout from './layouts/MainLayout.tsx';
import NotFoundPage from './pages/NotFoundPage.tsx';
import HomePage from './pages/HomePage.tsx';

const theme = createTheme(); // Create a theme instance

// MainLayout Wrapper
const MainWrapper = () => (
  <MainLayout>
    <Outlet />
  </MainLayout>
);

const App: React.FC = () => {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Router>
        <Routes>
          <Route element={<MainWrapper />}>
            <Route path="/">
              <Route index element={<HomePage />} />
            </Route>
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </Router>
    </ThemeProvider>
  );
};

export default App;
