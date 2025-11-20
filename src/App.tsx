import { Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import SignUpPage from './pages/SignUpPage';
import DashboardPage from './pages/DashboardPage';
import CalculatorPage from './pages/CalculatorPage';
import PrivateExpensesPage from './pages/PrivateExpensesPage';
import ProtectedRoute from './components/ProtectedRoute';
import { useAuth } from './contexts/AuthContext';
import { ThemeToggle } from './components/ThemeToggle';

function App() {
  const { isAuthenticated } = useAuth();

  return (
    <>
      <ThemeToggle className="fixed right-4 top-4 z-50 backdrop-blur supports-[backdrop-filter]:bg-[hsl(var(--card))]/70" />
      <Routes>
        <Route
          path="/"
          element={
            isAuthenticated ? <Navigate to="/dashboard" replace /> : <Navigate to="/login" replace />
          }
        />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignUpPage />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />
      <Route
        path="/calculator"
        element={
          <ProtectedRoute>
            <CalculatorPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/private-expenses"
        element={
          <ProtectedRoute>
            <PrivateExpensesPage />
          </ProtectedRoute>
        }
      />
      </Routes>
    </>
  );
}

export default App;
