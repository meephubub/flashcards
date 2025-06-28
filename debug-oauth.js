// Debug script to check OAuth redirect URI
// Run this in your browser console to see what redirect URI is being sent

console.log('Current origin:', window.location.origin);
console.log('Expected redirect URI:', `${window.location.origin}/auth/callback`);

// If you want to test the OAuth flow manually, you can also check:
// 1. Open browser dev tools
// 2. Go to Network tab
// 3. Click on OAuth button
// 4. Look for the redirect URL in the network requests 