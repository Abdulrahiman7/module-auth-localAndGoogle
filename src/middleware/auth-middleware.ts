import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/users-services';
import { AuthRequest } from '../util/types/auth-types';

/**
 * Middleware to authenticate JWT tokens
 */
export const authenticateToken = (req: AuthRequest, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    res.status(401).json({
      success: false,
      error: 'ACCESS_TOKEN_REQUIRED',
      message: 'Access token is required'
    });
    return;
  }

  const decoded = AuthService.verifyAccessToken(token);
  if (!decoded) {
    res.status(403).json({
      success: false,
      error: 'INVALID_ACCESS_TOKEN',
      message: 'Invalid or expired access token'
    });
    return;
  }

  req.user = decoded;
  next();
};

/**
 * Middleware to check specific user roles
 */
export const requireRole = (roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'AUTHENTICATION_REQUIRED',
        message: 'Authentication required'
      });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        error: 'INSUFFICIENT_PERMISSIONS',
        message: 'Insufficient permissions for this action'
      });
      return;
    }

    next();
  };
};

/**
 * Middleware to check if user is admin
 */
export const requireAdmin = requireRole(['admin']);

/**
 * Middleware to check if user is agent or admin
 */
export const requireAgent = requireRole(['agent', 'admin']);

/**
 * Middleware to optionally authenticate (user can be guest or authenticated)
 */
export const optionalAuth = (req: AuthRequest, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (token) {
    const decoded = AuthService.verifyAccessToken(token);
    if (decoded) {
      req.user = decoded;
    }
  }

  // Continue regardless of auth status
  next();
};

/**
 * Middleware to extract IP address and user agent
 */
export const extractClientInfo = (req: Request, res: Response, next: NextFunction): void => {
  // Extract IP address
  const ipAddress = req.ip || 
    req.connection.remoteAddress || 
    req.socket.remoteAddress || 
    (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
    'unknown';

  // Extract user agent
  const userAgent = req.headers['user-agent'] || 'unknown';

  // Add to request object
  (req as any).clientInfo = {
    ipAddress,
    userAgent
  };

  next();
};