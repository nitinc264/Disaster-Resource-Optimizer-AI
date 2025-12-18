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
} from "../services/authService";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Always require PIN on website first load - don't auto-restore session
  useEffect(() => {
    // Just set loading to false, don't auto-login from localStorage
    // User must always enter PIN when website first starts
    setLoading(false);
  }, []);

  const login = useCallback(async (pin) => {
    const result = await loginService(pin);
    if (result.success) {
      setUser(result.data);
    }
    return result;
  }, []);

  const logout = useCallback(() => {
    logoutService();
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
