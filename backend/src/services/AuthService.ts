import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { User } from "../models/User.js";
import { Wallet } from "../models/Wallet.js";
import mongoose from "mongoose";
import { JWT_CONFIG } from "../config/jwt.js";

interface RegisterData {
  email: string;
  phoneNumber: string;
  password: string;
  firstName: string;
  lastName: string;
  roles: string[];
  referralCode?: string;
  companyName?: string;
  businessType?: string;
  taxId?: string;
  businessDescription?: string;
}

interface LoginData {
  identifier: string;
  password: string;
}

export class AuthService {
  private readonly JWT_SECRET: string;
  private readonly JWT_REFRESH_SECRET: string;
  private readonly JWT_EXPIRES_IN: string;
  private readonly JWT_REFRESH_EXPIRES_IN: string;
  private readonly SALT_ROUNDS = 10;

  constructor() {
    this.JWT_SECRET = JWT_CONFIG.SECRET;
    this.JWT_REFRESH_SECRET = JWT_CONFIG.REFRESH_SECRET;
    this.JWT_EXPIRES_IN = JWT_CONFIG.EXPIRES_IN;
    this.JWT_REFRESH_EXPIRES_IN = JWT_CONFIG.REFRESH_EXPIRES_IN;
  }

  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, this.SALT_ROUNDS);
  }

  async comparePassword(
    password: string,
    hashedPassword: string
  ): Promise<boolean> {
    return bcrypt.compare(password, hashedPassword);
  }

  generateAccessToken(userId: string, email: string, roles: string[]): string {
    return jwt.sign({ id: userId, email, roles }, this.JWT_SECRET, {
      expiresIn: this.JWT_EXPIRES_IN as string,
    } as any);
  }

  generateRefreshToken(userId: string): string {
    return jwt.sign({ id: userId }, this.JWT_REFRESH_SECRET, {
      expiresIn: this.JWT_REFRESH_EXPIRES_IN as string,
    } as any);
  }

  verifyAccessToken(token: string): any {
    try {
      return jwt.verify(token, this.JWT_SECRET);
    } catch (error) {
      return null;
    }
  }

  verifyRefreshToken(token: string): any {
    try {
      return jwt.verify(token, this.JWT_REFRESH_SECRET);
    } catch (error) {
      return null;
    }
  }

  async register(data: RegisterData): Promise<{
    success: boolean;
    message: string;
    user?: any;
    accessToken?: string;
    refreshToken?: string;
  }> {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const existingUser = await User.findOne({
        $or: [{ email: data.email }, { phoneNumber: data.phoneNumber }],
      });

      if (existingUser) {
        await session.abortTransaction();
        return {
          success: false,
          message: "User with this email or phone number already exists",
        };
      }

      const passwordHash = await this.hashPassword(data.password);

      // Create user first
      const userData: any = {
        email: data.email,
        phoneNumber: data.phoneNumber,
        passwordHash,
        roles: data.roles,
        profile: {
          firstName: data.firstName,
          lastName: data.lastName,
          language: "en",
        },
        status: "active",
        reputation: {
          score: 50,
          level: 1,
          totalTasksCompleted: 0,
          approvalRate: 100,
          badges: [],
          ratings: {
            average: 0,
            count: 0,
          },
        },
      };

      // Add sponsor info if user is registering as sponsor
      if (data.roles.includes("sponsor") && data.companyName) {
        userData.sponsorInfo = {
          companyName: data.companyName,
          businessType: data.businessType,
          taxId: data.taxId,
          businessDescription: data.businessDescription,
          verificationStatus: "pending",
        };
      }

      const user = await User.create([userData], { session });

      // Create wallet with userId
      const wallet = await Wallet.create(
        [
          {
            userId: user[0]._id,
            availableBalance: 0,
            pendingBalance: 0,
            escrowBalance: 0,
            lifetimeEarnings: 0,
            lifetimeSpending: 0,
            currency: "NGN",
          },
        ],
        { session }
      );

      // Update user with walletId
      user[0].walletId = wallet[0]._id;
      await user[0].save({ session });

      await session.commitTransaction();

      // Apply referral code if provided (after transaction commits)
      if (data.referralCode) {
        try {
          const { ReferralService } = await import("./ReferralService.js");
          await ReferralService.applyReferralCode(
            user[0]._id.toString(),
            data.referralCode
          );
          console.log(
            `✅ Referral code ${data.referralCode} applied for user ${user[0]._id}`
          );
        } catch (referralError) {
          console.error("❌ Failed to apply referral code:", referralError);
          // Don't fail registration if referral code is invalid
        }
      }

      const accessToken = this.generateAccessToken(
        user[0]._id.toString(),
        user[0].email,
        user[0].roles
      );
      const refreshToken = this.generateRefreshToken(user[0]._id.toString());

      return {
        success: true,
        message: "User registered successfully",
        user: {
          id: user[0]._id,
          email: user[0].email,
          phoneNumber: user[0].phoneNumber,
          roles: user[0].roles,
          profile: user[0].profile,
        },
        accessToken,
        refreshToken,
      };
    } catch (error) {
      await session.abortTransaction();
      console.error("Registration error:", error);
      return {
        success: false,
        message: "Registration failed",
      };
    } finally {
      session.endSession();
    }
  }

  async login(data: LoginData): Promise<{
    success: boolean;
    message: string;
    user?: any;
    accessToken?: string;
    refreshToken?: string;
  }> {
    try {
      const user = await User.findOne({
        $or: [{ email: data.identifier }, { phoneNumber: data.identifier }],
      });

      if (!user) {
        return {
          success: false,
          message: "Invalid credentials",
        };
      }

      if (user.status !== "active") {
        return {
          success: false,
          message: `Account is ${user.status}`,
        };
      }

      const isPasswordValid = await this.comparePassword(
        data.password,
        user.passwordHash
      );

      if (!isPasswordValid) {
        return {
          success: false,
          message: "Invalid credentials",
        };
      }

      user.lastLoginAt = new Date();
      await user.save();

      const accessToken = this.generateAccessToken(
        user._id.toString(),
        user.email,
        user.roles
      );
      const refreshToken = this.generateRefreshToken(user._id.toString());

      return {
        success: true,
        message: "Login successful",
        user: {
          id: user._id,
          email: user.email,
          phoneNumber: user.phoneNumber,
          roles: user.roles,
          profile: user.profile,
          reputation: user.reputation,
        },
        accessToken,
        refreshToken,
      };
    } catch (error) {
      console.error("Login error:", error);
      return {
        success: false,
        message: "Login failed",
      };
    }
  }

  async refreshAccessToken(refreshToken: string): Promise<{
    success: boolean;
    message: string;
    accessToken?: string;
  }> {
    try {
      const decoded = this.verifyRefreshToken(refreshToken);

      if (!decoded) {
        return {
          success: false,
          message: "Invalid refresh token",
        };
      }

      const user = await User.findById(decoded.id);

      if (!user || user.status !== "active") {
        return {
          success: false,
          message: "User not found or inactive",
        };
      }

      const accessToken = this.generateAccessToken(
        user._id.toString(),
        user.email,
        user.roles
      );

      return {
        success: true,
        message: "Token refreshed successfully",
        accessToken,
      };
    } catch (error) {
      console.error("Token refresh error:", error);
      return {
        success: false,
        message: "Token refresh failed",
      };
    }
  }

  async resetPassword(
    identifier: string,
    newPassword: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      const user = await User.findOne({
        $or: [{ email: identifier }, { phoneNumber: identifier }],
      });

      if (!user) {
        return {
          success: false,
          message: "User not found",
        };
      }

      const passwordHash = await this.hashPassword(newPassword);
      user.passwordHash = passwordHash;
      await user.save();

      return {
        success: true,
        message: "Password reset successfully",
      };
    } catch (error) {
      console.error("Password reset error:", error);
      return {
        success: false,
        message: "Password reset failed",
      };
    }
  }
}

export const authService = new AuthService();
