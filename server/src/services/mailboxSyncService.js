import crypto from "crypto";
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import Candidate from "../models/Candidate.js";
import MailboxMessage from "../models/MailboxMessage.js";

function normaliseAddress(value = "") {
  return String(value || "").trim().toLowerCase();
}

function addressList(value) {
  return (value?.value || []).map((item) => ({
    name: String(item.name || "").trim().slice(0, 200),
    address: normaliseAddress(item.address)
  })).filter((item) => item.address);
}

function cleanText(value = "") {
  return String(value || "")
    .replace(/\r/g, "")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim()
    .slice(0, 100000);
}

function cleanSubject(value = "") {
  return String(value || "(No subject)").trim().slice(0, 500) || "(No subject)";
}

function subjectThreadKey(subject = "") {
  const normalised = cleanSubject(subject).replace(/^\s*((re|fw|fwd)\s*:\s*)+/i, "").toLowerCase();
  return crypto.createHash("sha256").update(normalised || "no-subject").digest("hex").slice(0, 32);
}

function retentionDate(value) {
  const date = new Date(value || Date.now());
  date.setFullYear(date.getFullYear() + 2);
  return date;
}

export async function syncMailboxInbox(account, { limit = 30 } = {}) {
  const client = new ImapFlow({
    host: account.imapHost,
    port: account.imapPort || 993,
    secure: account.imapSecure !== false,
    auth: { user: account.user, pass: account.pass },
    logger: false
  });

  const parsedMessages = [];
  await client.connect();
  try {
    const mailbox = await client.mailboxOpen("INBOX", { readOnly: true });
    const exists = Number(mailbox.exists || 0);
    if (!exists) return { mailbox: account.address, synced: 0, linked: 0 };
    const safeLimit = Math.min(Math.max(Number(limit || 30), 1), 50);
    const range = `${Math.max(1, exists - safeLimit + 1)}:*`;

    for await (const item of client.fetch(range, {
      uid: true,
      flags: true,
      envelope: true,
      internalDate: true,
      source: true
    })) {
      const parsed = await simpleParser(item.source, {
        skipHtmlToText: false,
        skipTextToHtml: true
      });
      const from = addressList(parsed.from)[0] || addressList(item.envelope?.from)[0] || { name: "", address: "" };
      const receivedAt = parsed.date || item.internalDate || new Date();
      const text = cleanText(parsed.text || "");
      const subject = cleanSubject(parsed.subject || item.envelope?.subject);
      parsedMessages.push({
        mailbox: account.address,
        mailboxUid: `${account.address}:INBOX:${item.uid}`,
        uid: item.uid,
        messageId: String(parsed.messageId || "").slice(0, 1000),
        threadKey: subjectThreadKey(subject),
        folder: "INBOX",
        direction: "Inbound",
        from,
        to: addressList(parsed.to),
        cc: addressList(parsed.cc),
        replyTo: addressList(parsed.replyTo),
        subject,
        text,
        snippet: text.replace(/\s+/g, " ").slice(0, 280),
        attachmentCount: parsed.attachments?.length || 0,
        attachmentNames: (parsed.attachments || []).map((attachment) => String(attachment.filename || "Attachment").slice(0, 240)).slice(0, 20),
        receivedAt,
        isRead: Boolean(item.flags?.has("\\Seen")),
        syncedAt: new Date(),
        retentionReviewAt: retentionDate(receivedAt)
      });
    }
  } finally {
    await client.logout().catch(() => undefined);
  }

  const senderEmails = [...new Set(parsedMessages.map((item) => item.from.address).filter(Boolean))];
  const candidates = await Candidate.find({ email: { $in: senderEmails } }).select("name email").lean();
  const candidateByEmail = new Map(candidates.map((candidate) => [normaliseAddress(candidate.email), candidate]));

  const operations = parsedMessages.map((message) => {
    const candidate = candidateByEmail.get(message.from.address);
    return {
      updateOne: {
        filter: { mailboxUid: message.mailboxUid },
        update: {
          $set: {
            ...message,
            ...(candidate ? { candidate: candidate._id, candidateName: candidate.name } : {})
          }
        },
        upsert: true
      }
    };
  });
  if (operations.length) await MailboxMessage.bulkWrite(operations, { ordered: false });

  const candidateUpdates = parsedMessages
    .map((message) => ({ message, candidate: candidateByEmail.get(message.from.address) }))
    .filter(({ candidate }) => candidate)
    .reduce((latest, { message, candidate }) => {
      const key = String(candidate._id);
      if (!latest.has(key) || new Date(message.receivedAt) > new Date(latest.get(key).receivedAt)) latest.set(key, { message, candidate });
      return latest;
    }, new Map());
  if (candidateUpdates.size) {
    await Candidate.bulkWrite([...candidateUpdates.values()].map(({ message, candidate }) => ({
      updateOne: { filter: { _id: candidate._id }, update: { $max: { lastCommunicationAt: message.receivedAt } } }
    })));
  }

  return {
    mailbox: account.address,
    synced: parsedMessages.length,
    linked: parsedMessages.filter((message) => candidateByEmail.has(message.from.address)).length
  };
}
