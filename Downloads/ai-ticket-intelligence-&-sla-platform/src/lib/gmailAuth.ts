import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, type User } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

// Reuse existing app or initialize if not already done
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);

const provider = new GoogleAuthProvider();
// Request the required scopes for reading and sending Gmails
provider.addScope('https://www.googleapis.com/auth/gmail.readonly');
provider.addScope('https://www.googleapis.com/auth/gmail.send');

let isSigningIn = false;
let cachedAccessToken: string | null = null;

// Initialize auth state listener
export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        cachedAccessToken = null;
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

// Sign in with Google Popup and cache access token
export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Could not access secure Google OAuth Token.');
    }
    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (err: any) {
    console.error('[Google OAuth] Error during authentication callback:', err);
    throw err;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const logout = async () => {
  await auth.signOut();
  cachedAccessToken = null;
};

// Helper: Decode base64url content cleanly
function decodeBase64Url(str: string): string {
  try {
    const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = atob(base64);
    // Handle modern unicode characters in decoding
    return decodeURIComponent(escape(decoded));
  } catch (e) {
    try {
      return atob(str.replace(/-/g, '+').replace(/_/g, '/'));
    } catch (err) {
      return '';
    }
  }
}

// Recursively find text/plain or HTML content snippet from mime tree
function extractGmailBody(payload: any): string {
  if (!payload) return '';
  
  if (payload.body && payload.body.data) {
    return decodeBase64Url(payload.body.data);
  }

  if (payload.parts) {
    // Look for text/plain first
    for (const part of payload.parts) {
      if (part.mimeType === 'text/plain' && part.body && part.body.data) {
        return decodeBase64Url(part.body.data);
      }
    }
    // Look for text/html second
    for (const part of payload.parts) {
      if (part.mimeType === 'text/html' && part.body && part.body.data) {
        // Strip basic html tags to make it plain text
        const html = decodeBase64Url(part.body.data);
        return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
      }
    }
    // Deep fallback check
    for (const part of payload.parts) {
      const deep = extractGmailBody(part);
      if (deep) return deep;
    }
  }
  return '';
}

export interface GmailEmail {
  id: string;
  subject: string;
  snippet: string;
  body: string;
  sender: string;
  date: string;
}

// Fetch active inboxes via user token
export const fetchGmailRecentMessages = async (accessToken: string, limit: number = 8): Promise<GmailEmail[]> => {
  try {
    const listRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${limit}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    
    if (!listRes.ok) {
      throw new Error(`Gmail API failure code: ${listRes.status}`);
    }

    const listData = await listRes.json();
    const messages = listData.messages || [];
    const results: GmailEmail[] = [];

    for (const msg of messages) {
      try {
        const detailRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!detailRes.ok) continue;

        const detail = await detailRes.json();
        const headers: any[] = detail.payload?.headers || [];
        
        const subjectHeader = headers.find(h => h.name.toLowerCase() === 'subject');
        const subject = subjectHeader?.value || '(No Subject)';

        const fromHeader = headers.find(h => h.name.toLowerCase() === 'from');
        const sender = fromHeader?.value || 'unknown@sender.com';

        const dateHeader = headers.find(h => h.name.toLowerCase() === 'date');
        const date = dateHeader?.value || new Date().toISOString();

        // Extract body text body with parsing fallback
        let body = extractGmailBody(detail.payload);
        if (!body) {
          body = detail.snippet || 'Incident summary is empty.';
        }

        results.push({
          id: msg.id,
          subject,
          snippet: detail.snippet || '',
          body,
          sender,
          date
        });
      } catch (err) {
        console.error(`[Gmail Service] Could not fetch single email message ${msg.id}:`, err);
      }
    }

    return results;
  } catch (err: any) {
    console.error('[Gmail Service] Error fetching inbox updates:', err);
    throw err;
  }
};

// Encode a string as Base64 url-safe
function encodeBase64UrlUTF8(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export const sendGmailTicketEmail = async (
  accessToken: string,
  toEmail: string,
  subject: string,
  body: string
): Promise<{ id: string }> => {
  try {
    const emailLines = [
      `To: ${toEmail}`,
      `Subject: =?utf-8?B?${btoa(encodeURIComponent(subject).replace(/%([0-9A-F]{2})/g, (_, p1) => String.fromCharCode(parseInt(p1, 16))))}?=`,
      'Content-Type: text/plain; charset="utf-8"',
      'MIME-Version: 1.0',
      '',
      body
    ];
    const emailContent = emailLines.join('\r\n');
    const base64SafeMessage = encodeBase64UrlUTF8(emailContent);

    const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        raw: base64SafeMessage
      })
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Gmail API send fail: ${errText}`);
    }

    return await res.json();
  } catch (err: any) {
    console.error('[Gmail Service] Error sending mail:', err);
    throw err;
  }
};

