import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { getBackendUrl } from '../utils/config';
import './Profile.css';

function Profile() {
  const { user, updateUser } = useAuth();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    full_name: '',
    password: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (user) {
      setFormData({
        username: user.username || '',
        email: user.email || '',
        full_name: user.full_name || '',
        password: '',
      });
    }
  }, [user]);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    const updateData = {};
    if (formData.username !== user.username) updateData.username = formData.username;
    if (formData.email !== user.email) updateData.email = formData.email;
    if (formData.full_name !== user.full_name) updateData.full_name = formData.full_name;
    if (formData.password) updateData.password = formData.password;

    try {
      const response = await api.put('/api/users/me', updateData);
      updateUser(response.data);
      setSuccess('پروفایل با موفقیت به‌روزرسانی شد');
      setFormData({ ...formData, password: '' });
    } catch (err) {
      setError(err.response?.data?.detail || 'خطا در به‌روزرسانی پروفایل');
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('فایل باید تصویر باشد');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError('حجم فایل نباید بیشتر از 10 مگابایت باشد');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await api.post('/api/users/me/profile-image', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      updateUser({ ...user, profile_image: response.data.profile_image });
      setSuccess('تصویر پروفایل با موفقیت به‌روزرسانی شد');
    } catch (err) {
      setError(err.response?.data?.detail || 'خطا در آپلود تصویر');
    }
  };

  return (
    <div className="profile-container">
      <div className="profile-card">
        <button onClick={() => navigate('/chats')} className="back-btn">
          ← بازگشت
        </button>
        <h1>پروفایل</h1>

        <div className="profile-image-section">
          <div className="profile-avatar-large">
            {user?.profile_image ? (
              <img
                src={`${getBackendUrl()}${user.profile_image}`}
                alt="Profile"
              />
            ) : (
              <span>{user?.username?.charAt(0).toUpperCase()}</span>
            )}
          </div>
          <label className="upload-btn">
            تغییر تصویر
            <input
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              style={{ display: 'none' }}
            />
          </label>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>نام کاربری</label>
            <input
              type="text"
              name="username"
              value={formData.username}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label>ایمیل</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label>نام کامل</label>
            <input
              type="text"
              name="full_name"
              value={formData.full_name}
              onChange={handleChange}
            />
          </div>

          <div className="form-group">
            <label>رمز عبور جدید (اختیاری)</label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="برای تغییر رمز عبور وارد کنید"
            />
          </div>

          {error && <div className="error">{error}</div>}
          {success && <div className="success">{success}</div>}

          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? 'در حال ذخیره...' : 'ذخیره تغییرات'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default Profile;

