const crypto = require('crypto');

const sessions = new Map();

function createSession() {
  const id = crypto.randomUUID();
  const session = {
    id,
    messages: [],
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
  // Keep conversation history manageable (last 40 messages)
  if (session.messages.length > 40) {
    session.messages = session.messages.slice(-40);
  }
}

module.exports = { createSession, getSession, destroySession, addMessage };
