import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import './Auth.css';

function Register() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await api.post('/api/auth/register', {
        username,
        email,
        password,
      });
      login(response.data.access_token, response.data.user);
      navigate('/chats');
    } catch (err) {
      setError(err.response?.data?.detail || 'خطا در ثبت نام');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h1>ثبت نام</h1>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>نام کاربری</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              placeholder="نام کاربری خود را وارد کنید"
            />
          </div>
          <div className="form-group">
            <label>ایمیل</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="ایمیل خود را وارد کنید"
            />
          </div>
          <div className="form-group">
            <label>رمز عبور</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="رمز عبور خود را وارد کنید"
            />
          </div>
          {error && <div className="error">{error}</div>}
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? 'در حال ثبت نام...' : 'ثبت نام'}
          </button>
        </form>
        <p className="auth-link">
          قبلاً ثبت نام کرده‌اید؟ <Link to="/login">ورود</Link>
        </p>
      </div>
    </div>
  );
}

export default Register;

