const jwt = require('jsonwebtoken');
const { User, RefreshToken, AuditLog } = require('../models');
const { hashPassword, comparePassword, hashToken, generateSecureToken } = require('../utils/security');
const { JWT_SECRET, JWT_REFRESH_SECRET } = require('../config/jwt');

// Helper to set secure cookies
function setAuthCookies(res, accessToken, refreshToken) {
  const isProduction = process.env.NODE_ENV === 'production';

  res.cookie('accessToken', accessToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'None' : 'Lax',
    maxAge: 15 * 60 * 1000 // 15 minutes
  });

  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'None' : 'Lax',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  });
}

// Helper to clear auth cookies
function clearAuthCookies(res) {
  const isProduction = process.env.NODE_ENV === 'production';
  res.clearCookie('accessToken', { httpOnly: true, secure: isProduction, sameSite: isProduction ? 'None' : 'Lax' });
  res.clearCookie('refreshToken', { httpOnly: true, secure: isProduction, sameSite: isProduction ? 'None' : 'Lax' });
}

/**
 * Register a new organizer
 */
async function register(req, res) {
  try {
    const { fullName, email, password } = req.body;

    // Validate inputs
    if (!fullName || !email || !password) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Full name, email, and password are required.' }
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Password must be at least 8 characters long.' }
      });
    }

    // Check if email already exists
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Email address is already registered.' }
      });
    }

    // Hash password and create user
    const passwordHash = await hashPassword(password);
    const user = await User.create({
      full_name: fullName,
      email,
      password_hash: passwordHash,
      status: 'ACTIVE'
    });

    // Create Audit Log
    await AuditLog.create({
      user_id: user.id,
      action: 'ORGANIZER_REGISTERED',
      resource_type: 'users',
      resource_id: user.public_id,
      ip_address: req.ip,
      user_agent: req.headers['user-agent']
    });

    // Generate JWTs
    const accessToken = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '15m' });
    const rawRefreshToken = generateSecureToken();
    const refreshTokenHash = hashToken(rawRefreshToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await RefreshToken.create({
      user_id: user.id,
      token_hash: refreshTokenHash,
      expires_at: expiresAt
    });

    setAuthCookies(res, accessToken, rawRefreshToken);

    return res.status(201).json({
      success: true,
      data: {
        user: {
          publicId: user.public_id,
          fullName: user.full_name,
          email: user.email,
          createdAt: user.created_at
        },
        accessToken
      },
      message: 'Registration successful.'
    });
  } catch (error) {
    console.error('Registration Error:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_SERVER_ERROR', message: 'Registration failed.' }
    });
  }
}

/**
 * Login organizer
 */
async function login(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Email and password are required.' }
      });
    }

    // Find user
    const user = await User.findOne({ where: { email } });
    if (!user || user.status !== 'ACTIVE') {
      return res.status(401).json({
        success: false,
        error: { code: 'INVALID_CREDENTIALS', message: 'Incorrect email or password.' }
      });
    }

    // Verify password
    const isMatch = await comparePassword(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        error: { code: 'INVALID_CREDENTIALS', message: 'Incorrect email or password.' }
      });
    }

    // Generate tokens
    const accessToken = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '15m' });
    const rawRefreshToken = generateSecureToken();
    const refreshTokenHash = hashToken(rawRefreshToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    // Save refresh token
    await RefreshToken.create({
      user_id: user.id,
      token_hash: refreshTokenHash,
      expires_at: expiresAt
    });

    // Create Audit Log
    await AuditLog.create({
      user_id: user.id,
      action: 'ORGANIZER_LOGGED_IN',
      resource_type: 'users',
      resource_id: user.public_id,
      ip_address: req.ip,
      user_agent: req.headers['user-agent']
    });

    setAuthCookies(res, accessToken, rawRefreshToken);

    return res.status(200).json({
      success: true,
      data: {
        user: {
          publicId: user.public_id,
          fullName: user.full_name,
          email: user.email,
          createdAt: user.created_at
        },
        accessToken
      },
      message: 'Login successful.'
    });
  } catch (error) {
    console.error('Login Error:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_SERVER_ERROR', message: 'Login failed.' }
    });
  }
}

/**
 * Logout organizer
 */
async function logout(req, res) {
  try {
    const rawRefreshToken = req.cookies.refreshToken;

    if (rawRefreshToken) {
      const refreshTokenHash = hashToken(rawRefreshToken);
      // Revoke in DB
      await RefreshToken.update(
        { revoked_at: new Date() },
        { where: { token_hash: refreshTokenHash, revoked_at: null } }
      );
    }

    // Log the action
    if (req.user) {
      await AuditLog.create({
        user_id: req.user.id,
        action: 'ORGANIZER_LOGGED_OUT',
        resource_type: 'users',
        resource_id: req.user.public_id,
        ip_address: req.ip,
        user_agent: req.headers['user-agent']
      });
    }

    clearAuthCookies(res);

    return res.status(200).json({
      success: true,
      data: {},
      message: 'Logout successful.'
    });
  } catch (error) {
    console.error('Logout Error:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_SERVER_ERROR', message: 'Logout failed.' }
    });
  }
}

/**
 * Refresh JWT access token
 */
async function refresh(req, res) {
  try {
    const rawRefreshToken = req.cookies.refreshToken;

    if (!rawRefreshToken) {
      return res.status(401).json({
        success: false,
        error: { code: 'AUTHENTICATION_REQUIRED', message: 'Refresh token is missing.' }
      });
    }

    const refreshTokenHash = hashToken(rawRefreshToken);

    // Verify refresh token in DB
    const dbToken = await RefreshToken.findOne({
      where: {
        token_hash: refreshTokenHash,
        revoked_at: null
      },
      include: [User]
    });

    if (!dbToken || new Date(dbToken.expires_at) < new Date() || !dbToken.User || dbToken.User.status !== 'ACTIVE') {
      clearAuthCookies(res);
      return res.status(401).json({
        success: false,
        error: { code: 'SESSION_EXPIRED', message: 'Refresh token has expired or is invalid.' }
      });
    }

    // Rotate refresh token (revoke old, issue new)
    dbToken.revoked_at = new Date();
    await dbToken.save();

    const user = dbToken.User;
    const newAccessToken = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '15m' });
    const newRawRefreshToken = generateSecureToken();
    const newRefreshTokenHash = hashToken(newRawRefreshToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await RefreshToken.create({
      user_id: user.id,
      token_hash: newRefreshTokenHash,
      expires_at: expiresAt
    });

    setAuthCookies(res, newAccessToken, newRawRefreshToken);

    return res.status(200).json({
      success: true,
      data: {
        accessToken: newAccessToken
      },
      message: 'Token refreshed successfully.'
    });
  } catch (error) {
    console.error('Refresh Error:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_SERVER_ERROR', message: 'Refresh failed.' }
    });
  }
}

/**
 * Get current user
 */
async function me(req, res) {
  return res.status(200).json({
    success: true,
    data: {
      user: {
        publicId: req.user.public_id,
        fullName: req.user.full_name,
        email: req.user.email,
        createdAt: req.user.created_at
      }
    }
  });
}

/**
 * Update organizer profile settings (name and/or password)
 */
async function updateProfile(req, res) {
  try {
    const { fullName, currentPassword, newPassword } = req.body;
    const user = req.user;

    let profileUpdated = false;
    let passwordUpdated = false;

    // Update Name
    if (fullName && fullName.trim() !== user.full_name) {
      user.full_name = fullName.trim();
      profileUpdated = true;
    }

    // Update Password
    if (currentPassword && newPassword) {
      if (newPassword.length < 8) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'New password must be at least 8 characters long.' }
        });
      }

      // Check current password
      const isMatch = await comparePassword(currentPassword, user.password_hash);
      if (!isMatch) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Current password is incorrect.' }
        });
      }

      user.password_hash = await hashPassword(newPassword);
      passwordUpdated = true;
      profileUpdated = true;
    }

    if (!profileUpdated) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'No changes provided.' }
      });
    }

    await user.save();

    // Create Audit Log
    await AuditLog.create({
      user_id: user.id,
      action: passwordUpdated ? 'PASSWORD_CHANGED' : 'PROFILE_UPDATED',
      resource_type: 'users',
      resource_id: user.public_id,
      ip_address: req.ip,
      user_agent: req.headers['user-agent']
    });

    return res.status(200).json({
      success: true,
      data: {
        user: {
          publicId: user.public_id,
          fullName: user.full_name,
          email: user.email,
          createdAt: user.created_at
        }
      },
      message: passwordUpdated ? 'Password updated successfully.' : 'Profile updated successfully.'
    });
  } catch (error) {
    console.error('Update Profile Error:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to update profile.' }
    });
  }
}

module.exports = {
  register,
  login,
  logout,
  refresh,
  me,
  updateProfile
};
