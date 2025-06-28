# OAuth Setup for Flashcards App

This guide explains how to set up Google and GitHub OAuth providers in Supabase for the flashcards application.

## Prerequisites

1. A Supabase project
2. Google Cloud Console access (for Google OAuth)
3. GitHub Developer Settings access (for GitHub OAuth)

## Google OAuth Setup

### 1. Google Cloud Console Setup

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Google+ API:
   - Go to "APIs & Services" > "Library"
   - Search for "Google+ API" and enable it
4. Create OAuth 2.0 credentials:
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "OAuth 2.0 Client IDs"
   - Choose "Web application"
   - Add authorized redirect URIs:
     - `https://your-project-ref.supabase.co/auth/v1/callback`
     - `http://localhost:3000/auth/callback` (for development)
5. Note down the Client ID and Client Secret

### 2. Supabase Configuration

1. Go to your Supabase project dashboard
2. Navigate to "Authentication" > "Providers"
3. Find "Google" and click "Edit"
4. Enable Google provider
5. Enter your Google Client ID and Client Secret
6. Save the configuration

## GitHub OAuth Setup

### 1. GitHub Developer Settings

1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Click "New OAuth App"
3. Fill in the application details:
   - **Application name**: Flashcards App
   - **Homepage URL**: `https://your-domain.com` (or `http://localhost:3000` for development)
   - **Authorization callback URL**: `https://your-project-ref.supabase.co/auth/v1/callback`
4. Click "Register application"
5. Note down the Client ID and Client Secret

### 2. Supabase Configuration

1. Go to your Supabase project dashboard
2. Navigate to "Authentication" > "Providers"
3. Find "GitHub" and click "Edit"
4. Enable GitHub provider
5. Enter your GitHub Client ID and Client Secret
6. Save the configuration

## Environment Variables

Make sure your environment variables are properly set:

```env
NEXT_PUBLIC_SUPABASE_URL=your-supabase-project-url
NEXT_PUBLIC_SUPABASE_PUB_API=your-supabase-anon-key
```

## Testing

1. Start your development server: `npm run dev`
2. Go to `/login` or `/signup`
3. Click on "Continue with Google" or "Continue with GitHub"
4. You should be redirected to the respective OAuth provider
5. After authentication, you should be redirected back to your app

## Troubleshooting

### Common Issues

1. **Redirect URI mismatch**: Ensure the redirect URI in your OAuth provider settings matches exactly with Supabase's callback URL
2. **CORS issues**: Make sure your domain is properly configured in both OAuth providers
3. **Environment variables**: Verify that all environment variables are correctly set

### Debug Steps

1. Check the browser console for any errors
2. Verify Supabase logs in the dashboard
3. Ensure OAuth providers are enabled in Supabase
4. Check that redirect URIs are correctly configured

## Security Notes

- Never commit your OAuth secrets to version control
- Use environment variables for all sensitive configuration
- Regularly rotate your OAuth secrets
- Monitor your OAuth usage and set up proper rate limiting if needed 