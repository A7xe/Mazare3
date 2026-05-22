import bcrypt from 'bcryptjs';
import { prisma } from '@mazare3/db';
import type { LoginInput, SignupInput, UserRole } from '@mazare3/shared';
import { AppError } from '../lib/errors.js';
import type { SessionPayload } from '../lib/jwt.js';

const BCRYPT_ROUNDS = 12;

export async function signupCustomer(input: SignupInput): Promise<SessionPayload> {
  const email = input.email.toLowerCase().trim();

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new AppError(409, 'EMAIL_EXISTS', 'An account with this email already exists');
  }

  const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);

  const user = await prisma.user.create({
    data: {
      email,
      name: input.name?.trim(),
      passwordHash,
      role: 'customer',
      locale: input.locale ?? 'ar',
      status: 'active',
    },
  });

  return { userId: user.id, email: user.email, role: 'customer' as UserRole };
}

export async function loginUser(input: LoginInput): Promise<SessionPayload> {
  const email = input.email.toLowerCase().trim();

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.passwordHash) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
  }

  if (user.status !== 'active') {
    throw new AppError(403, 'ACCOUNT_SUSPENDED', 'Your account is not active');
  }

  const valid = await bcrypt.compare(input.password, user.passwordHash);
  if (!valid) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
  }

  return { userId: user.id, email: user.email, role: user.role as UserRole };
}

export async function getUserById(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      locale: true,
      status: true,
      createdAt: true,
    },
  });

  if (!user || user.status !== 'active') {
    return null;
  }

  return user;
}
