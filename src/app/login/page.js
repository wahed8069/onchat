'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import OnChatLogo from '@/components/OnChatLogo';
import styles from './login.module.css';

const PAYMENT_PLANS = [
  { id: 'Basic Admin', name: 'Basic Admin', price: 'Free', desc: 'Manage up to 10 active chat users' },
  { id: 'Pro Admin', name: 'Pro Admin', price: '$49/mo', desc: 'Manage unlimited users, audio/video calls' },
  { id: 'Enterprise Admin', name: 'Enterprise Admin', price: '$199/mo', desc: 'Full custom branding & dedicated priority support' }
];

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Request Admin Modal State
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [reqEmail, setReqEmail] = useState('');
  const [reqPhone, setReqPhone] = useState('');
  const [reqPassword, setReqPassword] = useState('');
  const [reqPlace, setReqPlace] = useState('');
  const [reqPhotoUrl, setReqPhotoUrl] = useState('');
  const [reqPaymentPlan, setReqPaymentPlan] = useState('Pro Admin');
  const [reqLoading, setReqLoading] = useState(false);
  const [reqError, setReqError] = useState('');
  const [reqSuccess, setReqSuccess] = useState('');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const router = useRouter();

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!username || !password) {
      setError('Please fill in all fields');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (response.ok) {
        localStorage.setItem('user', JSON.stringify(data.user));
        router.push('/');
        router.refresh();
      } else {
        setError(data.error || 'Invalid credentials');
      }
    } catch (err) {
      console.error(err);
      setError('Failed to connect to server. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingPhoto(true);
    setReqError('');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/upload/public', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (res.ok && data.url) {
        setReqPhotoUrl(data.url);
      } else {
        setReqError(data.error || 'Failed to upload photo');
      }
    } catch (err) {
      console.error(err);
      setReqError('Error uploading photo');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleAdminRequestSubmit = async (e) => {
    e.preventDefault();
    if (!reqEmail || !reqPhone || !reqPassword || !reqPlace) {
      setReqError('Please fill in Email, Phone number, Password, and Place');
      return;
    }

    setReqLoading(true);
    setReqError('');
    setReqSuccess('');

    try {
      const res = await fetch('/api/admin-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: reqEmail,
          phone: reqPhone,
          password: reqPassword,
          place: reqPlace,
          photo: reqPhotoUrl || '/uploads/avatar-admin.png',
          paymentPlan: reqPaymentPlan
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setReqSuccess('Your Admin Request has been submitted! It will go to the Super Admin dashboard for approval.');
        setReqEmail('');
        setReqPhone('');
        setReqPassword('');
        setReqPlace('');
        setReqPhotoUrl('');
      } else {
        setReqError(data.error || 'Failed to submit request');
      }
    } catch (err) {
      console.error(err);
      setReqError('Error submitting admin request. Please try again.');
    } finally {
      setReqLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.header}>
          <OnChatLogo size={46} showText={true} />
          <p className={styles.subtitle}>Sign in to start messaging</p>
        </div>

        {error && <div className={styles.error}>{error}</div>}

        <form onSubmit={handleLogin}>
          <div className={styles.formGroup}>
            <label className={styles.label} htmlFor="username">Email or Username</label>
            <input
              className={styles.input}
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your email or username"
              autoComplete="username"
              disabled={loading}
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label} htmlFor="password">Password</label>
            <input
              className={styles.input}
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              autoComplete="current-password"
              disabled={loading}
            />
          </div>

          <button className={styles.button} type="submit" disabled={loading}>
            {loading ? (
              <>
                <span className={styles.spinner}></span>
                Signing in...
              </>
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        <div className={styles.divider}>
          <span>OR</span>
        </div>

        <button
          type="button"
          className={styles.requestAdminBtn}
          onClick={() => {
            setIsRequestModalOpen(true);
            setReqError('');
            setReqSuccess('');
          }}
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
          </svg>
          Request New Admin Access
        </button>
      </div>

      {/* Admin Request Modal */}
      {isRequestModalOpen && (
        <div className={styles.modalOverlay} onClick={() => setIsRequestModalOpen(false)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div className={styles.modalTitleBox}>
                <OnChatLogo size={32} showText={false} />
                <div>
                  <h2 className={styles.modalTitle}>Request New Admin Account</h2>
                  <p className={styles.modalSubtitle}>Application goes directly to Super Admin dashboard</p>
                </div>
              </div>
              <button
                className={styles.modalCloseBtn}
                onClick={() => setIsRequestModalOpen(false)}
              >
                ✕
              </button>
            </div>

            {reqError && <div className={styles.error}>{reqError}</div>}
            {reqSuccess && <div className={styles.success}>{reqSuccess}</div>}

            {!reqSuccess && (
              <form onSubmit={handleAdminRequestSubmit} className={styles.reqForm}>
                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>Email Address (Used as Username) *</label>
                    <input
                      type="email"
                      className={styles.input}
                      value={reqEmail}
                      onChange={(e) => setReqEmail(e.target.value)}
                      placeholder="e.g. admin@company.com"
                      required
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.label}>Phone Number *</label>
                    <input
                      type="tel"
                      className={styles.input}
                      value={reqPhone}
                      onChange={(e) => setReqPhone(e.target.value)}
                      placeholder="+1 (555) 000-0000"
                      required
                    />
                  </div>
                </div>

                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>Desired Password *</label>
                    <input
                      type="password"
                      className={styles.input}
                      value={reqPassword}
                      onChange={(e) => setReqPassword(e.target.value)}
                      placeholder="Choose a strong password"
                      required
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.label}>Place / Location *</label>
                    <input
                      type="text"
                      className={styles.input}
                      value={reqPlace}
                      onChange={(e) => setReqPlace(e.target.value)}
                      placeholder="City, Country"
                      required
                    />
                  </div>
                </div>

                {/* Photo Upload & Preview */}
                <div className={styles.formGroup}>
                  <label className={styles.label}>Admin Photo / Avatar</label>
                  <div className={styles.photoUploadRow}>
                    <div
                      className={styles.photoPreview}
                      style={{
                        backgroundImage: reqPhotoUrl ? `url(${reqPhotoUrl})` : undefined,
                        backgroundColor: !reqPhotoUrl ? 'var(--accent-color)' : undefined
                      }}
                    >
                      {!reqPhotoUrl && (
                        <svg viewBox="0 0 24 24" width="24" height="24" fill="white">
                          <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                        </svg>
                      )}
                    </div>

                    <div className={styles.photoControls}>
                      <label className={styles.uploadBtn}>
                        {uploadingPhoto ? 'Uploading...' : 'Choose Photo'}
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handlePhotoUpload}
                          disabled={uploadingPhoto}
                          style={{ display: 'none' }}
                        />
                      </label>
                      <span className={styles.photoHint}>Upload your official profile photo</span>
                    </div>
                  </div>
                </div>

                {/* Payment Plan Options */}
                <div className={styles.formGroup}>
                  <label className={styles.label}>Select Payment Plan</label>
                  <div className={styles.planSelector}>
                    {PAYMENT_PLANS.map((plan) => (
                      <div
                        key={plan.id}
                        className={`${styles.planCard} ${reqPaymentPlan === plan.id ? styles.planCardSelected : ''}`}
                        onClick={() => setReqPaymentPlan(plan.id)}
                      >
                        <div className={styles.planHeader}>
                          <span className={styles.planName}>{plan.name}</span>
                          <span className={styles.planPrice}>{plan.price}</span>
                        </div>
                        <p className={styles.planDesc}>{plan.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className={styles.modalFooter}>
                  <button
                    type="button"
                    className={styles.secondaryBtn}
                    onClick={() => setIsRequestModalOpen(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className={styles.button}
                    disabled={reqLoading || uploadingPhoto}
                  >
                    {reqLoading ? 'Submitting...' : 'Submit Request to Super Admin'}
                  </button>
                </div>
              </form>
            )}

            {reqSuccess && (
              <div className={styles.modalFooter}>
                <button
                  type="button"
                  className={styles.button}
                  onClick={() => setIsRequestModalOpen(false)}
                >
                  Done
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
