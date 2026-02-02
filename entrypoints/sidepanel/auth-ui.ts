import { authService } from '../../supabase/services/auth';
import { storageService } from '../../supabase/services/storage';
import { syncService } from '../../supabase/services/sync';

/**
 * Authentication UI handler for the side panel
 */
export class AuthUI {
  private loginFormContainer: HTMLElement;
  private signupFormContainer: HTMLElement;
  private loggedOutView: HTMLElement;
  private loggedInView: HTMLElement;
  private setupRequiredView: HTMLElement;
  private authError: HTMLElement;
  private authSuccess: HTMLElement;

  constructor() {
    this.loginFormContainer = document.getElementById('login-form-container')!;
    this.signupFormContainer = document.getElementById('signup-form-container')!;
    this.loggedOutView = document.getElementById('auth-logged-out')!;
    this.loggedInView = document.getElementById('auth-logged-in')!;
    this.setupRequiredView = document.getElementById('auth-setup-required')!;
    this.authError = document.getElementById('auth-error')!;
    this.authSuccess = document.getElementById('auth-success')!;

    this.initEventListeners();
    this.checkAuthState();
  }

  /**
   * Initialize event listeners
   */
  private initEventListeners() {
    // Toggle between login and signup
    document.getElementById('show-signup')?.addEventListener('click', () => {
      this.loginFormContainer.classList.add('hidden');
      this.signupFormContainer.classList.remove('hidden');
      this.clearMessages();
    });

    document.getElementById('show-login')?.addEventListener('click', () => {
      this.signupFormContainer.classList.add('hidden');
      this.loginFormContainer.classList.remove('hidden');
      this.clearMessages();
    });

    // Login form
    document.getElementById('login-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.handleLogin();
    });

    // Signup form
    document.getElementById('signup-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.handleSignup();
    });

    // Logout button
    document.getElementById('btn-logout')?.addEventListener('click', async () => {
      await this.handleLogout();
    });

    // Sync button
    document.getElementById('btn-sync')?.addEventListener('click', async () => {
      await this.handleSync();
    });

    // Import button
    document.getElementById('btn-import')?.addEventListener('click', async () => {
      await this.handleImport();
    });

    // Listen for auth state changes
    authService.onAuthStateChange((state) => {
      this.updateUIForAuthState(state.isAuthenticated, state.user?.email);
    });
  }

  /**
   * Check initial auth state
   */
  private async checkAuthState() {
    try {
      const isAuth = await authService.isAuthenticated();
      const user = await authService.getUser();
      this.updateUIForAuthState(isAuth, user?.email);

      if (isAuth) {
        await this.updateSyncStatus();
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      // Show setup required view if Supabase is not configured
      this.showSetupRequired();
    }
  }

  /**
   * Update UI based on auth state
   */
  private updateUIForAuthState(isAuthenticated: boolean, email?: string | null) {
    if (isAuthenticated && email) {
      this.loggedOutView.classList.add('hidden');
      this.setupRequiredView.classList.add('hidden');
      this.loggedInView.classList.remove('hidden');
      
      const userEmailEl = document.getElementById('user-email');
      if (userEmailEl) {
        userEmailEl.textContent = email;
      }
    } else {
      this.loggedInView.classList.add('hidden');
      this.setupRequiredView.classList.add('hidden');
      this.loggedOutView.classList.remove('hidden');
    }
  }

  /**
   * Show setup required view
   */
  private showSetupRequired() {
    this.loggedOutView.classList.add('hidden');
    this.loggedInView.classList.add('hidden');
    this.setupRequiredView.classList.remove('hidden');
  }

  /**
   * Handle login
   */
  private async handleLogin() {
    const emailInput = document.getElementById('login-email') as HTMLInputElement;
    const passwordInput = document.getElementById('login-password') as HTMLInputElement;

    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!email || !password) {
      this.showError('Please enter email and password');
      return;
    }

    this.clearMessages();
    const submitBtn = document.querySelector('#login-form button[type="submit"]') as HTMLButtonElement;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Signing in...';

    try {
      const { user, error } = await authService.signIn({ email, password });

      if (error) {
        this.showError(error.message || 'Failed to sign in');
      } else if (user) {
        this.showSuccess('Signed in successfully!');
        emailInput.value = '';
        passwordInput.value = '';
        
        // Trigger initial sync
        setTimeout(() => this.handleSync(), 1000);
      }
    } catch (error) {
      this.showError('An unexpected error occurred');
      console.error('Login error:', error);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Sign In';
    }
  }

  /**
   * Handle signup
   */
  private async handleSignup() {
    const emailInput = document.getElementById('signup-email') as HTMLInputElement;
    const passwordInput = document.getElementById('signup-password') as HTMLInputElement;

    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!email || !password) {
      this.showError('Please enter email and password');
      return;
    }

    if (password.length < 6) {
      this.showError('Password must be at least 6 characters');
      return;
    }

    this.clearMessages();
    const submitBtn = document.querySelector('#signup-form button[type="submit"]') as HTMLButtonElement;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Creating account...';

    try {
      const { user, error } = await authService.signUp({ email, password });

      if (error) {
        this.showError(error.message || 'Failed to create account');
      } else if (user) {
        this.showSuccess('Account created! Please check your email to verify your account.');
        emailInput.value = '';
        passwordInput.value = '';
      }
    } catch (error) {
      this.showError('An unexpected error occurred');
      console.error('Signup error:', error);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Create Account';
    }
  }

  /**
   * Handle logout
   */
  private async handleLogout() {
    const { error } = await authService.signOut();

    if (error) {
      this.showError('Failed to sign out');
    } else {
      this.showSuccess('Signed out successfully');
    }
  }

  /**
   * Handle sync
   */
  private async handleSync() {
    const syncBtn = document.getElementById('btn-sync') as HTMLButtonElement;
    syncBtn.disabled = true;
    syncBtn.textContent = 'Syncing...';

    try {
      const { success, error } = await storageService.performFullSync();

      if (error) {
        this.showError(`Sync failed: ${error}`);
      } else if (success) {
        this.showSuccess('Sync completed successfully!');
        await this.updateSyncStatus();
        
        // Reload highlights after sync
        window.dispatchEvent(new CustomEvent('highlights-updated'));
      }
    } catch (error) {
      this.showError('Sync failed');
      console.error('Sync error:', error);
    } finally {
      syncBtn.disabled = false;
      syncBtn.textContent = 'Sync Now';
    }
  }

  /**
   * Handle import from cloud
   */
  private async handleImport() {
    if (!confirm('This will replace all local highlights with data from the cloud. Continue?')) {
      return;
    }

    const importBtn = document.getElementById('btn-import') as HTMLButtonElement;
    importBtn.disabled = true;
    importBtn.textContent = 'Importing...';

    try {
      const { success, error } = await storageService.importFromCloud();

      if (error) {
        this.showError(`Import failed: ${error}`);
      } else if (success) {
        this.showSuccess('Import completed successfully!');
        await this.updateSyncStatus();
        
        // Reload highlights after import
        window.dispatchEvent(new CustomEvent('highlights-updated'));
      }
    } catch (error) {
      this.showError('Import failed');
      console.error('Import error:', error);
    } finally {
      importBtn.disabled = false;
      importBtn.textContent = 'Import from Cloud';
    }
  }

  /**
   * Update sync status display
   */
  private async updateSyncStatus() {
    const syncStatus = await syncService.getSyncStatus();
    const lastSyncEl = document.getElementById('last-sync');
    
    if (lastSyncEl) {
      if (syncStatus.lastSyncAt) {
        const date = new Date(syncStatus.lastSyncAt);
        // Check if date is valid
        if (!isNaN(date.getTime())) {
          lastSyncEl.textContent = date.toLocaleString();
        } else {
          lastSyncEl.textContent = 'Never';
        }
      } else {
        lastSyncEl.textContent = 'Never';
      }
    }
  }

  /**
   * Show error message
   */
  private showError(message: string) {
    this.authError.textContent = message;
    this.authError.classList.remove('hidden');
    this.authSuccess.classList.add('hidden');

    setTimeout(() => {
      this.authError.classList.add('hidden');
    }, 5000);
  }

  /**
   * Show success message
   */
  private showSuccess(message: string) {
    this.authSuccess.textContent = message;
    this.authSuccess.classList.remove('hidden');
    this.authError.classList.add('hidden');

    setTimeout(() => {
      this.authSuccess.classList.add('hidden');
    }, 5000);
  }

  /**
   * Clear all messages
   */
  private clearMessages() {
    this.authError.classList.add('hidden');
    this.authSuccess.classList.add('hidden');
  }
}
