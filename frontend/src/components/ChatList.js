import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import api from '../services/api';
import { getBackendUrl } from '../utils/config';
import ChatWindow from './ChatWindow';
import './ChatList.css';

function ChatList() {
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNewChat, setShowNewChat] = useState(false);
  const [email, setEmail] = useState('');
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupEmails, setGroupEmails] = useState(['']);
  const [showSettings, setShowSettings] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [selectedChatId, setSelectedChatId] = useState(null);
  const { user, logout } = useAuth();
  const { darkMode, toggleDarkMode } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    fetchChats();
    // Extract chatId from URL if exists
    const chatMatch = location.pathname.match(/\/chat\/(.+)/);
    if (chatMatch) {
      setSelectedChatId(chatMatch[1]);
    }
  }, [location]);

  const fetchChats = async () => {
    try {
      const response = await api.get('/api/chats');
      setChats(response.data);
    } catch (error) {
      console.error('Error fetching chats:', error);
    } finally {
      setLoading(false);
    }
  };

  const createSingleChat = async (e) => {
    e.preventDefault();
    try {
      const response = await api.post('/api/chats/single', null, {
        params: { email },
      });
      setEmail('');
      setShowNewChat(false);
      setSelectedChatId(response.data.chat_id);
      navigate(`/chat/${response.data.chat_id}`);
    } catch (error) {
      alert(error.response?.data?.detail || 'خطا در ایجاد چت');
    }
  };

  const createGroup = async (e) => {
    e.preventDefault();
    const emails = groupEmails.filter((e) => e.trim());
    try {
      const response = await api.post('/api/chats/group', {
        name: groupName,
        participant_emails: emails,
      });
      setGroupName('');
      setGroupEmails(['']);
      setShowNewGroup(false);
      setSelectedChatId(response.data.chat_id);
      navigate(`/chat/${response.data.chat_id}`);
    } catch (error) {
      alert(error.response?.data?.detail || 'خطا در ایجاد گروه');
    }
  };

  const addEmailField = () => {
    setGroupEmails([...groupEmails, '']);
  };

  const updateEmail = (index, value) => {
    const newEmails = [...groupEmails];
    newEmails[index] = value;
    setGroupEmails(newEmails);
  };

  const handleChatSelect = (chatId) => {
    setSelectedChatId(chatId);
    navigate(`/chat/${chatId}`);
  };

  const getChatName = (chat) => {
    if (chat.chat_type === 'group') {
      return chat.group_name;
    }
    if (chat.participants && chat.participants.length > 0) {
      return chat.participants[0].full_name || chat.participants[0].username;
    }
    return 'چت';
  };

  const getChatImage = (chat) => {
    if (chat.chat_type === 'group' && chat.group_image) {
      return chat.group_image;
    }
    if (chat.participants && chat.participants.length > 0) {
      return chat.participants[0].profile_image;
    }
    return null;
  };

  return (
    <div className="telegram-container">
      {/* Sidebar */}
      <div className="telegram-sidebar">
        {/* User Header */}
        <div className="sidebar-user-header">
          <div className="user-profile-section">
            <div className="user-avatar-large">
              {user?.profile_image ? (
                <img src={`${getBackendUrl()}${user.profile_image}`} alt="Profile" />
              ) : (
                <span>{user?.username?.charAt(0).toUpperCase()}</span>
              )}
            </div>
            <div className="user-name-large">{user?.full_name || user?.username}</div>
            <button className="set-emoji-status">Set Emoji Status</button>
          </div>
        </div>

        {/* Menu Items */}
        <div className="sidebar-menu">
          <div className="menu-item" onClick={() => setShowNewGroup(true)}>
            <span className="menu-icon">👥</span>
            <span className="menu-text">New Group</span>
          </div>
          <div className="menu-item" onClick={() => setShowNewChat(true)}>
            <span className="menu-icon">💬</span>
            <span className="menu-text">New Chat</span>
          </div>
          <div className="menu-item" onClick={() => navigate('/profile')}>
            <span className="menu-icon">👤</span>
            <span className="menu-text">My Profile</span>
          </div>
          <div className="menu-item">
            <span className="menu-icon">📞</span>
            <span className="menu-text">Calls</span>
          </div>
          <div className="menu-item">
            <span className="menu-icon">💾</span>
            <span className="menu-text">Saved Messages</span>
          </div>
          <div className="menu-item" onClick={() => setShowSettings(true)}>
            <span className="menu-icon">⚙️</span>
            <span className="menu-text">Settings</span>
          </div>
          <div className="menu-item night-mode-item">
            <span className="menu-icon">🌙</span>
            <span className="menu-text">Night Mode</span>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={darkMode}
                onChange={toggleDarkMode}
              />
              <span className="toggle-slider"></span>
            </label>
          </div>
        </div>

        {/* Search Bar */}
        <div className="sidebar-search">
          <input
            type="text"
            placeholder="Search"
            className="search-input"
          />
          <span className="search-icon">🔍</span>
        </div>

        {/* Chats List */}
        <div className="chats-list">
          {loading ? (
            <div className="loading">در حال بارگذاری...</div>
          ) : chats.length === 0 ? (
            <div className="empty-state">چتی وجود ندارد</div>
          ) : (
            chats.map((chat) => (
              <div
                key={chat.id}
                className={`chat-item ${selectedChatId === chat.id ? 'active' : ''}`}
                onClick={() => handleChatSelect(chat.id)}
              >
                <div className="chat-avatar">
                  {getChatImage(chat) ? (
                    <img
                      src={`${getBackendUrl()}${getChatImage(chat)}`}
                      alt={getChatName(chat)}
                    />
                  ) : (
                    <span>{getChatName(chat)?.charAt(0).toUpperCase()}</span>
                  )}
                </div>
                <div className="chat-info">
                  <div className="chat-name">{getChatName(chat)}</div>
                  <div className="chat-preview">
                    {chat.chat_type === 'group' ? 'گروه' : 'چت خصوصی'}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="telegram-main">
        {selectedChatId ? (
          <ChatWindow chatId={selectedChatId} />
        ) : (
          <div className="empty-chat-view">
            <div className="empty-chat-message">
              Select a chat to start messaging
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {showNewChat && (
        <div className="modal-overlay" onClick={() => setShowNewChat(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>چت جدید</h2>
            <form onSubmit={createSingleChat}>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ایمیل کاربر"
                required
              />
              <div className="modal-actions">
                <button type="submit" className="btn-primary">ایجاد</button>
                <button
                  type="button"
                  onClick={() => setShowNewChat(false)}
                  className="btn-secondary"
                >
                  انصراف
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showNewGroup && (
        <div className="modal-overlay" onClick={() => setShowNewGroup(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>گروه جدید</h2>
            <form onSubmit={createGroup}>
              <input
                type="text"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="نام گروه"
                required
              />
              <div className="emails-list">
                {groupEmails.map((email, index) => (
                  <input
                    key={index}
                    type="email"
                    value={email}
                    onChange={(e) => updateEmail(index, e.target.value)}
                    placeholder="ایمیل عضو"
                  />
                ))}
                <button
                  type="button"
                  onClick={addEmailField}
                  className="add-email-btn"
                >
                  + افزودن ایمیل
                </button>
              </div>
              <div className="modal-actions">
                <button type="submit" className="btn-primary">ایجاد</button>
                <button
                  type="button"
                  onClick={() => setShowNewGroup(false)}
                  className="btn-secondary"
                >
                  انصراف
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showSettings && (
        <div className="modal-overlay" onClick={() => setShowSettings(false)}>
          <div className="modal settings-modal" onClick={(e) => e.stopPropagation()}>
            <h2>تنظیمات</h2>
            <div className="settings-content">
              <div className="settings-item">
                <span>حالت تاریک</span>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={darkMode}
                    onChange={toggleDarkMode}
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>
              <div className="settings-item">
                <button onClick={() => { navigate('/profile'); setShowSettings(false); }}>
                  ویرایش پروفایل
                </button>
              </div>
              <div className="settings-item">
                <button onClick={() => { logout(); setShowSettings(false); }}>
                  خروج
                </button>
              </div>
            </div>
            <button
              className="btn-secondary"
              onClick={() => setShowSettings(false)}
            >
              بستن
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default ChatList;
