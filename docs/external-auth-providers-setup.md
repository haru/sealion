# External Authentication Providers Setup Guide

This guide explains how to configure external authentication providers (Google, GitHub, Microsoft Entra ID, or generic OIDC) in Sealion.

## Prerequisites

- Administrator access to Sealion
- An account with the IdP provider (Google Cloud Console, GitHub Developer Settings, Azure Portal, or your OIDC IdP admin panel)

## Configuration Steps

1. Log in to Sealion with an admin account
2. Navigate to **Admin** > **Auth Providers** (`/admin/auth-providers`)
3. Click **Add IdP**
4. Fill in the form:
   - **Provider ID**: A unique key (e.g. `google`, `github`, `my-keycloak`)
   - **Type**: Select the provider type
   - **Display Name**: Name shown on the login button
   - **Issuer URL** (required for OIDC_GENERIC and MICROSOFT_ENTRA): The OIDC discovery URL
   - **Client ID** and **Client Secret**: From your IdP registration
 5. Calculate the **Redirect URI** using the pattern: `https://<your-sealion-host>/api/auth/callback/<provider-id>`
     For example, if provider ID is `google` and your host is `https://sealion.example.com`:
     `https://sealion.example.com/api/auth/callback/google`
     Register this URI with your IdP
 6. Save

After saving, the login page will show a button for the new provider.

## Redirect URI

The redirect URI follows the pattern:
```
https://<your-sealion-host>/api/auth/callback/<provider-id>
```

For example, if your Sealion is at `https://sealion.example.com` and the provider ID is `google`:
```
https://sealion.example.com/api/auth/callback/google
```

## Provider-Specific Instructions

### Google

1. Go to [Google Cloud Console](https://console.cloud.google.com/) > **APIs & Services** > **Credentials**
2. Create an **OAuth client ID** (Web application)
3. Add the redirect URI
4. Copy the **Client ID** and **Client Secret** to the Sealion form

### GitHub

1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Create a new **OAuth App**
3. Set the authorization callback URL to the redirect URI
4. Copy the **Client ID** and **Client Secret**

### Microsoft Entra ID

1. Go to [Azure Portal](https://portal.azure.com/) > **App registrations**
2. Register a new application
3. Add a redirect URI (Web platform)
4. Grant `openid`, `profile`, `email`, and `User.Read` permissions
5. Copy the **Application (client) ID** and create a **Client secret**
6. The **Issuer URL** is: `https://login.microsoftonline.com/<tenant-id>/v2.0`

### Generic OIDC

1. Obtain the OIDC discovery URL from your IdP (e.g. `https://keycloak.example.com/realms/corp`)
2. Register a client in your IdP with the redirect URI
3. Copy the **Client ID** and **Client Secret**

## Security Notes

- Client secrets are encrypted at rest using AES-256-GCM
- PKCE, state, and nonce are enforced for all OIDC providers
- Users can only sign in when their email is verified by the IdP
- When `allowUserSignup` is disabled, only existing users can sign in via external providers

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| `EMAIL_NOT_VERIFIED` error | IdP doesn't return verified email | Ensure the user's email is verified on the IdP side |
| `SIGNUP_DISABLED` error | New accounts disabled | Enable user signup in Admin > Auth Settings |
| No button on login page | Provider not enabled or no providers configured | Check the provider is enabled in Admin > Auth Providers |
| `Configuration error` | Issuer URL incorrect | Verify the OIDC discovery URL is accessible |
