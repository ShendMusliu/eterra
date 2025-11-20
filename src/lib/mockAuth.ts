/**
 * Mock Authentication Service for Sandbox Development
 * This simulates AWS Amplify Auth for local testing
 * Replace with real Amplify Auth when deploying
 */

interface User {
  email: string;
  name: string;
  id: string;
}

interface StoredUser extends User {
  password: string;
}

const STORAGE_KEY = 'mock_users';
const SESSION_KEY = 'mock_session';

// Initialize with some demo accounts
const initializeMockUsers = () => {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) {
    const demoUsers: StoredUser[] = [
      {
        id: '1',
        email: 'admin@example.com',
        password: 'admin123',
        name: 'Admin User'
      },
      {
        id: '2',
        email: 'user@example.com',
        password: 'user123',
        name: 'Regular User'
      }
    ];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(demoUsers));
  }
};

const getUsers = (): StoredUser[] => {
  initializeMockUsers();
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored ? JSON.parse(stored) : [];
};

const saveUsers = (users: StoredUser[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(users));
};

export const mockAuth = {
  async signUp(email: string, password: string, name: string): Promise<{ success: boolean; error?: string }> {
    const users = getUsers();

    if (users.find(u => u.email === email)) {
      return { success: false, error: 'User already exists' };
    }

    const newUser: StoredUser = {
      id: Date.now().toString(),
      email,
      password,
      name
    };

    users.push(newUser);
    saveUsers(users);

    return { success: true };
  },

  async signIn(email: string, password: string): Promise<{ success: boolean; user?: User; error?: string }> {
    const users = getUsers();
    const user = users.find(u => u.email === email && u.password === password);

    if (!user) {
      return { success: false, error: 'Invalid email or password' };
    }

    const session = {
      email: user.email,
      name: user.name,
      id: user.id
    };

    localStorage.setItem(SESSION_KEY, JSON.stringify(session));

    return {
      success: true,
      user: session
    };
  },

  async signOut(): Promise<void> {
    localStorage.removeItem(SESSION_KEY);
  },

  async getCurrentUser(): Promise<User | null> {
    const stored = localStorage.getItem(SESSION_KEY);
    return stored ? JSON.parse(stored) : null;
  },

  async isAuthenticated(): Promise<boolean> {
    const user = await this.getCurrentUser();
    return user !== null;
  }
};
