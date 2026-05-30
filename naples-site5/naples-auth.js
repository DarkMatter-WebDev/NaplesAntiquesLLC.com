(function () {
  var client = null;
  var currentSession = null;
  var currentProfile = null;
  var initPromise = null;

  function isConfigured() {
    return Boolean(
      window.NAPLES_SUPABASE &&
      window.NAPLES_SUPABASE.url &&
      window.NAPLES_SUPABASE.anonKey &&
      window.supabase &&
      window.supabase.createClient
    );
  }

  function getClient() {
    if (!isConfigured()) return null;
    if (!client) {
      client = window.supabase.createClient(
        window.NAPLES_SUPABASE.url,
        window.NAPLES_SUPABASE.anonKey
      );
    }
    return client;
  }

  function getAccessToken() {
    return currentSession && currentSession.access_token ? currentSession.access_token : '';
  }

  function setSession(session) {
    currentSession = session || null;
  }

  async function loadProfile() {
    var supabase = getClient();
    if (!supabase || !currentSession) {
      currentProfile = null;
      return null;
    }

    var userId = currentSession.user.id;
    var result = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (result.error) {
      console.warn('Profile load failed:', result.error.message);
      currentProfile = null;
      return null;
    }

    currentProfile = result.data;
    return currentProfile;
  }

  async function ensureProfileRow(userId, fullName) {
    var supabase = getClient();
    if (!supabase || !userId) return;

    var profilePayload = { id: userId };
    if (fullName) {
      profilePayload.full_name = fullName;
    }

    var profileResult = await supabase
      .from('profiles')
      .upsert(profilePayload, { ignoreDuplicates: true });
    if (profileResult.error) {
      console.warn('Profile upsert failed:', profileResult.error.message);
    }

    var cartResult = await supabase
      .from('customer_carts')
      .upsert({ user_id: userId, items: [] }, { ignoreDuplicates: true });
    if (cartResult.error) {
      console.warn('Cart upsert failed:', cartResult.error.message);
    }
  }

  async function init() {
    if (initPromise) return initPromise;

    var supabase = getClient();
    if (!supabase) {
      return { configured: false };
    }

    initPromise = (async function () {
      var sessionResult = await supabase.auth.getSession();
      setSession(sessionResult.data && sessionResult.data.session);
      await loadProfile();

      supabase.auth.onAuthStateChange(async function (_event, session) {
        setSession(session);
        await loadProfile();
        if (window.ShopCart && window.ShopCart.syncFromAccount) {
          window.ShopCart.syncFromAccount();
        }
      });

      return {
        configured: true,
        session: currentSession,
        profile: currentProfile
      };
    })();

    return initPromise;
  }

  async function signUp(email, password, fullName) {
    var supabase = getClient();
    if (!supabase) throw new Error('Account system is not configured yet');

    var redirectTo = window.location.origin + '/account.html';
    var result = await supabase.auth.signUp({
      email: email,
      password: password,
      options: {
        data: { full_name: fullName || '' },
        emailRedirectTo: redirectTo
      }
    });
    if (result.error) throw result.error;
    if (result.data.session && result.data.user) {
      await ensureProfileRow(result.data.user.id, fullName || '');
      setSession(result.data.session);
      await loadProfile();
    }
    return result.data;
  }

  async function signIn(email, password) {
    var supabase = getClient();
    if (!supabase) throw new Error('Account system is not configured yet');

    var result = await supabase.auth.signInWithPassword({ email: email, password: password });
    if (result.error) throw result.error;
    if (result.data.user) {
      var metaName = result.data.user.user_metadata && result.data.user.user_metadata.full_name;
      await ensureProfileRow(result.data.user.id, metaName || '');
    }
    setSession(result.data.session);
    await loadProfile();
    return result.data;
  }

  async function signOut() {
    var supabase = getClient();
    if (!supabase) return;
    await supabase.auth.signOut();
    currentProfile = null;
    setSession(null);
  }

  async function updateProfile(fields) {
    var supabase = getClient();
    if (!supabase || !currentSession) throw new Error('Not signed in');

    var payload = Object.assign({ id: currentSession.user.id }, fields);
    var result = await supabase
      .from('profiles')
      .upsert(payload)
      .select('*')
      .single();

    if (result.error) throw result.error;
    currentProfile = result.data;
    return currentProfile;
  }

  async function listFavorites() {
    var supabase = getClient();
    if (!supabase || !currentSession) return [];

    var result = await supabase
      .from('favorites')
      .select('product_id, created_at')
      .eq('user_id', currentSession.user.id)
      .order('created_at', { ascending: false });

    if (result.error) throw result.error;
    return result.data || [];
  }

  async function isFavorite(productId) {
    var supabase = getClient();
    if (!supabase || !currentSession) return false;

    var result = await supabase
      .from('favorites')
      .select('id')
      .eq('user_id', currentSession.user.id)
      .eq('product_id', productId)
      .maybeSingle();

    return Boolean(result.data);
  }

  async function toggleFavorite(productId) {
    var supabase = getClient();
    if (!supabase || !currentSession) {
      throw new Error('Sign in to save favorites');
    }

    var existing = await isFavorite(productId);
    if (existing) {
      var removed = await supabase
        .from('favorites')
        .delete()
        .eq('user_id', currentSession.user.id)
        .eq('product_id', productId);
      if (removed.error) throw removed.error;
      return false;
    }

    var added = await supabase.from('favorites').insert({
      user_id: currentSession.user.id,
      product_id: productId
    });
    if (added.error) throw added.error;
    return true;
  }

  async function loadCart() {
    var supabase = getClient();
    if (!supabase || !currentSession) return [];

    var result = await supabase
      .from('customer_carts')
      .select('items')
      .eq('user_id', currentSession.user.id)
      .maybeSingle();
    if (result.error) throw result.error;
    return result.data && Array.isArray(result.data.items) ? result.data.items : [];
  }

  async function saveCart(items) {
    var supabase = getClient();
    if (!supabase || !currentSession) return items || [];

    var cleanItems = Array.isArray(items) ? items : [];
    var result = await supabase
      .from('customer_carts')
      .upsert({
        user_id: currentSession.user.id,
        items: cleanItems
      });

    if (result.error) throw result.error;
    return cleanItems;
  }

  window.NaplesAuth = {
    init: init,
    isConfigured: isConfigured,
    getClient: getClient,
    getAccessToken: getAccessToken,
    getSession: function () { return currentSession; },
    getProfile: function () { return currentProfile; },
    isVip: function () {
      return Boolean(currentProfile && (currentProfile.is_vip || currentProfile.is_admin));
    },
    signUp: signUp,
    signIn: signIn,
    signOut: signOut,
    updateProfile: updateProfile,
    listFavorites: listFavorites,
    isFavorite: isFavorite,
    toggleFavorite: toggleFavorite,
    loadCart: loadCart,
    saveCart: saveCart
  };
})();
