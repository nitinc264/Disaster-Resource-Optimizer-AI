import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import {
  loginWithPin as loginService,
  logout as logoutService,
  checkSession,
  getStoredAuth,
  initializeAuth,
} from "../services/authService";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Check session on app load for 24-hour persistence
  useEffect(() => {
    const restoreSession = async () => {
      try {
        // First check local storage for quick restore
        const storedAuth = getStoredAuth();

        if (storedAuth) {
          // Initialize auth headers
          initializeAuth();

          // Verify session is still valid on server
          const sessionStatus = await checkSession();

          if (sessionStatus.authenticated) {
            setUser(sessionStatus.user);
          }
        }
      } catch (error) {
        console.error("Session restore error:", error);
      } finally {
        setLoading(false);
      }
    };

    restoreSession();
  }, []);

  const login = useCallback(async (pin) => {
    const result = await loginService(pin);
    if (result.success) {
      setUser(result.data);
    }
    return result;
  }, []);

  const logout = useCallback(async () => {
    await logoutService();
    setUser(null);
  }, []);

  const isManager = user?.role === "manager";
  const isVolunteer = user?.role === "volunteer";
  const isAuthenticated = !!user;

  const value = {
    user,
    loading,
    login,
    logout,
    isAuthenticated,
    isManager,
    isVolunteer,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

export default AuthContext;
