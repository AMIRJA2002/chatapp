import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useMobile } from '../hooks/useMobile';
import api from '../services/api';
import { getBackendUrl } from '../utils/config';
import ChatWindow from './ChatWindow';
import './ChatList.css';
import './ChatList.mobile.css';

function ChatList() {
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNewChat, setShowNewChat] = useState(false);
  const [email, setEmail] = useState('');
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupEmails, setGroupEmails] = useState(['']);
  const [groupImage, setGroupImage] = useState(null);
  const [groupImagePreview, setGroupImagePreview] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [selectedChatId, setSelectedChatId] = useState(null);
  const [showSidebar, setShowSidebar] = useState(true);
  const [ws, setWs] = useState(null);
  const { user, logout } = useAuth();
  const { darkMode, toggleDarkMode } = useTheme();
  const isMobile = useMobile();
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

  // Reset unread count when chat is selected
  // Temporarily disabled - unread count feature is disabled
  // useEffect(() => {
  //   if (selectedChatId) {
  //     setChats(prevChats => 
  //       prevChats.map(chat => 
  //         chat.id === selectedChatId 
  //           ? { ...chat, unread_count: 0 }
  //           : chat
  //       )
  //     );
  //   }
  // }, [selectedChatId]);

  // WebSocket connection for real-time chat list updates
  useEffect(() => {
    if (!user?.id) return;

    const token = localStorage.getItem('token');
    if (!token) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    let wsUrl;
    
    if (process.env.NODE_ENV === 'development') {
      wsUrl = `ws://127.0.0.1:8000/ws/global?token=${encodeURIComponent(token)}`;
    } else {
      wsUrl = `${protocol}//${window.location.host}/ws/global?token=${encodeURIComponent(token)}`;
    }

    const websocket = new WebSocket(wsUrl);

    websocket.onopen = () => {
      console.log('ChatList WebSocket connected');
    };

    websocket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        handleWebSocketMessage(data);
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    websocket.onerror = (error) => {
      console.error('ChatList WebSocket error:', error);
    };

    websocket.onclose = () => {
      console.log('ChatList WebSocket disconnected');
      // Reconnect after 3 seconds
      setTimeout(() => {
        if (user?.id) {
          setWs(null);
        }
      }, 3000);
    };

    setWs(websocket);

    return () => {
      if (websocket.readyState === WebSocket.OPEN || websocket.readyState === WebSocket.CONNECTING) {
        websocket.close();
      }
      setWs(null);
    };
  }, [user?.id]);

  const handleWebSocketMessage = (data) => {
    if (!data || !data.type) return;

    switch (data.type) {
      case 'new_message':
        // Update chat list when a new message is received
        updateChatListWithNewMessage(data);
        break;
      case 'message_edited':
      case 'message_deleted':
        // Refresh chat list to update last message
        fetchChats();
        break;
      default:
        break;
    }
  };

  const updateChatListWithNewMessage = (messageData) => {
    if (!messageData.chat_id || !messageData.message) return;

    setChats(prevChats => {
      // Find the chat that received the message
      const chatIndex = prevChats.findIndex(chat => chat.id === messageData.chat_id);
      
      if (chatIndex === -1) {
        // Chat not found, might be a new chat, refresh the list
        fetchChats();
        return prevChats;
      }

      const updatedChats = [...prevChats];
      const chat = updatedChats[chatIndex];

      // Update last message - handle both string and object formats
      const msg = messageData.message;
      const lastMessage = {
        id: msg.id || msg.message_id || '',
        content: msg.content || '',
        message_type: msg.message_type || 'text',
        created_at: msg.created_at || new Date().toISOString(),
        sender_id: msg.sender_id || '',
        sender_name: msg.sender_name || ''
      };

      // Update unread count if message is not from current user
      // Temporarily disabled - unread count feature is disabled
      let unreadCount = 0; // Always set to 0
      // if (msg.sender_id !== user?.id) {
      //   // Only increment if not viewing this chat
      //   if (selectedChatId !== messageData.chat_id) {
      //     unreadCount = (chat.unread_count || 0) + 1;
      //   }
      // } else {
      //   // If message is from current user, reset unread count
      //   unreadCount = 0;
      // }

      // Create updated chat object
      const updatedChat = {
        ...chat,
        last_message: lastMessage,
        unread_count: unreadCount
      };

      // Remove chat from current position and add to top
      updatedChats.splice(chatIndex, 1);
      updatedChats.unshift(updatedChat);

      return updatedChats;
    });
  };

  const fetchChats = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/chats');
      setChats(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Error fetching chats:', error);
      setChats([]);
    } finally {
      setLoading(false);
    }
  };

  const createSingleChat = async (e) => {
    e.preventDefault();
    try {
      const response = await api.post('/api/chats/single', null, {
        params: { identifier: email },  // Can be email or username
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
      const formData = new FormData();
      formData.append('name', groupName);
      formData.append('participant_emails', emails.join(','));
      if (groupImage) {
        formData.append('group_image', groupImage);
      }
      
      const response = await api.post('/api/chats/group', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      setGroupName('');
      setGroupEmails(['']);
      setGroupImage(null);
      setGroupImagePreview(null);
      setShowNewGroup(false);
      setSelectedChatId(response.data.chat_id);
      fetchChats();
      navigate(`/chat/${response.data.chat_id}`);
    } catch (error) {
      alert(error.response?.data?.detail || 'خطا در ایجاد گروه');
    }
  };

  const handleGroupImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setGroupImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setGroupImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
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
    if (!chatId) {
      console.error('No chatId provided for selection');
      return;
    }
    setSelectedChatId(chatId);
    navigate(`/chat/${chatId}`);
  };

  const getChatName = (chat) => {
    if (!chat) return 'چت';
    if (chat.chat_type === 'group') {
      return chat.group_name || 'گروه';
    }
    if (chat.participants && Array.isArray(chat.participants) && chat.participants.length > 0) {
      const participant = chat.participants[0];
      return participant?.full_name || participant?.username || 'کاربر';
    }
    return 'چت';
  };

  const getChatImage = (chat) => {
    if (!chat) return null;
    try {
      if (chat.chat_type === 'group' && chat.group_image) {
        return chat.group_image;
      }
      if (chat.participants && Array.isArray(chat.participants) && chat.participants.length > 0) {
        const participant = chat.participants[0];
        return participant?.profile_image || null;
      }
    } catch (error) {
      console.error('Error getting chat image:', error);
    }
    return null;
  };

  return (
    <div className={`telegram-container ${isMobile ? 'mobile-view' : ''}`}>
      {/* Mobile Sidebar Overlay */}
      {showSidebar && (
        <div className="mobile-sidebar-overlay" onClick={() => setShowSidebar(false)}></div>
      )}
      
      {/* Sidebar */}
      <div className={`telegram-sidebar ${showSidebar ? 'mobile-visible' : 'mobile-hidden'}`}>
        {/* User Header */}
        <div className="sidebar-user-header">
          <div className="user-profile-section">
            <div className="user-avatar-large" onClick={() => navigate('/profile')}>
              {user?.profile_image ? (
                <img src={`${getBackendUrl()}${user.profile_image}`} alt="Profile" />
              ) : (
                <span>{user?.username?.charAt(0).toUpperCase()}</span>
              )}
            </div>
            <div className="user-name-large">{user?.full_name || user?.username}</div>
            <button 
              className="header-menu-btn"
              onClick={() => setShowMenu(!showMenu)}
              title="Menu"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                <path d="M3 10h14M3 5h14M3 15h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </button>
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
          <span className="search-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/>
              <path d="m21 21-4.35-4.35"/>
            </svg>
          </span>
        </div>

        {/* Chats List */}
        <div className="chats-list">
          {loading ? (
            <div className="loading">در حال بارگذاری...</div>
          ) : chats.length === 0 ? (
            <div className="empty-state">چتی وجود ندارد</div>
          ) : (
            chats.map((chat) => {
              if (!chat || !chat.id) return null;
              const otherUser = chat.participants?.find(p => p?.id !== user?.id);
              const isOnline = otherUser?.is_online;
              return (
                <div
                  key={chat.id}
                  className={`chat-item ${selectedChatId === chat.id ? 'active' : ''}`}
                  onClick={() => {
                    if (chat.id) {
                      handleChatSelect(chat.id);
                      setShowSidebar(false);
                    }
                  }}
                >
                  <div className="chat-avatar">
                    {getChatImage(chat) ? (
                      <img
                        src={`${getBackendUrl()}${getChatImage(chat)}`}
                        alt={getChatName(chat)}
                        onError={(e) => {
                          // Hide image and show initial if image fails to load
                          e.target.style.display = 'none';
                          const parent = e.target.parentElement;
                          if (parent && !parent.querySelector('span')) {
                            const span = document.createElement('span');
                            span.textContent = (getChatName(chat) || 'چ').charAt(0).toUpperCase();
                            parent.appendChild(span);
                          }
                        }}
                      />
                    ) : (
                      <span>{(getChatName(chat) || 'چ').charAt(0).toUpperCase()}</span>
                    )}
                    {chat.chat_type === 'single' && isOnline && (
                      <div className="online-indicator"></div>
                    )}
                  </div>
                  <div className="chat-info">
                    <div className="chat-name-row">
                      <div className="chat-name">{getChatName(chat)}</div>
                      {chat.last_message && (
                        <div className="chat-time">
                          {new Date(chat.last_message.created_at).toLocaleTimeString('fa-IR', {
                            timeZone: 'Asia/Tehran',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </div>
                      )}
                    </div>
                    <div className="chat-preview-row">
                      <div className="chat-preview">
                        {chat.last_message 
                          ? (chat.last_message.message_type === 'text' 
                            ? chat.last_message.content 
                            : chat.last_message.message_type === 'image' 
                            ? '📷 تصویر' 
                            : '📎 فایل')
                          : (chat.chat_type === 'group' ? 'گروه' : 'چت خصوصی')}
                      </div>
                      {/* Unread count temporarily disabled */}
                      {false && chat.unread_count > 0 && (
                        <div className="unread-badge">{chat.unread_count}</div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Mobile Menu Button */}
      {!selectedChatId && (
        <button 
          className="mobile-menu-toggle"
          onClick={() => setShowSidebar(true)}
          title="منو"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="3" y1="12" x2="21" y2="12"/>
            <line x1="3" y1="6" x2="21" y2="6"/>
            <line x1="3" y1="18" x2="21" y2="18"/>
          </svg>
        </button>
      )}

      {/* Main Content Area */}
      <div className="telegram-main">
        {selectedChatId ? (
          <ChatWindow 
            chatId={selectedChatId} 
            onBackClick={() => {
              setSelectedChatId(null);
              navigate('/chats');
              setShowSidebar(true);
            }}
          />
        ) : (
          <div className="empty-chat-view">
            <div className="empty-chat-message">
              Select a chat to start messaging
            </div>
          </div>
        )}
      </div>

      {/* Hamburger Menu Dropdown */}
      {showMenu && (
        <div className="hamburger-menu-dropdown">
          <div className="menu-item" onClick={() => { setShowNewGroup(true); setShowMenu(false); }}>
            <span className="menu-icon">👥</span>
            <span className="menu-text">New Group</span>
          </div>
          <div className="menu-item" onClick={() => { setShowNewChat(true); setShowMenu(false); }}>
            <span className="menu-icon">💬</span>
            <span className="menu-text">New Chat</span>
          </div>
          <div className="menu-item" onClick={() => { navigate('/profile'); setShowMenu(false); }}>
            <span className="menu-icon">👤</span>
            <span className="menu-text">My Profile</span>
          </div>
          <div className="menu-item" onClick={() => setShowMenu(false)}>
            <span className="menu-icon">📞</span>
            <span className="menu-text">Calls</span>
          </div>
          <div className="menu-item" onClick={() => { setShowSettings(true); setShowMenu(false); }}>
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
          <div className="menu-item" onClick={() => { logout(); setShowMenu(false); }}>
            <span className="menu-icon">🚪</span>
            <span className="menu-text">Logout</span>
          </div>
        </div>
      )}

      {/* Overlay for menu */}
      {showMenu && (
        <div className="menu-overlay" onClick={() => setShowMenu(false)}></div>
      )}

      {/* Modals */}
      {showNewChat && (
        <div className="modal-overlay" onClick={() => setShowNewChat(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>چت جدید</h2>
            <form onSubmit={createSingleChat}>
              <input
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ایمیل یا نام کاربری"
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
        <div className="modal-overlay" onClick={() => {
          setShowNewGroup(false);
          setGroupImage(null);
          setGroupImagePreview(null);
        }}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>گروه جدید</h2>
            <form onSubmit={createGroup}>
              <div className="group-image-upload">
                <label className="group-image-label">
                  {groupImagePreview ? (
                    <img src={groupImagePreview} alt="Group preview" className="group-image-preview" />
                  ) : (
                    <div className="group-image-placeholder">
                      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                        <circle cx="8.5" cy="8.5" r="1.5"/>
                        <polyline points="21 15 16 10 5 21"/>
                      </svg>
                      <span>انتخاب عکس گروه</span>
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleGroupImageChange}
                    style={{ display: 'none' }}
                  />
                </label>
                {groupImagePreview && (
                  <button
                    type="button"
                    onClick={() => {
                      setGroupImage(null);
                      setGroupImagePreview(null);
                    }}
                    className="remove-image-btn"
                  >
                    حذف عکس
                  </button>
                )}
              </div>
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
                    type="text"
                    value={email}
                    onChange={(e) => updateEmail(index, e.target.value)}
                    placeholder="ایمیل یا نام کاربری عضو"
                  />
                ))}
                <button
                  type="button"
                  onClick={addEmailField}
                  className="add-email-btn"
                >
                  + افزودن عضو
                </button>
              </div>
              <div className="modal-actions">
                <button type="submit" className="btn-primary">ایجاد</button>
                <button
                  type="button"
                  onClick={() => {
                    setShowNewGroup(false);
                    setGroupImage(null);
                    setGroupImagePreview(null);
                  }}
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
