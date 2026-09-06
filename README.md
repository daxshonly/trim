# TRIM

## Gmail authentication

The Google button uses Google Identity Services and requests read-only Gmail
access. Create a Google OAuth 2.0 Web application client, add your local and
production origins to its authorized JavaScript origins, then create a `.env`
file with:

```text
VITE_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
```

The current dashboard still uses the prototype subscription dataset. Gmail
authentication is live, but receipt parsing and persistence are not connected.