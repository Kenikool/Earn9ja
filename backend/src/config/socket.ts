import { Server as HTTPServer } from "http";
import { Server, Socket } from "socket.io";
import jwt from "jsonwebtoken";
import { User } from "../models/User.js";

interface AuthenticatedSocket extends Socket {
  userId?: string;
  user?: any;
}

export class SocketService {
  private io: Server;
  private userSockets: Map<string, string[]> = new Map(); // userId -> socketIds[]

  constructor(httpServer: HTTPServer) {
    this.io = new Server(httpServer, {
      cors: {
        origin: process.env.FRONTEND_URL || "*",
        methods: ["GET", "POST"],
        credentials: true,
      },
      pingTimeout: 60000,
      pingInterval: 25000,
    });

    this.setupMiddleware();
    this.setupEventHandlers();
  }

  /**
   * Setup authentication middleware
   */
  private setupMiddleware() {
    this.io.use(async (socket: AuthenticatedSocket, next) => {
      try {
        const token =
          socket.handshake.auth.token ||
          socket.handshake.headers.authorization?.split(" ")[1];

        if (!token) {
          return next(new Error("Authentication error: No token provided"));
        }

        // Verify JWT token
        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;

        // Get user from database
        const user = await User.findById(decoded.userId || decoded.id);

        if (!user) {
          return next(new Error("Authentication error: User not found"));
        }

        // Attach user info to socket
        socket.userId = user._id.toString();
        socket.user = user;

        next();
      } catch (error) {
        console.error("Socket authentication error:", error);
        next(new Error("Authentication error"));
      }
    });
  }

  /**
   * Setup event handlers
   */
  private setupEventHandlers() {
    this.io.on("connection", (socket: AuthenticatedSocket) => {
      console.log(`User connected: ${socket.userId} (${socket.id})`);

      // Add socket to user's socket list
      this.addUserSocket(socket.userId!, socket.id);

      // Join user's personal room
      socket.join(`user:${socket.userId}`);

      // Handle disconnection
      socket.on("disconnect", () => {
        console.log(`User disconnected: ${socket.userId} (${socket.id})`);
        this.removeUserSocket(socket.userId!, socket.id);
      });

      // Join specific rooms
      socket.on("join:room", (roomId: string) => {
        socket.join(roomId);
        console.log(`User ${socket.userId} joined room: ${roomId}`);
      });

      // Leave specific rooms
      socket.on("leave:room", (roomId: string) => {
        socket.leave(roomId);
        console.log(`User ${socket.userId} left room: ${roomId}`);
      });

      // Ping/pong for connection health
      socket.on("ping", () => {
        socket.emit("pong");
      });
    });
  }

  /**
   * Add socket to user's socket list
   */
  private addUserSocket(userId: string, socketId: string) {
    const sockets = this.userSockets.get(userId) || [];
    sockets.push(socketId);
    this.userSockets.set(userId, sockets);
  }

  /**
   * Remove socket from user's socket list
   */
  private removeUserSocket(userId: string, socketId: string) {
    const sockets = this.userSockets.get(userId) || [];
    const filtered = sockets.filter((id) => id !== socketId);

    if (filtered.length === 0) {
      this.userSockets.delete(userId);
    } else {
      this.userSockets.set(userId, filtered);
    }
  }

  /**
   * Emit event to specific user (all their connected sockets)
   */
  public emitToUser(userId: string, event: string, data: any) {
    this.io.to(`user:${userId}`).emit(event, data);
  }

  /**
   * Emit event to specific room
   */
  public emitToRoom(roomId: string, event: string, data: any) {
    this.io.to(roomId).emit(event, data);
  }

  /**
   * Emit event to all connected clients
   */
  public emitToAll(event: string, data: any) {
    this.io.emit(event, data);
  }

  /**
   * Check if user is online
   */
  public isUserOnline(userId: string): boolean {
    return this.userSockets.has(userId);
  }

  /**
   * Get online users count
   */
  public getOnlineUsersCount(): number {
    return this.userSockets.size;
  }

  /**
   * Get all online user IDs
   */
  public getOnlineUserIds(): string[] {
    return Array.from(this.userSockets.keys());
  }

  /**
   * Emit notification to user
   */
  public emitNotification(userId: string, notification: any) {
    this.emitToUser(userId, "notification:new", notification);
  }

  /**
   * Emit task update
   */
  public emitTaskUpdate(userId: string, task: any) {
    this.emitToUser(userId, "task:update", task);
  }

  /**
   * Emit task approval
   */
  public emitTaskApproval(userId: string, submission: any) {
    this.emitToUser(userId, "task:approved", submission);
  }

  /**
   * Emit task rejection
   */
  public emitTaskRejection(userId: string, submission: any) {
    this.emitToUser(userId, "task:rejected", submission);
  }

  /**
   * Emit new task available
   */
  public emitNewTask(task: any) {
    this.emitToAll("task:new", task);
  }

  /**
   * Emit payment notification
   */
  public emitPayment(userId: string, payment: any) {
    this.emitToUser(userId, "payment:received", payment);
  }

  /**
   * Emit wallet update
   */
  public emitWalletUpdate(userId: string, wallet: any) {
    this.emitToUser(userId, "wallet:update", wallet);
  }

  /**
   * Emit withdrawal status update
   */
  public emitWithdrawalUpdate(userId: string, withdrawal: any) {
    this.emitToUser(userId, "withdrawal:update", withdrawal);
  }

  /**
   * Get Socket.io instance
   */
  public getIO(): Server {
    return this.io;
  }
}

let socketService: SocketService;

export const initializeSocket = (httpServer: HTTPServer): SocketService => {
  socketService = new SocketService(httpServer);
  return socketService;
};

export const getSocketService = (): SocketService => {
  if (!socketService) {
    throw new Error("Socket service not initialized");
  }
  return socketService;
};
