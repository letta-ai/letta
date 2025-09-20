import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';

/**
 * UserProfile component for displaying user information
 * @param {Object} props - Component props
 * @param {Object} props.user - User object
 * @param {Function} props.onEdit - Edit callback function
 */
const UserProfile = ({ user, onEdit }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [userData, setUserData] = useState(user);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setUserData(user);
  }, [user]);

  const handleSave = async () => {
    setLoading(true);
    try {
      await onEdit(userData);
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to save user data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setUserData(user);
    setIsEditing(false);
  };

  const handleInputChange = (field, value) => {
    setUserData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  if (loading) {
    return <div className="loading-spinner">Saving...</div>;
  }

  return (
    <div className="user-profile">
      <div className="profile-header">
        <h2>{userData.name}</h2>
        {!isEditing && (
          <button onClick={() => setIsEditing(true)} className="edit-btn">
            Edit Profile
          </button>
        )}
      </div>

      <div className="profile-content">
        {isEditing ? (
          <form onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
            <div className="form-group">
              <label htmlFor="name">Name:</label>
              <input
                id="name"
                type="text"
                value={userData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="email">Email:</label>
              <input
                id="email"
                type="email"
                value={userData.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="bio">Bio:</label>
              <textarea
                id="bio"
                value={userData.bio || ''}
                onChange={(e) => handleInputChange('bio', e.target.value)}
                rows={4}
              />
            </div>

            <div className="form-actions">
              <button type="submit" className="save-btn">Save</button>
              <button type="button" onClick={handleCancel} className="cancel-btn">
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <div className="profile-display">
            <p><strong>Email:</strong> {userData.email}</p>
            <p><strong>Bio:</strong> {userData.bio || 'No bio provided'}</p>
            <p><strong>Member since:</strong> {new Date(userData.joinDate).toLocaleDateString()}</p>
          </div>
        )}
      </div>
    </div>
  );
};

UserProfile.propTypes = {
  user: PropTypes.shape({
    id: PropTypes.number.isRequired,
    name: PropTypes.string.isRequired,
    email: PropTypes.string.isRequired,
    bio: PropTypes.string,
    joinDate: PropTypes.string.isRequired,
  }).isRequired,
  onEdit: PropTypes.func.isRequired,
};

export default UserProfile;