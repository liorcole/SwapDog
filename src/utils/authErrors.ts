export function getFriendlyAuthError(error: unknown): { title: string; message: string } {
  const code = (error as { code?: string })?.code ?? '';
  switch (code) {
    case 'auth/email-already-in-use':
      return {
        title: 'Email Already Registered',
        message: 'This email is already in use. Try signing in instead!',
      };
    case 'auth/invalid-email':
      return {
        title: 'Invalid Email',
        message: 'Please enter a valid email address.',
      };
    case 'auth/weak-password':
      return {
        title: 'Weak Password',
        message: 'Password is too weak. Please use at least 6 characters.',
      };
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return {
        title: 'Incorrect Password',
        message: 'The password you entered is incorrect. Please try again.',
      };
    case 'auth/user-not-found':
      return {
        title: 'Account Not Found',
        message: 'No account found with this email. Try signing up!',
      };
    case 'auth/too-many-requests':
      return {
        title: 'Too Many Attempts',
        message: 'Too many attempts. Please wait a moment and try again.',
      };
    case 'auth/network-request-failed':
      return {
        title: 'Network Error',
        message: 'Please check your internet connection and try again.',
      };
    case 'auth/user-disabled':
      return {
        title: 'Account Disabled',
        message: 'This account has been disabled. Please contact support.',
      };
    default:
      return {
        title: 'Oops!',
        message: 'Something went wrong. Please try again.',
      };
  }
}
