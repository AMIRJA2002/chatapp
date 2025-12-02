import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import './ChatWindow.css';

function ChatWindow() {
  const { chatId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [ws, setWs] = useState(null);
  const [chatInfo, setChatInfo] = useState(null);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchMessages();
    fetchChatInfo();
    connectWebSocket();

    return () => {
      if (ws) {
        ws.close();
      }
    };
  }, [chatId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

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
    const token = localStorage.getItem('token');
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.hostname}:8009/ws/${chatId}`;
    
    const websocket = new WebSocket(wsUrl);
    
    websocket.onopen = () => {
      console.log('WebSocket connected');
    };

    websocket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.id && data.chat_id === chatId) {
          setMessages((prev) => [...prev, data]);
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

    setWs(websocket);
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    try {
      const response = await api.post(`/api/chats/${chatId}/messages`, null, {
        params: {
          content: newMessage,
          message_type: 'text',
        },
      });
      setNewMessage('');
      setMessages((prev) => [...prev, response.data]);
    } catch (error) {
      console.error('Error sending message:', error);
      alert('خطا در ارسال پیام');
    }
  };

  const sendFile = async (file) => {
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await api.post(
        `/api/chats/${chatId}/messages/file`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );
      setMessages((prev) => [...prev, response.data]);
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

  return (
    <div className="chat-window-container">
      <div className="chat-header">
        <button onClick={() => navigate('/chats')} className="back-btn">
          ← بازگشت
        </button>
        <div className="chat-title">{getChatTitle()}</div>
      </div>

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
                  src={`http://localhost:8009${message.file_url}`}
                  alt={message.content}
                  className="message-image"
                />
              )}
              {message.message_type === 'file' && (
                <a
                  href={`http://localhost:8009${message.file_url}`}
                  download
                  className="message-file"
                >
                  📎 {message.content}
                </a>
              )}
              <div className="message-sender">
                {message.sender_id === user?.id ? 'شما' : message.sender_name}
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
        <button type="submit" className="send-btn">
          ارسال
        </button>
      </form>
    </div>
  );
}

export default ChatWindow;

