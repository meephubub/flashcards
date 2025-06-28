// Debug script to check OAuth redirect URI
// Run this in your browser console to see what redirect URI is being sent

console.log('Current origin:', window.location.origin);
console.log('Expected redirect URI:', `${window.location.origin}/auth/callback`);

// To debug the OAuth flow:
// 1. Open browser dev tools
// 2. Go to Network tab
// 3. Click on OAuth button (Google or GitHub)
// 4. Look for the network request that gets the error
// 5. Check the Request URL to see the exact redirect_uri parameter

// You can also check the Supabase client configuration:
console.log('Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);

// If you want to test the OAuth flow manually, you can also check:
// 1. Open browser dev tools
// 2. Go to Network tab
// 3. Click on OAuth button
// 4. Look for the redirect URL in the network requests
// 5. The redirect_uri parameter should match exactly what you configured in your OAuth provider 