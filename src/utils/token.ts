import jwt, { SignOptions, Secret } from "jsonwebtoken";
import { IUser } from "../models/User";

const JWT_SECRET: Secret = process.env.JWT_SECRET || "utask-secret";
const JWT_EXPIRES_IN = (process.env.JWT_EXPIRES_IN ??
  "12h") as SignOptions["expiresIn"];

export function generateToken(user: IUser) {
  return jwt.sign(
    {
      sub: user._id.toString(),
      email: user.email,
      role: user.role,
    },
    JWT_SECRET,
    // { expiresIn: JWT_EXPIRES_IN }
  );
}

export function verifyToken(token: string) {
  return jwt.verify(token, JWT_SECRET) as {
    sub: string;
    email: string;
    role: string;
  };
}
