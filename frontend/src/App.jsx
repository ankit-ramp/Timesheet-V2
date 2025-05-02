import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import TimesheetPage from './pages/TimesheetPage';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import Login from './pages/Login';
import ApprovalPage from './pages/ApprovalPage';
import TimesheetHistory from './pages/TimesheetHistory';
import LandingPage from './pages/LandingPage';

const ProtectedRoute = ({ children }) => {
  const token = localStorage.getItem('token');
  if (!token) {
    return <Navigate to="/login" />;
  }
  return children;
};

const PublicRoute = ({ children }) => {
  const token = localStorage.getItem('token');
  if (token) {
    return <Navigate to="/" />; // already logged in, redirect to LandingPage
  }
  return children;
};

export default function App() {
  return (
    <>
      <ToastContainer 
        position="top-right" 
        autoClose={5000} 
        hideProgressBar={false} 
        newestOnTop={false} 
        closeOnClick 
        rtl={false} 
        pauseOnFocusLoss 
        draggable 
        pauseOnHover 
      />
      <Router>
        <Routes>
          {/* Public route for login */}
          <Route path="/login" element={
            <PublicRoute>
              <Login />
            </PublicRoute>
          } />

          {/* Protected Routes */}
          <Route path="/" element={
            <ProtectedRoute>
              <LandingPage />
            </ProtectedRoute>
          } />

          <Route path="/timesheet" element={
            <ProtectedRoute>
              <TimesheetPage />
            </ProtectedRoute>
          } />

          <Route path="/approval" element={
            <ProtectedRoute>
              <ApprovalPage />
            </ProtectedRoute>
          } />

          <Route path="/timesheet-history" element={
            <ProtectedRoute>
              <TimesheetHistory />
            </ProtectedRoute>
          } />
          
          {/* Catch all unknown routes and redirect to login or landing based on token */}
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Router>
    </>
  );
}
