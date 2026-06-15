import { ImapFlow } from 'imapflow';

export interface FetchedEmail {
  subject: string;
  body: string;
  sender: string;
  source: 'gmail' | 'outlook';
  date: string;
}

export async function fetchLiveEmails(config: {
  imap_host: string;
  imap_port: number;
  imap_user: string;
  imap_pass: string;
  use_ssl: boolean;
}): Promise<FetchedEmail[]> {
  const client = new ImapFlow({
    host: config.imap_host,
    port: Number(config.imap_port),
    secure: !!config.use_ssl,
    auth: {
      user: config.imap_user,
      pass: config.imap_pass
    },
    logger: false,
    clientInfo: {
      name: 'System-AutoSync'
    }
  });

  await client.connect();

  const emails: FetchedEmail[] = [];
  let lock = await client.getMailboxLock('INBOX');
  
  try {
    // Collect count of messages to fetch last 10 messages max
    const status = await client.status('INBOX', { messages: true });
    const totalMessages = status.messages || 0;
    
    if (totalMessages > 0) {
      // Fetch details of last 10 received messages to prevent overload
      const startSeq = Math.max(1, totalMessages - 9);
      const range = `${startSeq}:${totalMessages}`;

      for await (let msg of client.fetch(range, { envelope: true, source: true })) {
        try {
          const senderObj = msg.envelope.from?.[0];
          const senderAddress = senderObj?.address || 'unknown@sender.com';
          const subject = msg.envelope.subject || '(No Subject)';
          const date = msg.envelope.date ? msg.envelope.date.toISOString() : new Date().toISOString();
          
          // Extract message body from download buffer
          let bodyText = '(Empty body)';
          if (msg.source) {
            const rawMime = msg.source.toString('utf-8');
            bodyText = extractPlainBody(rawMime, subject);
          }

          const source = config.imap_host.toLowerCase().includes('outlook') ? 'outlook' : 'gmail';
          
          emails.push({
            subject,
            body: bodyText,
            sender: senderAddress,
            source,
            date
          });
        } catch (msgErr) {
          console.error('[IMAP Flow] Error reading individual message:', msgErr);
        }
      }
    }
  } finally {
    lock.release();
  }

  await client.logout();
  return emails;
}

// Simple mime extractor to isolate body contents cleanly
function extractPlainBody(rawMime: string, subject: string): string {
  try {
    if (!rawMime.includes('Content-Type: multipart')) {
      const idx = rawMime.indexOf('\r\n\r\n');
      if (idx !== -1) {
        return rawMime.substring(idx + 4).trim();
      }
      return rawMime.trim().substring(0, 1000);
    }
    
    const plainParts = rawMime.split('Content-Type: text/plain');
    if (plainParts.length > 1) {
      const subBlock = plainParts[1];
      const nextMimeHeader = subBlock.indexOf('Content-Type:');
      const textBlock = nextMimeHeader !== -1 ? subBlock.substring(0, nextMimeHeader) : subBlock;
       
      const idx = textBlock.indexOf('\r\n\r\n');
      const body = idx !== -1 ? textBlock.substring(idx + 4) : textBlock;
      
      const cleanBody = body.split('--')[0].trim();
      return cleanBody || `Please see main ticket body associated with subject: ${subject}`;
    }
    
    return `Incident report received with subject: ${subject}.`;
  } catch (err) {
    return rawMime.substring(0, 1000);
  }
}
