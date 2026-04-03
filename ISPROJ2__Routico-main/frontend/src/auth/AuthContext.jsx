import { createUserWithEmailAndPassword, onAuthStateChanged, signOut } from 'firebase/auth';
import { createContext, useContext, useEffect, useState } from 'react';
import { auth } from '../config/firebase';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

const getDashboardForRole = (role) => {
  if (role === 'administrator') return 'admin';
  if (role === 'driver') return 'driver';
  return 'business';
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState(null);
  const [userStatus, setUserStatus] = useState(null);
  const [jwt, setJwt] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userPermissions, setUserPermissions] = useState(new Set());
  const [dashboardType, setDashboardType] = useState(null);

  // Sign up function for business owners
  const signUp = async (email, password, userData) => {
    let firebaseUser = null;

    try {
      console.log('Starting registration process for:', email);

      // Step 1: Create Firebase user first
      console.log('Step 1: Creating Firebase user...');
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      firebaseUser = userCredential.user;
      console.log('Firebase user created successfully:', firebaseUser.uid);

      // Step 2: Create user in MySQL database
      console.log('Step 2: Creating MySQL user...');
      const formData = new FormData();
      formData.append('firstName', userData.firstName);
      formData.append('lastName', userData.lastName);
      if (userData.middleName) {
        formData.append('middleName', userData.middleName);
      }
      formData.append('email', email);
      formData.append('phone', userData.phone);
      formData.append('password', password);

      if (userData.companyDocument) {
        formData.append('companyDocument', userData.companyDocument);
        console.log('Company document attached:', userData.companyDocument.name);
      }

      const response = await fetch('/api/auth/register', {
        method: 'POST',
        body: formData, // Send as FormData for file upload
      });

      console.log('MySQL registration response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json();
        console.error('MySQL registration failed:', errorData);
        throw new Error(errorData.error || 'Failed to create user in database');
      }

      // Step 3: If database creation succeeds, return success
      console.log('Registration completed successfully');

      // Step 4: Fetch user data from database to set role and status
      try {
        const userResponse = await fetch(`/api/auth/user/${encodeURIComponent(email)}`);
        if (userResponse.ok) {
          const userData = await userResponse.json();
          setUserRole(userData.role);
          setUserStatus({
            account_status: userData.account_status,
            active_status: userData.active_status
          });
          console.log('User data fetched after registration:', userData);
        }
      } catch (fetchError) {
        console.error('Error fetching user data after registration:', fetchError);
      }

      return userCredential;

    } catch (error) {
      console.error('Registration error occurred:', error);

      // Rollback: If database creation fails, delete Firebase user
      if (firebaseUser) {
        try {
          console.log('Rolling back Firebase user due to error...');
          await firebaseUser.delete();
          console.log('Firebase user deleted successfully');
        } catch (deleteError) {
          console.error('Error deleting Firebase user:', deleteError);
        }
      }

      // Re-throw the original error
      throw error;
    }
  };

  // Sign in function
  const signIn = async (email, password) => {
    try {
      // Try JWT login first (works for all roles)
      const jwtResponse = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      if (jwtResponse.ok) {
        const data = await jwtResponse.json();
        setUser({ email: email, uid: data.user.userId });
        setJwt(data.token);
        setIsAdmin(data.user.role === 'administrator');
        setUserRole(data.user.role);
        setUserStatus({
          account_status: data.user.accountStatus,
          active_status: data.user.activeStatus
        });
        setUserPermissions(new Set(data.user.permissions || []));
        setDashboardType(data.user.dashboardType || getDashboardForRole(data.user.role));

        // Persist JWT session for page refresh
        sessionStorage.setItem('jwtUser', JSON.stringify({
          email,
          userId: data.user.userId,
          role: data.user.role,
          token: data.token,
          accountStatus: data.user.accountStatus,
          activeStatus: data.user.activeStatus,
          dashboardType: data.user.dashboardType || getDashboardForRole(data.user.role),
          permissions: data.user.permissions || []
        }));

        return { user: { email } };
      }

      // If JWT login failed, throw with the server error
      const errorData = await jwtResponse.json();
      throw new Error(errorData.error || 'Invalid credentials');
    } catch (error) {
      throw error;
    }
  };

  // Sign out function
  const logout = async () => {
    try {
      sessionStorage.removeItem('jwtUser');
      await signOut(auth);
      setUser(null);
      setUserRole(null);
      setUserStatus(null);
      setJwt(null);
      setIsAdmin(false);
      setUserPermissions(new Set());
      setDashboardType(null);
    } catch (error) {
      throw error;
    }
  };

  // Monitor auth state changes
  useEffect(() => {
    // Check for stored JWT session first (for admin and driver users)
    const storedJwtUser = sessionStorage.getItem('jwtUser');
    if (storedJwtUser) {
      try {
        const parsed = JSON.parse(storedJwtUser);
        setUser({ email: parsed.email, uid: parsed.userId });
        setJwt(parsed.token);
        setIsAdmin(parsed.role === 'administrator');
        setUserRole(parsed.role);
        setUserStatus({
          account_status: parsed.accountStatus,
          active_status: parsed.activeStatus
        });
        setUserPermissions(new Set(parsed.permissions || []));
        setDashboardType(parsed.dashboardType || getDashboardForRole(parsed.role));
        setLoading(false);
      } catch (e) {
        console.error('Error parsing stored JWT user:', e);
        sessionStorage.removeItem('jwtUser');
      }
      // Still subscribe to Firebase auth state but don't override JWT session
      const unsubscribe = onAuthStateChanged(auth, () => {});
      return unsubscribe;
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);

        // Fetch user role from database using email
        try {
          const response = await fetch(`/api/auth/user/${encodeURIComponent(firebaseUser.email)}`);

          if (response.ok) {
            const userData = await response.json();
            setUserRole(userData.role);
            setUserStatus({
              account_status: userData.account_status,
              active_status: userData.active_status
            });
            setUserPermissions(new Set(userData.permissions || []));
            setDashboardType(userData.dashboard_type || getDashboardForRole(userData.role));
          } else {
            console.error('Failed to fetch user data from database');
            setUserRole(null);
            setUserStatus(null);
            setUserPermissions(new Set());
            setDashboardType(null);
          }
        } catch (error) {
          console.error('Error fetching user data:', error);
          setUserRole(null);
        }
      } else {
        // Only clear state if there's no JWT session
        if (!sessionStorage.getItem('jwtUser')) {
          setUser(null);
          setUserRole(null);
          setUserStatus(null);
        }
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const hasPermission = (permKey) => userPermissions.has(permKey);

  const value = {
    user,
    userRole,
    userStatus,
    userPermissions,
    signUp,
    signIn,
    logout,
    loading,
    isAdmin,
    isDriver: userRole === 'driver',
    dashboardType,
    getToken: () => jwt,
    hasPermission
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
