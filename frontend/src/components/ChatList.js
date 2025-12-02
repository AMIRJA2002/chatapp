import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import './ChatList.css';

function ChatList() {
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNewChat, setShowNewChat] = useState(false);
  const [email, setEmail] = useState('');
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupEmails, setGroupEmails] = useState(['']);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    fetchChats();
  }, []);

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
    <div className="chat-list-container">
      <div className="chat-list-sidebar">
        <div className="sidebar-header">
          <div className="user-info">
            <div className="user-avatar">
              {user?.profile_image ? (
                <img src={`http://localhost:8000${user.profile_image}`} alt="Profile" />
              ) : (
                <span>{user?.username?.charAt(0).toUpperCase()}</span>
              )}
            </div>
            <div>
              <div className="user-name">{user?.full_name || user?.username}</div>
              <div className="user-email">{user?.email}</div>
            </div>
          </div>
          <button onClick={logout} className="logout-btn">خروج</button>
        </div>

        <div className="sidebar-actions">
          <button onClick={() => setShowNewChat(true)} className="action-btn">
            + چت جدید
          </button>
          <button onClick={() => setShowNewGroup(true)} className="action-btn">
            + گروه جدید
          </button>
          <button onClick={() => navigate('/profile')} className="action-btn">
            پروفایل
          </button>
        </div>

        <div className="chats-list">
          {loading ? (
            <div className="loading">در حال بارگذاری...</div>
          ) : chats.length === 0 ? (
            <div className="empty-state">چتی وجود ندارد</div>
          ) : (
            chats.map((chat) => (
              <div
                key={chat.id}
                className="chat-item"
                onClick={() => navigate(`/chat/${chat.id}`)}
              >
                <div className="chat-avatar">
                  {getChatImage(chat) ? (
                    <img
                      src={`http://localhost:8000${getChatImage(chat)}`}
                      alt={getChatName(chat)}
                    />
                  ) : (
                    <span>{getChatName(chat)?.charAt(0).toUpperCase()}</span>
                  )}
                </div>
                <div className="chat-info">
                  <div className="chat-name">{getChatName(chat)}</div>
                  <div className="chat-type">
                    {chat.chat_type === 'group' ? 'گروه' : 'چت خصوصی'}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

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
    </div>
  );
}

export default ChatList;

