import { useState } from 'react';
import { api } from '../api/client';

export default function AssistantWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'assistant', text: 'Ask me about team activity — e.g. "What did the team work on last week?" or "Summarize open blockers."' },
  ]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    setMessages((m) => [...m, { role: 'user', text }]);
    setInput('');
    setBusy(true);
    try {
      const d = await api.post('/assistant/chat', { message: text });
      setMessages((m) => [...m, { role: 'assistant', text: d.answer }]);
    } catch (e) {
      setMessages((m) => [...m, { role: 'assistant', text: `Something went wrong: ${e.message}` }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {open && (
        <div className="chat-panel card">
          <h2>Team assistant</h2>
          <div className="chat-log">
            {messages.map((m, i) => (
              <div key={i} className={`chat-msg ${m.role}`}>{m.text}</div>
            ))}
            {busy && <div className="chat-msg assistant">Thinking…</div>}
          </div>
          <div className="chat-input">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && send()}
              placeholder="Ask about team activity"
              aria-label="Message the team assistant"
            />
            <button onClick={send} disabled={busy}>Send</button>
          </div>
        </div>
      )}
      <button className="chat-fab" onClick={() => setOpen((o) => !o)} aria-label="Toggle team assistant">
        {open ? '×' : '✳'}
      </button>
    </>
  );
}
