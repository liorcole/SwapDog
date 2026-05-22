import Superwall from 'expo-superwall';

const SUPERWALL_API_KEY = 'sk_1bc10d28b1d03f80267cc985803abce2761e75d8d0f67209ea772922544c2685';

let isConfigured = false;

/**
 * Initialize Superwall SDK — call once at app startup.
 */
export const configureSuperwall = () => {
  if (isConfigured) return;
  try {
    Superwall.configure(SUPERWALL_API_KEY);
    isConfigured = true;
    console.log('[Superwall] Configured');
  } catch (e) {
    console.error('[Superwall] Configuration failed:', e);
  }
};

/**
 * Identify the user after sign-in so Superwall can track them.
 */
export const identifySuperwallUser = (userId: string) => {
  try {
    Superwall.identify(userId);
    console.log('[Superwall] Identified user:', userId);
  } catch (e) {
    console.error('[Superwall] Identify failed:', e);
  }
};

/**
 * Reset Superwall on sign-out.
 */
export const resetSuperwall = () => {
  try {
    Superwall.reset();
    console.log('[Superwall] Reset');
  } catch (e) {
    console.error('[Superwall] Reset failed:', e);
  }
};

/**
 * Present the paywall for a given trigger/placement.
 * Triggers are configured in the Superwall dashboard.
 * Returns true if the user subscribed, false otherwise.
 */
export const presentPaywall = async (placement: string = 'campaign_trigger'): Promise<boolean> => {
  try {
    const result = await Superwall.register(placement);
    console.log('[Superwall] Paywall result:', result);
    // After presenting, check subscription status
    const status = await getSubscriptionStatus();
    return status === 'active';
  } catch (e) {
    console.error('[Superwall] Paywall presentation failed:', e);
    return false;
  }
};

/**
 * Check current subscription status.
 */
export const getSubscriptionStatus = async (): Promise<'active' | 'inactive'> => {
  try {
    const status = await Superwall.getSubscriptionStatus();
    return status === 'ACTIVE' ? 'active' : 'inactive';
  } catch (e) {
    console.error('[Superwall] Status check failed:', e);
    return 'inactive';
  }
};

export default {
  configure: configureSuperwall,
  identify: identifySuperwallUser,
  reset: resetSuperwall,
  presentPaywall,
  getSubscriptionStatus,
};
