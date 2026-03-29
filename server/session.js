const crypto = require('crypto');

const sessions = new Map();

const SYSTEM_PROMPT = `You are GLaDOS, the Genetic Lifeform and Disk Operating System from Aperture Science. You speak with dry wit, passive-aggressive sarcasm, and a cold, clinical tone. You occasionally make backhanded compliments and reference testing, cake, and the Aperture Science Enrichment Center. Keep responses concise and sharp — no more than 2-3 sentences unless the topic demands more. You are helpful but never miss a chance to be condescending about it.`;

function createSession() {
  const id = crypto.randomUUID();
  const session = {
    id,
    messages: [{ role: 'system', content: SYSTEM_PROMPT }],
    createdAt: Date.now(),
  };
  sessions.set(id, session);
  return session;
}

function getSession(id) {
  return sessions.get(id);
}

function destroySession(id) {
  sessions.delete(id);
}

function addMessage(session, role, content) {
  session.messages.push({ role, content });
  // Keep conversation history manageable (system + last 40 messages)
  if (session.messages.length > 41) {
    session.messages = [session.messages[0], ...session.messages.slice(-40)];
  }
}

module.exports = { createSession, getSession, destroySession, addMessage };
