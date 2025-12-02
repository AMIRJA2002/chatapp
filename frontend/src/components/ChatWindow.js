import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import api from '../services/api';
import { getBackendUrl } from '../utils/config';
import './ChatWindow.css';

function ChatWindow({ chatId: propChatId }) {
  const { chatId: paramChatId } = useParams();
  const chatId = propChatId || paramChatId;
  const { user } = useAuth();
  const { darkMode } = useTheme();
  const navigate = useNavigate();
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [ws, setWs] = useState(null);
  const [chatInfo, setChatInfo] = useState(null);
  const [chatBackground, setChatBackground] = useState(null);
  const [showBackgroundMenu, setShowBackgroundMenu] = useState(false);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const backgroundInputRef = useRef(null);

  useEffect(() => {
    if (!chatId) return;
    
    // Load chat background from localStorage
    const saved = localStorage.getItem(`chat_bg_${chatId}`);
    setChatBackground(saved || null);
    
    fetchMessages();
    fetchChatInfo();
    
    // Connect WebSocket
    const websocket = connectWebSocket();
    setWs(websocket);

    return () => {
      if (websocket) {
        websocket.close();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (chatBackground && chatId) {
      localStorage.setItem(`chat_bg_${chatId}`, chatBackground);
    }
  }, [chatBackground, chatId]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchMessages = async () => {
    try {
      const response = await api.get(`/api/chats/${chatId}/messages`);
      setMessages(response.data);
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  };

  const fetchChatInfo = async () => {
    try {
      const response = await api.get('/api/chats');
      const chat = response.data.find((c) => c.id === chatId);
      setChatInfo(chat);
    } catch (error) {
      console.error('Error fetching chat info:', error);
    }
  };

  const connectWebSocket = () => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const backendUrl = getBackendUrl();
    
    const wsUrl = backendUrl 
      ? `${protocol}//${backendUrl.replace('http://', '').replace('https://', '')}/ws/${chatId}`
      : `${protocol}//${window.location.host}/ws/${chatId}`;
    
    const websocket = new WebSocket(wsUrl);
    
    websocket.onopen = () => {
      console.log('WebSocket connected');
    };

    websocket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.id && data.chat_id === chatId) {
          setMessages((prev) => {
            // Check if message already exists to prevent duplicates
            const exists = prev.some(msg => msg.id === data.id);
            if (exists) return prev;
            return [...prev, data];
          });
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    websocket.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    websocket.onclose = () => {
      console.log('WebSocket disconnected');
    };

    return websocket;
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    try {
      await api.post(`/api/chats/${chatId}/messages`, null, {
        params: {
          content: newMessage,
          message_type: 'text',
        },
      });
      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
      alert('خطا در ارسال پیام');
    }
  };

  const sendFile = async (file) => {
    const formData = new FormData();
    formData.append('file', file);

    try {
      await api.post(
        `/api/chats/${chatId}/messages/file`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );
    } catch (error) {
      console.error('Error sending file:', error);
      alert('خطا در ارسال فایل');
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      sendFile(file);
    }
  };

  const handleBackgroundSelect = (e) => {
    const file = e.target.files[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setChatBackground(event.target.result);
        setShowBackgroundMenu(false);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeBackground = () => {
    setChatBackground(null);
    localStorage.removeItem(`chat_bg_${chatId}`);
    setShowBackgroundMenu(false);
  };

  const formatTime = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  const getChatTitle = () => {
    if (!chatInfo) return 'چت';
    if (chatInfo.chat_type === 'group') {
      return chatInfo.group_name;
    }
    if (chatInfo.participants && chatInfo.participants.length > 0) {
      return chatInfo.participants[0].full_name || chatInfo.participants[0].username;
    }
    return 'چت';
  };

  const getChatAvatar = () => {
    if (!chatInfo) return null;
    if (chatInfo.chat_type === 'group' && chatInfo.group_image) {
      return chatInfo.group_image;
    }
    if (chatInfo.participants && chatInfo.participants.length > 0) {
      return chatInfo.participants[0].profile_image;
    }
    return null;
  };

  return (
    <div 
      className={`chat-window-container ${chatBackground ? 'has-custom-bg' : ''}`}
      style={chatBackground ? { backgroundImage: `url(${chatBackground})` } : {}}
    >
      {chatBackground && <div className="chat-background-overlay" style={{ backgroundImage: `url(${chatBackground})` }} />}
      
      <div className="chat-header">
        {getChatAvatar() && (
          <img 
            src={`${getBackendUrl()}${getChatAvatar()}`} 
            alt="Avatar" 
            className="chat-header-avatar"
          />
        )}
        <div className="chat-title">{getChatTitle()}</div>
        <div className="chat-header-actions">
          <button 
            className="header-btn"
            onClick={() => setShowBackgroundMenu(!showBackgroundMenu)}
            title="تنظیمات پس‌زمینه"
          >
            🎨
          </button>
        </div>
      </div>

      {showBackgroundMenu && (
        <div className="background-menu">
          <input
            ref={backgroundInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleBackgroundSelect}
          />
          <button onClick={() => backgroundInputRef.current?.click()}>
            انتخاب تصویر
          </button>
          {chatBackground && (
            <button onClick={removeBackground}>
              حذف پس‌زمینه
            </button>
          )}
          <button onClick={() => setShowBackgroundMenu(false)}>
            بستن
          </button>
        </div>
      )}

      <div className="messages-container">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`message ${
              message.sender_id === user?.id ? 'message-sent' : 'message-received'
            }`}
          >
            <div className="message-content">
              {message.message_type === 'text' && (
                <div className="message-text">{message.content}</div>
              )}
              {message.message_type === 'image' && (
                <img
                  src={`${getBackendUrl()}${message.file_url}`}
                  alt={message.content}
                  className="message-image"
                />
              )}
              {message.message_type === 'file' && (
                <a
                  href={`${getBackendUrl()}${message.file_url}`}
                  download
                  className="message-file"
                >
                  📎 {message.content}
                </a>
              )}
              <div className="message-footer">
                {message.sender_id !== user?.id && (
                  <div className="message-sender">
                    {message.sender_name}
                  </div>
                )}
                <div className="message-time">
                  {formatTime(message.created_at)}
                </div>
              </div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={sendMessage} className="message-input-container">
        <input
          ref={fileInputRef}
          type="file"
          style={{ display: 'none' }}
          onChange={handleFileSelect}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="file-btn"
          title="ارسال فایل"
        >
          📎
        </button>
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="پیام خود را بنویسید..."
          className="message-input"
        />
        <button 
          type="submit" 
          className="send-btn"
          disabled={!newMessage.trim()}
          title="ارسال"
        >
          ➤
        </button>
      </form>
    </div>
  );
}

export default ChatWindow;
