import { useState, useRef, useEffect, useCallback } from 'react'

const API_BASE = 'http://localhost:5050'  // Vite dev proxy forwards /upload and /ask to localhost:5050

// ——— ICONS ———
const SendIcon = () => (
  <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
  </svg>
)

const formatTime = (date) =>
  date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

// ——— TYPING INDICATOR ———
const TypingIndicator = () => (
  <div className="message-row ai">
    <div className="message-avatar">🤖</div>
    <div className="message-content">
      <div className="message-bubble">
        <div className="typing-indicator">
          <div className="typing-dot" />
          <div className="typing-dot" />
          <div className="typing-dot" />
        </div>
      </div>
    </div>
  </div>
)

// ——— MESSAGE BUBBLE ———
const MessageBubble = ({ message }) => (
  <div className={`message-row ${message.role}`}>
    <div className="message-avatar">
      {message.role === 'ai' ? '🤖' : '👤'}
    </div>
    <div className="message-content">
      <div className="message-bubble">{message.text}</div>
      <span className="message-time">{formatTime(message.timestamp)}</span>
    </div>
  </div>
)

// ——— UPLOAD ZONE ———
const UploadZone = ({ onUpload, isUploading, uploadProgress }) => {
  const [dragging, setDragging] = useState(false)
  const fileInputRef = useRef(null)

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file && (file.name.endsWith('.csv') || file.type === 'text/csv')) {
      onUpload(file)
    }
  }, [onUpload])

  const handleDragOver = (e) => { e.preventDefault(); setDragging(true) }
  const handleDragLeave = () => setDragging(false)
  const handleFileChange = (e) => {
    const file = e.target.files[0]
    if (file) onUpload(file)
  }

  const SUGGESTIONS = [
    { icon: '📊', label: 'What are the column names in this dataset?' },
    { icon: '🔍', label: 'Show me the top 5 entries by value' },
    { icon: '📈', label: 'What is the average of the numeric columns?' },
  ]

  return (
    <div className="upload-screen">
      <div className="upload-container">
        <div className="upload-hero">
          <h1>Chat with your CSV</h1>
          <p>Upload any CSV file and start asking questions in plain English — powered by local AI.</p>
        </div>

        <div
          className={`upload-dropzone ${dragging ? 'dragging' : ''}`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
          id="csv-dropzone"
        >
          <div className="upload-icon-wrapper">
            <div className="upload-icon-bg">📂</div>
            <span className="upload-sparkle">✨</span>
            <span className="upload-sparkle">⚡</span>
            <span className="upload-sparkle">🌟</span>
          </div>
          <div className="upload-text-main">
            {dragging ? 'Drop your CSV here!' : 'Drag & drop your CSV file'}
          </div>
          <div className="upload-or">— or —</div>
          <button className="upload-browse-btn" onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click() }}>
            📁 Browse Files
          </button>
          <div className="upload-formats">
            <span className="format-chip">.csv</span>
            <span className="format-chip">UTF-8</span>
            <span className="format-chip">Latin-1</span>
            <span className="format-chip">Up to 50MB</span>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            style={{ display: 'none' }}
            onChange={handleFileChange}
            id="csv-file-input"
          />
        </div>

        <div className="upload-features">
          <div className="feature-card">
            <div className="feature-icon">🧠</div>
            <div className="feature-title">AI Powered</div>
            <div className="feature-desc">Local Ollama model answers your questions</div>
          </div>
          <div className="feature-card">
            <div className="feature-icon">⚡</div>
            <div className="feature-title">Instant Search</div>
            <div className="feature-desc">FAISS vector search finds relevant rows fast</div>
          </div>
          <div className="feature-card">
            <div className="feature-icon">🔒</div>
            <div className="feature-title">100% Private</div>
            <div className="feature-desc">All processing happens on your machine</div>
          </div>
        </div>

        <div className="suggestion-chips">
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>
            💡 Sample questions you can ask:
          </div>
          {SUGGESTIONS.map((s, i) => (
            <div key={i} className="suggestion-chip" style={{ cursor: 'default' }}>
              <span>{s.icon}</span>
              <span>{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      {isUploading && (
        <div className="upload-progress-overlay">
          <div className="upload-progress-card">
            <div className="progress-spinner" />
            <div className="progress-card-title">Processing your CSV…</div>
            <div className="progress-card-sub">Creating embeddings with AI</div>
            <div className="progress-bar-track">
              <div className="progress-bar-fill" style={{ width: `${uploadProgress}%` }} />
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{uploadProgress}%</div>
          </div>
        </div>
      )}
    </div>
  )
}

// ——— CHAT WINDOW ———
const ChatWindow = ({ messages, isLoading, onSuggestion }) => {
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  const SUGGESTIONS = [
    { icon: '📋', text: 'What columns does this dataset have?' },
    { icon: '🔢', text: 'How many rows are in this file?' },
    { icon: '📊', text: 'Summarize the data for me' },
    { icon: '🔍', text: 'What are the unique values in the first column?' },
  ]

  if (messages.length === 0) {
    return (
      <div className="chat-messages">
        <div className="chat-welcome">
          <div className="chat-welcome-icon">💬</div>
          <h3>CSV loaded! Ask me anything.</h3>
          <p>I'll search through your data and give you intelligent answers.</p>
          <div className="suggestion-chips">
            {SUGGESTIONS.map((s, i) => (
              <button key={i} className="suggestion-chip" onClick={() => onSuggestion(s.text)}>
                <span>{s.icon}</span>
                <span>{s.text}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="chat-messages">
      {messages.map((msg) => (
        <MessageBubble key={msg.id} message={msg} />
      ))}
      {isLoading && <TypingIndicator />}
      <div ref={bottomRef} />
    </div>
  )
}

// ——— CHAT INPUT ———
const ChatInput = ({ onSend, disabled }) => {
  const [value, setValue] = useState('')
  const textareaRef = useRef(null)

  const handleSend = () => {
    const trimmed = value.trim()
    if (!trimmed || disabled) return
    onSend(trimmed)
    setValue('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleInput = (e) => {
    setValue(e.target.value)
    const ta = textareaRef.current
    if (ta) {
      ta.style.height = 'auto'
      ta.style.height = Math.min(ta.scrollHeight, 140) + 'px'
    }
  }

  return (
    <div className="chat-input-area">
      <div className="chat-input-wrapper">
        <textarea
          ref={textareaRef}
          className="chat-textarea"
          placeholder="Ask anything about your CSV…"
          value={value}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          rows={1}
          id="chat-question-input"
        />
        <button
          className="chat-send-btn"
          onClick={handleSend}
          disabled={disabled || !value.trim()}
          id="chat-send-btn"
          title="Send (Enter)"
        >
          <SendIcon />
        </button>
      </div>
      <div className="chat-input-footer">
        <span className="chat-disclaimer">⏎ Send · Shift+⏎ New line · Powered by local AI</span>
      </div>
    </div>
  )
}

// ——— SIDEBAR ———
const Sidebar = ({ fileName, onNewChat, chatHistory }) => (
  <div className="sidebar">
    <div className="sidebar-logo">
      <div className="logo-icon">📊</div>
      <span className="logo-text">CSV Chat</span>
    </div>

    <button className="sidebar-new-chat" onClick={onNewChat} id="new-chat-btn">
      <div className="plus-icon">＋</div>
      New Chat
    </button>

    {chatHistory.length > 0 && (
      <>
        <div className="sidebar-label">Recent</div>
        {chatHistory.map((item, i) => (
          <div key={i} className={`sidebar-history-item ${i === 0 ? 'active' : ''}`}>
            <span className="sidebar-history-icon">💬</span>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{item}</span>
          </div>
        ))}
      </>
    )}

    <div className="sidebar-footer">
      <div className="sidebar-footer-item">
        <span>⚙️</span> Settings
      </div>
      <div className="sidebar-footer-item">
        <span>❓</span> Help
      </div>
      <div className="sidebar-footer-item" style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
        Backend: localhost:5050
      </div>
    </div>
  </div>
)

// ——— APP ———
export default function App() {
  const [phase, setPhase] = useState('upload') // 'upload' | 'chat'
  const [fileName, setFileName] = useState('')
  const [messages, setMessages] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [error, setError] = useState(null)
  const [chatHistory, setChatHistory] = useState([])

  const showError = (msg) => {
    setError(msg)
    setTimeout(() => setError(null), 4000)
  }

  const handleUpload = async (file) => {
    setIsUploading(true)
    setUploadProgress(0)

    // Animate progress bar
    const interval = setInterval(() => {
      setUploadProgress((p) => {
        if (p >= 85) { clearInterval(interval); return p }
        return p + Math.random() * 12
      })
    }, 300)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch(`${API_BASE}/upload/`, {
        method: 'POST',
        body: formData,
      })

      clearInterval(interval)

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.detail || `Upload failed (${res.status})`)
      }

      setUploadProgress(100)
      await new Promise((r) => setTimeout(r, 600))

      setFileName(file.name)
      setMessages([])
      setPhase('chat')
      setChatHistory((h) => [file.name, ...h.slice(0, 9)])
    } catch (e) {
      clearInterval(interval)
      showError(`Upload error: ${e.message}`)
    } finally {
      setIsUploading(false)
      setUploadProgress(0)
    }
  }

  const handleSend = async (question) => {
    const userMsg = {
      id: Date.now(),
      role: 'user',
      text: question,
      timestamp: new Date(),
    }
    setMessages((m) => [...m, userMsg])
    setIsLoading(true)

    try {
      const res = await fetch(`${API_BASE}/ask/?q=${encodeURIComponent(question)}`)
      if (!res.ok) throw new Error(`Server error (${res.status})`)
      let data
      try {
        data = await res.json()
      } catch {
        data = await res.text()
      }

      const aiMsg = {
        id: Date.now() + 1,
        role: 'ai',
        text: typeof data === "string" ? data : data.answer || JSON.stringify(data),
        timestamp: new Date(),
      }
      setMessages((m) => [...m, aiMsg])
    } catch (e) {
      const errMsg = {
        id: Date.now() + 1,
        role: 'ai',
        text: `⚠️ Could not get answer: ${e.message}`,
        timestamp: new Date(),
      }
      setMessages((m) => [...m, errMsg])
    } finally {
      setIsLoading(false)
    }
  }

  const handleNewChat = () => {
    setPhase('upload')
    setFileName('')
    setMessages([])
  }

  return (
    <div className="app-layout">
      <Sidebar
        fileName={fileName}
        onNewChat={handleNewChat}
        chatHistory={chatHistory}
      />

      <div className="main-area">
        {/* Top bar */}
        <div className="top-bar">
          <div className="top-bar-title">
            {phase === 'chat' && fileName ? (
              <>
                <span>💬 Chatting with</span>
                <div className="file-badge">
                  <div className="file-badge-dot" />
                  {fileName}
                </div>
              </>
            ) : (
              <span>📊 CSV Chat — AI Data Assistant</span>
            )}
          </div>
          <div className="top-bar-actions">
            {phase === 'chat' && (
              <button className="icon-btn" onClick={handleNewChat} title="Upload new CSV" id="upload-new-btn">
                ↑
              </button>
            )}
            <button className="icon-btn" title="Settings">⚙</button>
          </div>
        </div>

        {/* Main content */}
        {phase === 'upload' ? (
          <UploadZone
            onUpload={handleUpload}
            isUploading={isUploading}
            uploadProgress={Math.min(Math.round(uploadProgress), 100)}
          />
        ) : (
          <div className="chat-screen">
            <ChatWindow
              messages={messages}
              isLoading={isLoading}
              onSuggestion={handleSend}
            />
            <ChatInput onSend={handleSend} disabled={isLoading} />
          </div>
        )}
      </div>

      {error && <div className="error-toast">⚠️ {error}</div>}
    </div>
  )
}
