import { Request, Response } from "express";
import { validationResult } from "express-validator";
import bcrypt from "bcryptjs";
import { User } from "../models/User";
import { generateToken } from "../utils/token";
import { AuthRequest } from "../middleware/authMiddleware";

export const signup = async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const {
    fullName,
    email,
    password,
    role,
    jobTitle,
    department,
    gender,
    profilePicture,
  } = req.body;

  const existing = await User.findOne({ email });
  if (existing) {
    return res.status(409).json({ message: "Email already registered" });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({
    fullName,
    email,
    passwordHash,
    role,
    jobTitle,
    department,
    gender,
    profilePicture,
  });

  const token = generateToken(user);
  return res.status(201).json({
    token,
    user: sanitizeUser(user),
  });
};

export const login = async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { email, password } = req.body;
  const user = await User.findOne({ email });
  if (!user) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  const match = await bcrypt.compare(password, user.passwordHash);
  if (!match) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  const token = generateToken(user);
  return res.json({ token, user: sanitizeUser(user) });
};

export const createUser = async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const {
    fullName,
    email,
    password,
    role,
    jobTitle,
    department,
    gender,
    profilePicture,
  } = req.body;
  const exists = await User.findOne({ email });
  if (exists) {
    return res.status(409).json({ message: "Email already registered" });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({
    fullName,
    email,
    passwordHash,
    role,
    jobTitle,
    department,
    gender,
    profilePicture,
  });
  return res.status(201).json(sanitizeUser(user));
};

export const listUsers = async (_req: AuthRequest, res: Response) => {
  const users = await User.find();
  res.json(users.map(sanitizeUser));
};

export const getUser = async (req: Request, res: Response) => {
  const user = await User.findById(req.params.id);
  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }
  res.json(sanitizeUser(user));
};

export const updateUser = async (req: AuthRequest, res: Response) => {
  const requester = req.user;
  if (!requester) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const isSelf = requester.id === req.params.id;
  const isManager = requester.role === "admin" || requester.role === "manager";
  if (!isSelf && !isManager) {
    return res.status(403).json({ message: "Forbidden" });
  }

  const updates = { ...req.body };
  if (updates.password) {
    updates.passwordHash = await bcrypt.hash(updates.password, 10);
    delete updates.password;
  }

  const user = await User.findByIdAndUpdate(req.params.id, updates, {
    new: true,
  });
  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }
  res.json(sanitizeUser(user));
};

export const deleteUser = async (req: Request, res: Response) => {
  const user = await User.findByIdAndDelete(req.params.id);
  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }
  res.status(204).send();
};

export const subscribePush = async (req: AuthRequest, res: Response) => {
  const subscription = req.body.subscription;
  if (!subscription || !subscription.endpoint) {
    return res.status(400).json({ message: "Invalid subscription" });
  }
  await User.findByIdAndUpdate(req.user!.id, {
    $set: { subscriptions: [subscription] },
  });
  res.json({ message: "Subscription saved" });
};

const sanitizeUser = (user: any) => ({
  id: user.id,
  fullName: user.fullName,
  email: user.email,
  role: user.role,
  jobTitle: user.jobTitle,
  department: user.department,
  gender: user.gender,
  profilePicture: user.profilePicture,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});
