import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import api from '../services/api';
import { getBackendUrl } from '../utils/config';
import EmojiPicker from 'emoji-picker-react';
import './ChatWindow.css';

function ChatWindow({ chatId: propChatId, onBackClick }) {
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
  const [globalBackground, setGlobalBackground] = useState(null);
  const [showBackgroundMenu, setShowBackgroundMenu] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const [editingMessage, setEditingMessage] = useState(null);
  const [typingUsers, setTypingUsers] = useState([]);
  const [showMessageMenu, setShowMessageMenu] = useState(null);
  const [showReactionsMenu, setShowReactionsMenu] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [messageMenuPosition, setMessageMenuPosition] = useState({ x: 0, y: 0 });
  const [highlightedMessageId, setHighlightedMessageId] = useState(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [isUserScrolling, setIsUserScrolling] = useState(false);
  const [swipeStartX, setSwipeStartX] = useState(null);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [swipingMessageId, setSwipingMessageId] = useState(null);
  const [profilePreview, setProfilePreview] = useState(null);
  const [showGroupSettings, setShowGroupSettings] = useState(false);
  const [editingGroupName, setEditingGroupName] = useState('');
  const [editingGroupImage, setEditingGroupImage] = useState(null);
  const [editingGroupImagePreview, setEditingGroupImagePreview] = useState(null);
  const [showAddMember, setShowAddMember] = useState(false);
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [isLoadingOlderMessages, setIsLoadingOlderMessages] = useState(false);
  const [messagesSkip, setMessagesSkip] = useState(0);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const backgroundInputRef = useRef(null);
  const emojiPickerRef = useRef(null);
  const messageMenuRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const inputRef = useRef(null);
  const messageRefs = useRef({});
  const messagesContainerRef = useRef(null);
  const lastMessageCountRef = useRef(0);

  useEffect(() => {
    if (!chatId) {
      setMessages([]);
      setChatInfo(null);
      return;
    }
    
    // Reset states safely
    try {
      setMessages([]);
      setReplyingTo(null);
      setEditingMessage(null);
        setShowMessageMenu(null);
        setShowReactionsMenu(null);
        setTypingUsers([]);
        setHasMoreMessages(false);
        setMessagesSkip(0);
        setIsLoadingOlderMessages(false);
      
      // Load global background from localStorage (applies to all chats)
      try {
        const globalBg = localStorage.getItem('global_chat_background');
        if (globalBg) {
          setGlobalBackground(globalBg);
          setChatBackground(globalBg);
        } else {
          // Fallback to chat-specific background if no global background
          const saved = localStorage.getItem(`chat_bg_${chatId}`);
          setChatBackground(saved || null);
        }
      } catch (error) {
        console.error('Error loading background:', error);
        setChatBackground(null);
        setGlobalBackground(null);
      }
      
      // Fetch data with error handling
      let isMounted = true;
      const loadData = async () => {
        try {
          if (!isMounted) return;
          await Promise.all([fetchMessages(), fetchChatInfo()]);
        } catch (error) {
          console.error('Error loading chat data:', error);
          if (isMounted) {
            setMessages([]);
            setChatInfo(null);
          }
        }
      };
      
      loadData();
      
      // Connect WebSocket with delay to ensure chat is loaded
      let websocket = null;
      const connectWS = setTimeout(() => {
        if (!isMounted) return;
        websocket = connectWebSocket();
        if (websocket && isMounted) {
          setWs(websocket);
        }
      }, 200);

      return () => {
        isMounted = false;
        clearTimeout(connectWS);
        if (websocket) {
          try {
            if (websocket.readyState === WebSocket.OPEN || websocket.readyState === WebSocket.CONNECTING) {
              websocket.close();
            }
          } catch (error) {
            console.error('Error closing WebSocket:', error);
          }
        }
        setWs(null);
      };
    } catch (error) {
      console.error('Error in chat useEffect:', error);
      setMessages([]);
      setChatInfo(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId]);

  useEffect(() => {
    // Only auto-scroll if:
    // 1. New message was added (message count increased)
    // 2. User is not manually scrolling
    // 3. User is already near the bottom
    const currentMessageCount = messages.length;
    const wasNearBottom = messagesContainerRef.current 
      ? messagesContainerRef.current.scrollHeight - messagesContainerRef.current.scrollTop - messagesContainerRef.current.clientHeight < 200
      : true;
    
    if (currentMessageCount > lastMessageCountRef.current && !isUserScrolling && wasNearBottom) {
      scrollToBottom();
    }
    
    lastMessageCountRef.current = currentMessageCount;
  }, [messages, isUserScrolling]);

  useEffect(() => {
    // Check if user is near bottom to show/hide scroll button
    const container = messagesContainerRef.current;
    if (!container) {
      // Retry after a short delay if container is not ready
      const timeout = setTimeout(() => {
        const retryContainer = messagesContainerRef.current;
        if (retryContainer) {
          const checkScrollPosition = () => {
            const isNearBottom = retryContainer.scrollHeight - retryContainer.scrollTop - retryContainer.clientHeight < 200;
            setShowScrollButton(!isNearBottom);
            setIsUserScrolling(false);
          };
          checkScrollPosition();
        }
      }, 500);
      return () => clearTimeout(timeout);
    }

    const checkScrollPosition = () => {
      const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 200;
      setShowScrollButton(!isNearBottom);
      setIsUserScrolling(false);
    };

    let scrollTimeout;
    const handleScroll = () => {
      setIsUserScrolling(true);
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(checkScrollPosition, 150);
    };

    container.addEventListener('scroll', handleScroll);
    // Initial check
    setTimeout(checkScrollPosition, 100);

    // Infinite scroll: Load older messages when scrolling to top
    const handleScrollForInfinite = () => {
      if (isLoadingOlderMessages || !hasMoreMessages) return;
      
      const scrollTop = container.scrollTop;
      // If user scrolled near the top (within 200px), load older messages
      if (scrollTop < 200) {
        const previousScrollHeight = container.scrollHeight;
        loadOlderMessages().then(() => {
          // Maintain scroll position after loading older messages
          setTimeout(() => {
            const newScrollHeight = container.scrollHeight;
            const scrollDifference = newScrollHeight - previousScrollHeight;
            container.scrollTop = scrollTop + scrollDifference;
          }, 50);
        });
      }
    };

    container.addEventListener('scroll', handleScrollForInfinite);

    return () => {
      container.removeEventListener('scroll', handleScroll);
      container.removeEventListener('scroll', handleScrollForInfinite);
      clearTimeout(scrollTimeout);
    };
  }, [messages]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target)) {
        setShowEmojiPicker(false);
      }
    };

    if (showEmojiPicker) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showEmojiPicker]);

  const onEmojiClick = (emojiData) => {
    setNewMessage(prev => prev + emojiData.emoji);
    setShowEmojiPicker(false);
  };

  useEffect(() => {
    if (chatBackground && chatId) {
      // If global background is set, save it globally
      if (globalBackground) {
        localStorage.setItem('global_chat_background', chatBackground);
      } else {
        localStorage.setItem(`chat_bg_${chatId}`, chatBackground);
      }
    }
  }, [chatBackground, chatId, globalBackground]);

  useEffect(() => {
    // Mark messages as read when chat is opened
    if (messages.length > 0 && user?.id) {
      const unreadMessages = messages.filter(msg => 
        msg.sender_id !== user.id && msg.status !== 'read'
      );
      unreadMessages.forEach(async (msg) => {
        try {
          await api.post(`/api/chats/${chatId}/messages/${msg.id}/read`);
        } catch (error) {
          console.error('Error marking message as read:', error);
        }
      });
    }
  }, [messages.length, chatId, user?.id]);

  useEffect(() => {
    // Close menus when clicking outside
    const handleClickOutside = (event) => {
      if (showMessageMenu && messageMenuRef.current && !messageMenuRef.current.contains(event.target)) {
        // Check if click is not on a message
        if (!event.target.closest('.message')) {
          setShowMessageMenu(null);
        }
      }
      if (showReactionsMenu && !event.target.closest('.reactions-menu') && !event.target.closest('.message-menu')) {
        setShowReactionsMenu(null);
      }
    };

    if (showMessageMenu || showReactionsMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showMessageMenu, showReactionsMenu]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const scrollToMessage = (messageId) => {
    const messageElement = messageRefs.current[messageId];
    if (messageElement) {
      messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Highlight the message
      setHighlightedMessageId(messageId);
      // Remove highlight after 2 seconds
      setTimeout(() => {
        setHighlightedMessageId(null);
      }, 2000);
    }
  };

  const getUserProfileImage = (message) => {
    if (!message || !chatInfo) return null;
    if (chatInfo.chat_type === 'group' && message.sender_id !== user?.id) {
      // Find user in participants
      const participant = chatInfo.participants?.find(p => p.id === message.sender_id);
      return participant?.profile_image || null;
    }
    return null;
  };

  const getUserInfo = (message) => {
    if (!message || !chatInfo) return null;
    if (chatInfo.chat_type === 'group' && message.sender_id !== user?.id) {
      const participant = chatInfo.participants?.find(p => p.id === message.sender_id);
      return participant || null;
    }
    return null;
  };


  const fetchMessages = async (skip = 0, append = false) => {
    if (!chatId) return;
    try {
      const response = await api.get(`/api/chats/${chatId}/messages`, {
        params: {
          limit: 50,
          skip: skip
        }
      });
      
      let messagesData = [];
      let hasMore = false;
      
      if (response.data && typeof response.data === 'object') {
        // New paginated response
        messagesData = Array.isArray(response.data.messages) ? response.data.messages : [];
        hasMore = response.data.has_more || false;
        setMessagesSkip(response.data.skip || 0);
      } else if (Array.isArray(response.data)) {
        // Old format (backward compatibility)
        messagesData = response.data;
        hasMore = messagesData.length === 50; // Assume more if we got full page
      }
      
      if (append) {
        // Prepend older messages
        setMessages(prev => [...messagesData, ...prev]);
      } else {
        // Replace messages (initial load)
        setMessages(messagesData);
        setTimeout(() => {
          scrollToBottom();
          setShowScrollButton(false);
        }, 200);
      }
      
      setHasMoreMessages(hasMore);
    } catch (error) {
      console.error('Error fetching messages:', error);
      if (!append) {
        setMessages([]);
      }
    } finally {
      setIsLoadingOlderMessages(false);
    }
  };

  const loadOlderMessages = async () => {
    if (isLoadingOlderMessages || !hasMoreMessages || !chatId) return;
    
    setIsLoadingOlderMessages(true);
    const nextSkip = messagesSkip + 50;
    await fetchMessages(nextSkip, true);
  };

  const fetchChatInfo = async () => {
    if (!chatId) return;
    try {
      const response = await api.get('/api/chats');
      if (response.data && Array.isArray(response.data)) {
        const chat = response.data.find((c) => c && c.id === chatId);
        if (chat) {
          setChatInfo(chat);
        }
      }
    } catch (error) {
      console.error('Error fetching chat info:', error);
      setChatInfo(null);
    }
  };

  const connectWebSocket = () => {
    if (!chatId) {
      console.error('Cannot connect WebSocket: no chatId');
      return null;
    }
    
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const backendUrl = getBackendUrl();
    const token = localStorage.getItem('token');
    
    let wsUrl;
    if (backendUrl) {
      const cleanUrl = backendUrl.replace('http://', '').replace('https://', '');
      wsUrl = `${protocol}//${cleanUrl}/ws/${chatId}${token ? `?token=${encodeURIComponent(token)}` : ''}`;
    } else {
      wsUrl = `${protocol}//${window.location.host}/ws/${chatId}${token ? `?token=${encodeURIComponent(token)}` : ''}`;
    }
    
    try {
      const websocket = new WebSocket(wsUrl);
      
      websocket.onopen = () => {
        console.log('WebSocket connected');
      };

      websocket.onmessage = (event) => {
        try {
          if (!event.data) return;
          const data = JSON.parse(event.data);
          
          // Handle different message types
          if (data.type === 'typing' && data.user_id) {
            if (data.is_typing) {
              setTypingUsers(prev => {
                if (!prev.includes(data.user_id)) {
                  return [...prev, data.user_id];
                }
                return prev;
              });
              // Clear typing after 3 seconds
              setTimeout(() => {
                setTypingUsers(prev => prev.filter(id => id !== data.user_id));
              }, 3000);
            } else {
              setTypingUsers(prev => prev.filter(id => id !== data.user_id));
            }
          } else if (data.type === 'message_edited' && data.message && data.message.id) {
            setMessages(prev => prev.map(msg => 
              msg.id === data.message.id ? data.message : msg
            ));
          } else if (data.type === 'message_deleted' && data.message_id) {
            setMessages(prev => prev.map(msg => 
              msg.id === data.message_id ? { ...msg, is_deleted: true, content: 'This message was deleted' } : msg
            ));
          } else if (data.type === 'message_reaction' && data.message_id) {
            setMessages(prev => prev.map(msg => 
              msg.id === data.message_id ? { ...msg, reactions: data.reactions || {} } : msg
            ));
          } else if (data.type === 'message_status' && data.message_id) {
            setMessages(prev => prev.map(msg => {
              if (msg.id === data.message_id && msg.sender_id === user?.id) {
                return { ...msg, status: data.status };
              }
              return msg;
            }));
        } else if (data.id && data.chat_id === chatId) {
          setMessages((prev) => {
            // Check if message already exists to prevent duplicates
            const exists = prev.some(msg => msg.id === data.id);
            if (exists) return prev;
            const newMessages = [...prev, data];
            // Auto-scroll only if user is near bottom
            setTimeout(() => {
              const container = messagesContainerRef.current;
              if (container) {
                const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 200;
                if (isNearBottom) {
                  scrollToBottom();
                }
              }
            }, 100);
            return newMessages;
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
    } catch (error) {
      console.error('Error creating WebSocket:', error);
      return null;
    }
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!chatId) {
      console.error('No chatId available');
      return;
    }
    if (!newMessage.trim() && !editingMessage) return;

    try {
      if (editingMessage && editingMessage.id) {
        // Edit existing message - preserve reply_to
        await api.put(`/api/chats/${chatId}/messages/${editingMessage.id}`, {
          content: newMessage,
        });
        // Don't clear replyingTo - preserve it if message was a reply
        // Only clear if we're not editing a reply message
        const wasReply = editingMessage.reply_to || replyingTo;
        if (!wasReply) {
          setReplyingTo(null);
        }
        setEditingMessage(null);
        setNewMessage('');
      } else {
        // Send new message
        await api.post(`/api/chats/${chatId}/messages`, null, {
          params: {
            content: newMessage,
            message_type: 'text',
            reply_to: replyingTo?.id || null,
          },
        });
        setNewMessage('');
        setReplyingTo(null);
        // Scroll to bottom after sending message
        setTimeout(() => {
          scrollToBottom();
        }, 100);
      }
      
      // Mark messages as read
      markMessagesAsRead();
    } catch (error) {
      console.error('Error sending message:', error);
      alert('خطا در ارسال پیام');
    }
  };

  const markMessagesAsRead = async () => {
    try {
      const unreadMessages = messages.filter(msg => 
        msg.sender_id !== user?.id && msg.status !== 'read'
      );
      for (const msg of unreadMessages) {
        await api.post(`/api/chats/${chatId}/messages/${msg.id}/read`);
      }
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  };

  const handleTyping = () => {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    
    ws.send(JSON.stringify({
      type: 'typing',
      is_typing: true
    }));
    
    // Clear previous timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    // Stop typing after 2 seconds of inactivity
    typingTimeoutRef.current = setTimeout(() => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'typing',
          is_typing: false
        }));
      }
    }, 2000);
  };

  const editMessage = (message) => {
    if (!message || !message.id) {
      console.error('Invalid message for editing');
      return;
    }
    setEditingMessage(message);
    setNewMessage(message.content || '');
    // Preserve reply_to_message when editing - keep the original reply_to
    if (message.reply_to && message.reply_to_message) {
      setReplyingTo({
        id: message.reply_to,
        sender_id: message.reply_to_message.sender_id,
        sender_name: message.reply_to_message.sender_name,
        content: message.reply_to_message.content,
        message_type: message.reply_to_message.message_type
      });
    } else {
      setReplyingTo(null);
    }
    inputRef.current?.focus();
  };

  const deleteMessage = async (messageId) => {
    if (!chatId || !messageId) {
      console.error('Missing chatId or messageId');
      return;
    }
    if (!window.confirm('آیا مطمئن هستید که می‌خواهید این پیام را حذف کنید؟')) {
      return;
    }
    
    try {
      await api.delete(`/api/chats/${chatId}/messages/${messageId}`);
      setShowMessageMenu(null);
    } catch (error) {
      console.error('Error deleting message:', error);
      alert('خطا در حذف پیام');
    }
  };

  const reactToMessage = async (messageId, emoji) => {
    if (!chatId || !messageId || !emoji) {
      console.error('Missing required parameters for reaction');
      return;
    }
    try {
      await api.post(`/api/chats/${chatId}/messages/${messageId}/react`, {
        emoji: emoji,
      });
      setShowReactionsMenu(null);
    } catch (error) {
      console.error('Error reacting to message:', error);
      alert('خطا در افزودن واکنش');
    }
  };

  const forwardMessage = async (messageId) => {
    // This will be implemented with a modal to select chats
    alert('Forward feature - Select chats to forward to');
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
        const bgImage = event.target.result;
        // Set as global background for all chats
        setGlobalBackground(bgImage);
        setChatBackground(bgImage);
        localStorage.setItem('global_chat_background', bgImage);
        setShowBackgroundMenu(false);
      };
      reader.onerror = (error) => {
        console.error('Error reading file:', error);
        alert('خطا در خواندن فایل');
      };
      reader.readAsDataURL(file);
    }
  };

  const removeBackground = () => {
    setGlobalBackground(null);
    setChatBackground(null);
    localStorage.removeItem('global_chat_background');
    // Also remove chat-specific backgrounds
    if (chatId) {
      localStorage.removeItem(`chat_bg_${chatId}`);
    }
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
    try {
      if (chatInfo.chat_type === 'group') {
        return chatInfo.group_name || 'گروه';
      }
      if (chatInfo.participants && Array.isArray(chatInfo.participants) && chatInfo.participants.length > 0) {
        const participant = chatInfo.participants[0];
        return participant?.full_name || participant?.username || 'کاربر';
      }
    } catch (error) {
      console.error('Error getting chat title:', error);
    }
    return 'چت';
  };

  const getChatAvatar = () => {
    if (!chatInfo) return null;
    try {
      if (chatInfo.chat_type === 'group' && chatInfo.group_image) {
        return chatInfo.group_image;
      }
      if (chatInfo.participants && Array.isArray(chatInfo.participants) && chatInfo.participants.length > 0) {
        const participant = chatInfo.participants[0];
        return participant?.profile_image || null;
      }
    } catch (error) {
      console.error('Error getting chat avatar:', error);
    }
    return null;
  };

  const updateGroupInfo = async (e) => {
    e.preventDefault();
    if (!chatId) {
      alert('خطا: شناسه چت یافت نشد');
      return;
    }
    try {
      const formData = new FormData();
      if (editingGroupName) {
        formData.append('name', editingGroupName);
      }
      if (editingGroupImage) {
        formData.append('group_image', editingGroupImage);
      }
      
      await api.put(`/api/chats/${chatId}/group`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      
      await fetchChatInfo();
      setShowGroupSettings(false);
      setEditingGroupImage(null);
      setEditingGroupImagePreview(null);
    } catch (error) {
      console.error('Error updating group info:', error);
      alert(error.response?.data?.detail || 'خطا در به‌روزرسانی گروه');
    }
  };

  const handleEditingGroupImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setEditingGroupImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setEditingGroupImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const addMemberToGroup = async (e) => {
    e.preventDefault();
    if (!chatId) {
      alert('خطا: شناسه چت یافت نشد');
      return;
    }
    try {
      await api.post(`/api/chats/${chatId}/participants`, {
        emails: [newMemberEmail],
      });
      setNewMemberEmail('');
      setShowAddMember(false);
      await fetchChatInfo();
    } catch (error) {
      console.error('Error adding member to group:', error);
      alert(error.response?.data?.detail || 'خطا در اضافه کردن عضو');
    }
  };

  const removeMemberFromGroup = async (userId) => {
    if (!chatId) {
      alert('خطا: شناسه چت یافت نشد');
      return;
    }
    if (!window.confirm('آیا مطمئن هستید که می‌خواهید این کاربر را از گروه حذف کنید؟')) {
      return;
    }
    try {
      await api.delete(`/api/chats/${chatId}/participants/${userId}`);
      await fetchChatInfo();
    } catch (error) {
      console.error('Error removing member from group:', error);
      alert(error.response?.data?.detail || 'خطا در حذف عضو');
    }
  };

  return (
    <div 
      className={`chat-window-container ${chatBackground ? 'has-custom-bg' : ''}`}
      style={chatBackground ? { backgroundImage: `url(${chatBackground})` } : {}}
    >
      {chatBackground && <div className="chat-background-overlay" style={{ backgroundImage: `url(${chatBackground})` }} />}
      
      <div className="chat-header">
        {onBackClick && (
          <button 
            className="mobile-back-btn"
            onClick={onBackClick}
            title="بازگشت"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12"/>
              <polyline points="12 19 5 12 12 5"/>
            </svg>
          </button>
        )}
        {getChatAvatar() && (
          <img 
            src={`${getBackendUrl()}${getChatAvatar()}`} 
            alt="Avatar" 
            className="chat-header-avatar"
            onError={(e) => {
              e.target.style.display = 'none';
            }}
          />
        )}
        <div className="chat-title">{getChatTitle()}</div>
        <div className="chat-header-actions">
          {chatInfo?.chat_type === 'group' && (
            <button 
              className="header-btn"
              onClick={() => {
                setEditingGroupName(chatInfo.group_name || '');
                setEditingGroupImagePreview(chatInfo.group_image ? `${getBackendUrl()}${chatInfo.group_image}` : null);
                setShowGroupSettings(true);
              }}
              title="تنظیمات گروه"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="3"/>
                <path d="M12 1v6m0 6v6M5.64 5.64l4.24 4.24m4.24 4.24l4.24 4.24M1 12h6m6 0h6M5.64 18.36l4.24-4.24m4.24-4.24l4.24-4.24"/>
              </svg>
            </button>
          )}
          <button 
            className="header-btn"
            onClick={() => setShowSearch(!showSearch)}
            title="جستجو"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/>
              <path d="m21 21-4.35-4.35"/>
            </svg>
          </button>
          <button 
            className="header-btn"
            onClick={() => setShowBackgroundMenu(!showBackgroundMenu)}
            title="تنظیمات پس‌زمینه"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
              <path d="M10 2L2 7v6l8 5 8-5V7l-8-5z" stroke="currentColor" strokeWidth="1.5" fill="none"/>
            </svg>
          </button>
        </div>
      </div>

      {showSearch && (
        <div className="search-container">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="جستجوی پیام..."
            className="search-input"
            autoFocus
          />
          <button 
            className="search-close-btn"
            onClick={() => {
              setShowSearch(false);
              setSearchQuery('');
            }}
          >
            ✕
          </button>
        </div>
      )}

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

      <div className="messages-container" ref={messagesContainerRef}>
        {messages && Array.isArray(messages) && messages
          .filter(msg => {
            if (!msg || !msg.id) return false;
            if (!searchQuery) return true;
            return msg.content?.toLowerCase().includes(searchQuery.toLowerCase());
          })
          .map((message) => {
            if (!message || !message.id) return null;
            const userInfo = getUserInfo(message);
            const profileImage = getUserProfileImage(message);
            const isGroupChat = chatInfo?.chat_type === 'group';
            const isOwnMessage = message.sender_id === user?.id;
            
            return (
          <div
            key={message.id}
            ref={(el) => {
              if (el && message.id) {
                messageRefs.current[message.id] = el;
              }
            }}
            className={`message ${
              isOwnMessage ? 'message-sent' : 'message-received'
            } ${message.is_deleted ? 'message-deleted' : ''} ${
              highlightedMessageId === message.id ? 'message-highlighted' : ''
            } ${swipingMessageId === message.id ? 'message-swiping' : ''} ${
              isGroupChat && !isOwnMessage ? 'message-with-avatar' : ''
            }`}
            style={swipingMessageId === message.id ? {
              transform: `translateX(${swipeOffset}px)`,
              transition: swipeOffset === 0 ? 'transform 0.3s ease' : 'none'
            } : {}}
            onDoubleClick={(e) => {
              e.stopPropagation();
              if (!message.is_deleted && message.sender_id !== user?.id) {
                setReplyingTo({
                  id: message.id,
                  sender_id: message.sender_id,
                  sender_name: message.sender_name,
                  content: message.content,
                  message_type: message.message_type
                });
                inputRef.current?.focus();
              }
            }}
            onTouchStart={(e) => {
              if (message.is_deleted || message.sender_id === user?.id) return;
              const touch = e.touches[0];
              setSwipeStartX(touch.clientX);
              setSwipingMessageId(message.id);
            }}
            onTouchMove={(e) => {
              if (!swipeStartX || swipingMessageId !== message.id) return;
              const touch = e.touches[0];
              const diff = touch.clientX - swipeStartX;
              // Only allow swipe right for received messages, left for sent messages
              if (message.sender_id === user?.id) {
                // For sent messages, allow swipe left (negative)
                if (diff < 0 && diff > -100) {
                  setSwipeOffset(diff);
                }
              } else {
                // For received messages, allow swipe right (positive)
                if (diff > 0 && diff < 100) {
                  setSwipeOffset(diff);
                }
              }
            }}
            onTouchEnd={(e) => {
              if (!swipeStartX || swipingMessageId !== message.id) return;
              const touch = e.changedTouches[0];
              const diff = touch.clientX - swipeStartX;
              
              // If swiped enough, trigger reply
              if (Math.abs(diff) > 50 && !message.is_deleted && message.sender_id !== user?.id) {
                setReplyingTo({
                  id: message.id,
                  sender_id: message.sender_id,
                  sender_name: message.sender_name,
                  content: message.content,
                  message_type: message.message_type
                });
                inputRef.current?.focus();
              }
              
              // Reset swipe
              setSwipeOffset(0);
              setSwipeStartX(null);
              setSwipingMessageId(null);
            }}
            onMouseDown={(e) => {
              if (message.is_deleted || message.sender_id === user?.id) return;
              setSwipeStartX(e.clientX);
              setSwipingMessageId(message.id);
            }}
            onMouseMove={(e) => {
              if (!swipeStartX || swipingMessageId !== message.id || e.buttons !== 1) return;
              const diff = e.clientX - swipeStartX;
              // Only allow swipe right for received messages
              if (message.sender_id !== user?.id && diff > 0 && diff < 100) {
                setSwipeOffset(diff);
              }
            }}
            onMouseUp={(e) => {
              if (!swipeStartX || swipingMessageId !== message.id) return;
              const diff = e.clientX - swipeStartX;
              
              // If swiped enough, trigger reply
              if (diff > 50 && !message.is_deleted && message.sender_id !== user?.id) {
                setReplyingTo({
                  id: message.id,
                  sender_id: message.sender_id,
                  sender_name: message.sender_name,
                  content: message.content,
                  message_type: message.message_type
                });
                inputRef.current?.focus();
              }
              
              // Reset swipe
              setSwipeOffset(0);
              setSwipeStartX(null);
              setSwipingMessageId(null);
            }}
            onMouseLeave={(e) => {
              if (swipingMessageId === message.id) {
                setSwipeOffset(0);
                setSwipeStartX(null);
                setSwipingMessageId(null);
              }
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              const rect = e.currentTarget.getBoundingClientRect();
              const menuWidth = window.innerWidth <= 768 ? 160 : 200;
              const menuHeight = 250;
              const padding = 10;
              let x, y;
              
              if (message.sender_id === user?.id) {
                // For sent messages, show menu on the left side of message
                x = rect.left - menuWidth - padding;
                // If not enough space on left, show on right
                if (x < padding) {
                  x = rect.right + padding;
                }
              } else {
                // For received messages, show menu on the right side of message
                x = rect.right + padding;
                // If not enough space on right, show on left
                if (x + menuWidth > window.innerWidth - padding) {
                  x = rect.left - menuWidth - padding;
                }
              }
              
              // Ensure menu stays within viewport
              x = Math.max(padding, Math.min(x, window.innerWidth - menuWidth - padding));
              
              // Position vertically - try to show below message, if not enough space show above
              y = rect.bottom + padding;
              if (y + menuHeight > window.innerHeight - padding) {
                y = rect.top - menuHeight - padding;
                // If still not enough space, align to top of viewport
                if (y < padding) {
                  y = padding;
                }
              }
              
              setMessageMenuPosition({ x, y });
              setShowMessageMenu(showMessageMenu === message.id ? null : message.id);
            }}
            >
            <div className="message-content">
              {message.reply_to_message && message.reply_to_message.sender_name && (
                <div 
                  className="message-reply-preview"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (message.reply_to) {
                      scrollToMessage(message.reply_to);
                    }
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="reply-line"></div>
                  <div className="reply-content">
                    <div className="reply-sender">{message.reply_to_message.sender_name || 'Unknown'}</div>
                    <div className="reply-text">
                      {message.reply_to_message.message_type === 'text' 
                        ? (message.reply_to_message.content || '') 
                        : message.reply_to_message.message_type === 'image' 
                        ? '📷 تصویر' 
                        : '📎 فایل'}
                    </div>
                  </div>
                </div>
              )}
              {message.is_deleted ? (
                <div className="message-text deleted-message">این پیام حذف شده است</div>
              ) : (
                <>
                  {message.message_type === 'text' && (
                    <div className="message-text">
                      {message.content}
                      {message.edited_at && <span className="edited-badge">ویرایش شده</span>}
                    </div>
                  )}
                  {message.message_type === 'image' && (
                    <img
                      src={`${getBackendUrl()}${message.file_url}`}
                      alt={message.content || 'Image'}
                      className="message-image"
                      onError={(e) => {
                        e.target.style.display = 'none';
                        console.error('Error loading image:', message.file_url);
                      }}
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
                </>
              )}
              {message.reactions && typeof message.reactions === 'object' && Object.keys(message.reactions).length > 0 && (
                <div className="message-reactions">
                  {Object.entries(message.reactions).map(([emoji, users]) => {
                    const usersArray = Array.isArray(users) ? users : [];
                    return (
                      <button
                        key={emoji}
                        className={`reaction-btn ${usersArray.includes(user?.id) ? 'reacted' : ''}`}
                        onClick={() => reactToMessage(message.id, emoji)}
                        title={usersArray.length > 0 ? usersArray.join(', ') : ''}
                      >
                        {emoji} {usersArray.length}
                      </button>
                    );
                  })}
                </div>
              )}
              <div className="message-footer">
                {message.sender_id !== user?.id && chatInfo?.chat_type === 'group' && (
                  <div className="message-sender">
                    {message.sender_name || userInfo?.full_name || userInfo?.username || 'Unknown'}
                  </div>
                )}
                <div className="message-time">
                  {formatTime(message.created_at)}
                  {message.sender_id === user?.id && (
                    <span className="message-status">
                      {message.status === 'read' ? '✓✓' : message.status === 'delivered' ? '✓✓' : '✓'}
                    </span>
                  )}
                </div>
              </div>
            </div>
            {isGroupChat && !isOwnMessage && (
              <div 
                className="message-avatar"
                onClick={(e) => {
                  e.stopPropagation();
                  if (userInfo) {
                    setProfilePreview(userInfo);
                  }
                }}
              >
                {profileImage ? (
                  <img 
                    src={`${getBackendUrl()}${profileImage}`} 
                    alt={userInfo?.full_name || userInfo?.username || 'User'}
                    onError={(e) => {
                      e.target.style.display = 'none';
                      const parent = e.target.parentElement;
                      if (parent && !parent.querySelector('span')) {
                        const span = document.createElement('span');
                        span.textContent = (userInfo?.full_name || userInfo?.username || 'U').charAt(0).toUpperCase();
                        parent.appendChild(span);
                      }
                    }}
                  />
                ) : (
                  <span>{(userInfo?.full_name || userInfo?.username || 'U').charAt(0).toUpperCase()}</span>
                )}
              </div>
            )}
            {showMessageMenu === message.id && (
              <div 
                className="message-menu" 
                ref={messageMenuRef}
                style={{
                  position: 'fixed',
                  left: `${messageMenuPosition.x}px`,
                  top: `${messageMenuPosition.y}px`,
                  zIndex: 10000
                }}
              >
                {message.sender_id === user?.id && !message.is_deleted && (
                  <>
                    <button onClick={() => editMessage(message)}>ویرایش</button>
                    <button onClick={() => deleteMessage(message.id)}>حذف</button>
                  </>
                )}
                <button onClick={() => setReplyingTo(message)}>پاسخ</button>
                <button onClick={() => setShowReactionsMenu(showReactionsMenu === message.id ? null : message.id)}>
                  واکنش
                </button>
                <button onClick={() => forwardMessage(message.id)}>فوروارد</button>
                <button onClick={() => setShowMessageMenu(null)}>بستن</button>
              </div>
            )}
            {showReactionsMenu === message.id && (
              <div className="reactions-menu">
                {['👍', '❤️', '😂', '😮', '😢', '🙏'].map(emoji => (
                  <button
                    key={emoji}
                    className="reaction-emoji-btn"
                    onClick={() => reactToMessage(message.id, emoji)}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </div>
            );
          })}
        {typingUsers.length > 0 && (
          <div className="typing-indicator">
            {typingUsers.map(userId => {
              if (!userId) return null;
              const typingUser = chatInfo?.participants?.find(p => p?.id === userId);
              return (
                <div key={userId} className="typing-text">
                  {typingUser?.full_name || typingUser?.username || 'کسی'} در حال تایپ است...
                </div>
              );
            })}
          </div>
        )}
        <div ref={messagesEndRef} />
        {showScrollButton && (
          <button
            className="scroll-to-bottom-btn"
            onClick={() => {
              scrollToBottom();
              setShowScrollButton(false);
            }}
            title="اسکرول به پایین"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>
        )}
      </div>

      {/* Profile Preview Modal */}
      {profilePreview && (
        <div className="profile-preview-overlay" onClick={() => setProfilePreview(null)}>
          <div className="profile-preview-modal" onClick={(e) => e.stopPropagation()}>
            <button 
              className="profile-preview-close"
              onClick={() => setProfilePreview(null)}
            >
              ✕
            </button>
            <div className="profile-preview-content">
              <div className="profile-preview-avatar-large">
                {profilePreview.profile_image ? (
                  <img 
                    src={`${getBackendUrl()}${profilePreview.profile_image}`} 
                    alt={profilePreview.full_name || profilePreview.username}
                    onError={(e) => {
                      e.target.style.display = 'none';
                      const parent = e.target.parentElement;
                      if (parent && !parent.querySelector('span')) {
                        const span = document.createElement('span');
                        span.textContent = (profilePreview.full_name || profilePreview.username || 'U').charAt(0).toUpperCase();
                        parent.appendChild(span);
                      }
                    }}
                  />
                ) : (
                  <span>{(profilePreview.full_name || profilePreview.username || 'U').charAt(0).toUpperCase()}</span>
                )}
              </div>
              <div className="profile-preview-name">
                {profilePreview.full_name || profilePreview.username}
              </div>
              {profilePreview.full_name && (
                <div className="profile-preview-username">
                  @{profilePreview.username}
                </div>
              )}
              {profilePreview.is_online !== undefined && (
                <div className="profile-preview-status">
                  {profilePreview.is_online ? (
                    <span className="status-online">🟢 آنلاین</span>
                  ) : profilePreview.last_seen ? (
                    <span className="status-offline">
                      آخرین بازدید: {new Date(profilePreview.last_seen).toLocaleString('fa-IR')}
                    </span>
                  ) : (
                    <span className="status-offline">آفلاین</span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

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
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="17 8 12 3 7 8"/>
            <line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
        </button>
        <div className="emoji-picker-wrapper" ref={emojiPickerRef}>
          <button
            type="button"
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className="emoji-btn"
            title="ایموجی"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <path d="M8 14s1.5 2 4 2 4-2 4-2"/>
              <line x1="9" y1="9" x2="9.01" y2="9"/>
              <line x1="15" y1="9" x2="15.01" y2="9"/>
            </svg>
          </button>
        </div>
        {showEmojiPicker && createPortal(
          <>
            <div className="emoji-picker-overlay" onClick={() => setShowEmojiPicker(false)}></div>
            <div className="emoji-picker-container" ref={emojiPickerRef}>
              <EmojiPicker
                onEmojiClick={onEmojiClick}
                autoFocusSearch={false}
                theme={darkMode ? 'dark' : 'light'}
                skinTonesDisabled={false}
                searchDisabled={false}
                previewConfig={{ showPreview: false }}
                height={400}
                width="100%"
              />
            </div>
          </>,
          document.body
        )}
        {replyingTo && (
          <div className="reply-preview">
            <div 
              className="reply-preview-content"
              onClick={(e) => {
                e.stopPropagation();
                if (replyingTo.id) {
                  scrollToMessage(replyingTo.id);
                }
              }}
              style={{ cursor: 'pointer', flex: 1 }}
            >
              <div className="reply-preview-sender">پاسخ به {replyingTo.sender_name || 'پیام'}</div>
              <div className="reply-preview-text">
                {replyingTo.message_type === 'text' 
                  ? replyingTo.content 
                  : replyingTo.message_type === 'image' 
                  ? '📷 تصویر' 
                  : '📎 فایل'}
              </div>
            </div>
            <button 
              className="reply-close-btn"
              onClick={() => setReplyingTo(null)}
            >
              ✕
            </button>
          </div>
        )}
        {editingMessage && (
          <div className="edit-preview">
            <span>در حال ویرایش پیام...</span>
            <button 
              className="edit-cancel-btn"
              onClick={() => {
                setEditingMessage(null);
                setNewMessage('');
              }}
            >
              ✕
            </button>
          </div>
        )}
        <input
          ref={inputRef}
          type="text"
          value={newMessage}
          onChange={(e) => {
            setNewMessage(e.target.value);
            handleTyping();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setReplyingTo(null);
              setEditingMessage(null);
              setNewMessage('');
            } else if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              if (newMessage.trim() || editingMessage) {
                sendMessage(e);
              }
            }
          }}
          placeholder={editingMessage ? "پیام را ویرایش کنید..." : replyingTo ? "پاسخ خود را بنویسید..." : "پیام خود را بنویسید..."}
          className="message-input"
        />
        <button 
          type="submit" 
          className="send-btn"
          disabled={!newMessage.trim()}
          title="ارسال"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13"/>
            <polygon points="22 2 15 22 11 13 2 9 22 2"/>
          </svg>
        </button>
      </form>

      {/* Group Settings Modal */}
    {showGroupSettings && chatInfo?.chat_type === 'group' && (
      <div className="modal-overlay" onClick={() => {
        setShowGroupSettings(false);
        setEditingGroupImage(null);
        setEditingGroupImagePreview(null);
      }}>
        <div className="modal group-settings-modal" onClick={(e) => e.stopPropagation()}>
          <h2>تنظیمات گروه</h2>
          <form onSubmit={updateGroupInfo}>
            <div className="group-image-upload">
              <label className="group-image-label">
                {editingGroupImagePreview ? (
                  <img src={editingGroupImagePreview} alt="Group preview" className="group-image-preview" />
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
                  onChange={handleEditingGroupImageChange}
                  style={{ display: 'none' }}
                />
              </label>
              {editingGroupImagePreview && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingGroupImage(null);
                    setEditingGroupImagePreview(chatInfo.group_image ? `${getBackendUrl()}${chatInfo.group_image}` : null);
                  }}
                  className="remove-image-btn"
                >
                  حذف عکس
                </button>
              )}
            </div>
            <input
              type="text"
              value={editingGroupName}
              onChange={(e) => setEditingGroupName(e.target.value)}
              placeholder="نام گروه"
              required
            />
            <div className="modal-actions">
              <button type="submit" className="btn-primary">ذخیره</button>
              <button
                type="button"
                onClick={() => {
                  setShowGroupSettings(false);
                  setEditingGroupImage(null);
                  setEditingGroupImagePreview(null);
                }}
                className="btn-secondary"
              >
                انصراف
              </button>
            </div>
          </form>
          
          <div className="group-members-section">
            <h3>اعضای گروه</h3>
            <button
              type="button"
              onClick={() => setShowAddMember(true)}
              className="btn-primary"
              style={{ marginBottom: '12px' }}
            >
              + افزودن عضو
            </button>
            {chatInfo.participants && Array.isArray(chatInfo.participants) && (
              <div className="members-list">
                {chatInfo.participants.map((participant) => (
                  <div key={participant.id} className="member-item">
                    <div className="member-info">
                      {participant.profile_image ? (
                        <img 
                          src={`${getBackendUrl()}${participant.profile_image}`} 
                          alt={participant.full_name || participant.username}
                          className="member-avatar"
                        />
                      ) : (
                        <div className="member-avatar">
                          {(participant.full_name || participant.username || 'U').charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <div className="member-name">{participant.full_name || participant.username}</div>
                        <div className="member-email">{participant.email}</div>
                      </div>
                    </div>
                    {participant.id !== user?.id && (
                      <button
                        type="button"
                        onClick={() => removeMemberFromGroup(participant.id)}
                        className="remove-member-btn"
                      >
                        حذف
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    )}

    {/* Add Member Modal */}
    {showAddMember && (
      <div className="modal-overlay" onClick={() => {
        setShowAddMember(false);
        setNewMemberEmail('');
      }}>
        <div className="modal" onClick={(e) => e.stopPropagation()}>
          <h2>افزودن عضو جدید</h2>
          <form onSubmit={addMemberToGroup}>
            <input
              type="email"
              value={newMemberEmail}
              onChange={(e) => setNewMemberEmail(e.target.value)}
              placeholder="ایمیل کاربر"
              required
            />
            <div className="modal-actions">
              <button type="submit" className="btn-primary">افزودن</button>
              <button
                type="button"
                onClick={() => {
                  setShowAddMember(false);
                  setNewMemberEmail('');
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
  </div>
  );
}

export default ChatWindow;
